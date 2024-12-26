import path from 'path';
import fs from 'fs';
const { Redis } = require('@upstash/redis');

// Debug Redis configuration
const debugRedisConfig = () => {
    console.log('Redis Configuration:', {
        hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        urlStart: process.env.UPSTASH_REDIS_REST_URL?.substring(0, 20),
        hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        tokenStart: process.env.UPSTASH_REDIS_REST_TOKEN?.substring(0, 10)
    });
};

// Create a single Redis instance
let redis;
try {
    debugRedisConfig();
    redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
        automaticDeserialization: true
    });
    console.log('Redis instance created successfully');
} catch (error) {
    console.error('Failed to create Redis instance:', error);
}

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const timeRange = req.query.timeRange || '24H';
    const token = req.query.token || 'HYPE';
    const dataset = req.query.dataset || 'dataset1';

    try {
        console.log('Request received:', { timeRange, token, dataset });

        const cacheKey = dataset === 'dataset2' 
            ? `tvl_data_${timeRange}_${token.toLowerCase()}`
            : `price_data_${timeRange}_${token.toLowerCase()}`;

        console.log('Using cache key:', cacheKey);

        // Try Redis first
        if (redis) {
            try {
                console.log('Testing Redis connection...');
                await redis.ping();
                console.log('Redis connection test successful');

                console.log('Fetching data from Redis...');
                const redisData = await redis.get(cacheKey);
                console.log('Redis response:', {
                    hasData: !!redisData,
                    type: typeof redisData,
                    sample: redisData ? JSON.stringify(redisData).substring(0, 100) + '...' : null
                });

                if (redisData) {
                    const data = typeof redisData === 'string' ? JSON.parse(redisData) : redisData;
                    if (data && data.prices && Array.isArray(data.prices)) {
                        console.log('Valid data found in Redis');
                        return res.json(data);
                    } else {
                        console.log('Invalid data structure in Redis response');
                    }
                } else {
                    console.log('No data found in Redis');
                }
            } catch (error) {
                console.error('Redis operation failed:', {
                    error: error.message,
                    stack: error.stack
                });
            }
        } else {
            console.log('Redis instance not available');
        }

        // Fall back to static data
        console.log('Falling back to static data');
        const dataPath = path.join(process.cwd(), 'public', 'data', 'price-data.json');
        const fileData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const data = fileData[token]?.[timeRange];

        if (!data || !data.prices || !Array.isArray(data.prices)) {
            console.error('Invalid data structure in static data');
            return res.status(404).json({
                error: 'Data not found',
                details: { timeRange, token, dataset }
            });
        }

        return res.json(data);
    } catch (error) {
        console.error('API Error:', {
            error: error.message,
            stack: error.stack,
            redisConfig: {
                hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
                hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN
            }
        });

        return res.status(500).json({ 
            error: error.message,
            details: 'Check server logs for more information'
        });
    }
}