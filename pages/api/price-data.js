import path from 'path';
import fs from 'fs';
const { Redis } = require('@upstash/redis');

// Create a single Redis instance
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    automaticDeserialization: true,
    retry: 1 // Only retry once
});

// In-memory cache with 5-minute expiry
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const memoryCache = new Map();

// Helper function to add timeout to promises
const withTimeout = (promise, timeoutMs = 2000) => {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error('Operation timed out'));
        }, timeoutMs);
    });

    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => {
        clearTimeout(timeoutHandle);
    });
};

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
        const cacheKey = dataset === 'dataset2' 
            ? `tvl_data_${timeRange}_${token.toLowerCase()}`
            : `price_data_${timeRange}_${token.toLowerCase()}`;

        // Check memory cache first
        const cachedItem = memoryCache.get(cacheKey);
        if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_DURATION) {
            console.log('Serving from memory cache:', cacheKey);
            return res.json(cachedItem.data);
        }

        // Try Redis with timeout
        let data;
        try {
            console.log('Attempting Redis get for:', cacheKey);
            const redisData = await withTimeout(redis.get(cacheKey));
            if (redisData) {
                data = typeof redisData === 'string' ? JSON.parse(redisData) : redisData;
                console.log('Redis data retrieved successfully');
            }
        } catch (error) {
            console.error('Redis operation failed:', error.message);
        }

        // Fall back to static data if Redis fails or returns no data
        if (!data) {
            console.log('Falling back to static data');
            const dataPath = path.join(process.cwd(), 'public', 'data', 'price-data.json');
            const fileData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            data = fileData[token]?.[timeRange];
        }

        if (!data || !data.prices || !Array.isArray(data.prices)) {
            console.error('Invalid data structure');
            return res.status(404).json({
                error: 'Data not found',
                details: { timeRange, token, dataset }
            });
        }

        // Update memory cache
        memoryCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        return res.json(data);
    } catch (error) {
        console.error('API Error:', error);
        // Try to return static data even if there's an error
        try {
            const dataPath = path.join(process.cwd(), 'public', 'data', 'price-data.json');
            const fileData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            const data = fileData[token]?.[timeRange];
            if (data) {
                return res.json(data);
            }
        } catch (fallbackError) {
            console.error('Static fallback failed:', fallbackError);
        }

        return res.status(500).json({ 
            error: error.message
        });
    }
}