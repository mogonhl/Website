import fetch from 'node-fetch';
import { Redis } from '@upstash/redis';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Debug Redis configuration
console.log('Redis URL available:', !!process.env.UPSTASH_REDIS_REST_URL);
console.log('Redis token available:', !!process.env.UPSTASH_REDIS_REST_TOKEN);

// Only initialize Redis if credentials are available
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN 
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;

// Test Redis connection
async function testRedisConnection() {
    if (!redis) {
        console.log('Redis not initialized - missing credentials');
        return false;
    }
    try {
        await redis.ping();
        console.log('Redis connection successful');
        return true;
    } catch (error) {
        console.error('Redis connection failed:', error);
        return false;
    }
}

// Load token names from spot_names.json
function loadTokenNames() {
    try {
        const dataPath = path.join(process.cwd(), 'public', 'spot_names.json');
        const tokenNames = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        return tokenNames;
    } catch (error) {
        console.error('Error loading token names:', error);
        return {};
    }
}

async function fetchTokenData(tokenId) {
    try {
        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: "spotMetaAndAssetCtxs"
            })
        });

        if (!response.ok) {
            console.log(`API response not ok:`, response.status);
            return null;
        }

        const data = await response.json();
        
        if (!Array.isArray(data) || data.length < 2) {
            console.log(`Invalid response structure:`, data);
            return null;
        }

        // Get all active tokens
        const tokens = data[1].filter(t => 
            t.coin.startsWith('@') && 
            t.markPx !== '1.0' && // Filter out placeholder tokens
            parseFloat(t.circulatingSupply) > 0
        );

        // Sort by token ID
        tokens.sort((a, b) => {
            const idA = parseInt(a.coin.split('@')[1]);
            const idB = parseInt(b.coin.split('@')[1]);
            return idB - idA;
        });

        // Return all tokens for processing
        return tokens;
    } catch (error) {
        console.error(`Error fetching token data:`, error);
        return null;
    }
}

async function findLatestToken() {
    try {
        // Load token names first
        const tokenNames = loadTokenNames();
        console.log('Loaded token names:', tokenNames);

        // Get total number of chunks from Redis
        const totalChunks = await redis.get('spot_data_7d_chunks');
        console.log('Total chunks:', totalChunks);
        if (!totalChunks) {
            throw new Error('Could not get chunk count from Redis');
        }

        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: "spotMetaAndAssetCtxs" })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const tokens = data[1];

        // Find tokens with supply and sort by ID
        const activeTokens = tokens
            .filter(token => 
                token.coin.startsWith('@') && 
                token.markPx !== '1.0' && 
                parseFloat(token.circulatingSupply) > 0)
            .sort((a, b) => {
                const idA = parseInt(a.coin.replace('@', ''));
                const idB = parseInt(b.coin.replace('@', ''));
                return idB - idA; // Sort in descending order
            });

        // Take the 3 most recent tokens
        const latestTokens = activeTokens.slice(0, 3);
        if (latestTokens.length === 0) {
            console.log('No tokens found');
            return;
        }

        // Process each token's data
        const newLaunches = [];
        for (const token of latestTokens) {
            console.log('Processing token:', token);
            const tokenId = parseInt(token.coin.replace('@', ''));
            
            // Try each chunk from newest to oldest until we find the token's data
            let tokenData = null;
            let foundChunk = null;
            
            // Start from the newest chunk (totalChunks - 1) and work backwards
            for (let chunk = totalChunks - 1; chunk >= 0; chunk--) {
                console.log(`Checking chunk ${chunk} for token ${token.coin}`);
                const batchData = await redis.get(`spot_data_7d_${chunk}`);
                const parsedBatchData = typeof batchData === 'string' ? JSON.parse(batchData) : batchData;
                
                if (Array.isArray(parsedBatchData)) {
                    const found = parsedBatchData.find(d => d.tokenId === token.coin);
                    if (found) {
                        tokenData = found;
                        foundChunk = chunk;
                        console.log(`Found ${token.coin} in chunk ${chunk}`);
                        break;
                    }
                }
            }

            let launchTime, launchPrice;
            if (tokenData && Array.isArray(tokenData.prices) && tokenData.prices.length > 0) {
                // If we have historical data, use it
                const sortedPrices = [...tokenData.prices].sort((a, b) => a[0] - b[0]);
                launchTime = sortedPrices[0][0];
                launchPrice = sortedPrices[0][1];
                console.log(`Found historical data for ${token.coin} in chunk ${foundChunk}:`, { launchTime, launchPrice });
            } else {
                // For new tokens without historical data, use current time and price
                console.log('No historical data found for token:', token.coin, 'Using current data');
                launchTime = Date.now();
                launchPrice = parseFloat(token.markPx);
            }

            newLaunches.push({
                fullName: token.coin,
                name: tokenNames[token.coin] || token.coin,
                launchTime,
                launchPrice
            });
        }

        if (newLaunches.length === 0) {
            console.log('No launch data found for any tokens');
            return;
        }

        // Sort by launch time (oldest first) and store
        newLaunches.sort((a, b) => a.launchTime - b.launchTime);
        await redis.set('latest_launches', JSON.stringify(newLaunches));
        console.log('Updated launches:', newLaunches);

        return newLaunches[newLaunches.length - 1]; // Return the most recent launch
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

async function main() {
    try {
        // Test Redis connection first
        const redisAvailable = await testRedisConnection();
        if (!redisAvailable) {
            console.log('Redis not available - exiting');
            return;
        }

        // Find and store latest token
        const latestToken = await findLatestToken();
        if (latestToken) {
            console.log('Successfully updated latest launches');
        } else {
            console.log('No new launches to add');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

main();