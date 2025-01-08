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

// Load token names from market cap data
function loadTokenNames() {
    try {
        const dataPath = path.join(process.cwd(), 'market_cap_data.json');
        const marketCapData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const tokenNames = {};
        marketCapData.forEach(token => {
            tokenNames[token.coin] = token.name;
        });
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

        // Get existing launches to avoid duplicates
        const existingLaunches = await redis.get('latest_launches');
        const launches = existingLaunches ? 
            (typeof existingLaunches === 'string' ? JSON.parse(existingLaunches) : existingLaunches) : 
            [];
        
        // Update names in existing launches
        launches.forEach(launch => {
            if (tokenNames[launch.fullName]) {
                launch.name = tokenNames[launch.fullName];
            }
        });
        
        console.log('Existing launches:', launches);
        
        // Find highest token ID that's not in our launches and has supply
        let highestId = 0;
        let latestToken = null;
        
        tokens.forEach(token => {
            const id = parseInt(token.coin.replace('@', ''));
            if (!isNaN(id) && 
                id > highestId && 
                !launches.some(l => l.fullName === token.coin) &&
                parseFloat(token.circulatingSupply) > 0) {
                highestId = id;
                latestToken = token;
            }
        });

        if (!latestToken) {
            console.log('No new token found');
            return;
        }

        console.log('Found latest token:', latestToken);

        // Get the batch number for the token's hourly data
        const batchNum = Math.floor(highestId / 20);
        
        // Get historical hourly data from Redis
        console.log('Fetching hourly data from batch:', batchNum);
        const batchData = await redis.get(`spot_data_7d_${batchNum}`);
        console.log('Batch data type:', typeof batchData);
        const parsedBatchData = typeof batchData === 'string' ? JSON.parse(batchData) : batchData;
        
        // Find this token's data in the batch
        const tokenData = Array.isArray(parsedBatchData) ? 
            parsedBatchData.find(d => d.tokenId === highestId) : null;
        console.log('Token data found:', tokenData);

        if (!tokenData || !Array.isArray(tokenData.prices) || tokenData.prices.length === 0) {
            console.log('No historical data found for token');
            return;
        }

        // Sort prices by timestamp to get the earliest
        const sortedPrices = [...tokenData.prices].sort((a, b) => a[0] - b[0]);
        const launchTime = sortedPrices[0][0];
        const launchPrice = sortedPrices[0][1];

        const newLaunch = {
            fullName: latestToken.coin,
            name: tokenNames[latestToken.coin] || latestToken.displayName || latestToken.coin,
            launchTime,
            launchPrice
        };

        // Add to launches array, keeping only the last 3
        launches.unshift(newLaunch);
        if (launches.length > 3) {
            launches.pop();
        }

        // Store updated launches
        await redis.set('latest_launches', JSON.stringify(launches));
        console.log('Updated launches:', launches);

        return newLaunch;
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