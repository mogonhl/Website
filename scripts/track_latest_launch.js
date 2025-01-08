import fetch from 'node-fetch';
import { Redis } from '@upstash/redis';
import 'dotenv/config';

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

async function fetchTokenData(tokenId) {
    const response = await fetch('https://api-ui.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: "spotMetaAndAssetCtxs",
            req: { coin: `@${tokenId}/USDC` }
        })
    });

    if (!response.ok) {
        console.log(`Token ${tokenId} response not ok:`, response.status);
        return null;
    }

    const data = await response.json();
    if (!data || !data.length) {
        console.log(`No data for token ${tokenId}`);
        return null;
    }

    return data[0];
}

async function findLatestToken(startId = 100) {
    let currentId = startId;
    let emptyCount = 0;
    let latestValidToken = null;

    while (emptyCount < 3) {
        console.log(`Checking token ${currentId}...`);
        const tokenData = await fetchTokenData(currentId);

        if (tokenData) {
            console.log('Found token data:', tokenData);
            latestValidToken = {
                tokenId: currentId,
                name: tokenData.name,
                fullName: tokenData.fullName,
                tradingSymbol: `@${currentId}/USDC`,
                launchPrice: parseFloat(tokenData.openPrice),
                launchTime: Date.now()
            };
            emptyCount = 0;
            console.log('Latest valid token updated:', latestValidToken);
        } else {
            emptyCount++;
            console.log(`Empty response count: ${emptyCount}`);
        }

        currentId++;
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return latestValidToken;
}

async function main() {
    try {
        // Test Redis connection first
        await testRedisConnection();

        const latestToken = await findLatestToken();
        if (!latestToken) {
            console.log('No valid tokens found');
            return;
        }

        console.log('Latest token found:', latestToken);

        // Only try to store in Redis if it's available
        if (redis) {
            try {
                await redis.set('latest_launch', JSON.stringify(latestToken));
                console.log('Launch data stored in Redis');
                
                // Verify the data was stored
                const stored = await redis.get('latest_launch');
                console.log('Verified stored data:', stored);
            } catch (error) {
                console.error('Error storing in Redis:', error);
            }
        } else {
            console.log('Redis not configured - skipping data storage');
            console.log('To enable Redis storage, please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your .env file');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main();