import path from 'path';
import fs from 'fs';
const { Redis } = require('@upstash/redis');

// Create a single Redis instance
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    automaticDeserialization: true
});

// In-memory cache with 5-minute expiry
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const memoryCache = new Map();

// Helper function to retry Redis operations
async function retryOperation(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error);
            if (attempt === maxRetries) throw error;
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 3000)));
        }
    }
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
        // Debug Redis connection
        console.log('Redis config:', {
            hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
            hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
            urlPrefix: process.env.UPSTASH_REDIS_REST_URL?.substring(0, 20) + '...'
        });

        console.log('API Request:', { timeRange, token, dataset });

        const cacheKey = dataset === 'dataset2' 
            ? `tvl_data_${timeRange}_${token.toLowerCase()}`
            : `price_data_${timeRange}_${token.toLowerCase()}`;

        // Check memory cache first
        const cachedItem = memoryCache.get(cacheKey);
        if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_DURATION) {
            console.log('Serving from memory cache:', cacheKey);
            return res.json(cachedItem.data);
        }

        console.log('Fetching from Redis:', cacheKey);
        
        // Test Redis connection first
        try {
            await redis.ping();
            console.log('Redis connection successful');
        } catch (error) {
            console.error('Redis connection test failed:', error);
            throw new Error('Redis connection failed');
        }

        // Use retry operation for Redis get
        const cachedData = await retryOperation(async () => {
            console.log('Attempting Redis get for key:', cacheKey);
            const data = await redis.get(cacheKey);
            console.log('Redis response:', {
                hasData: !!data,
                type: typeof data,
                sample: data ? JSON.stringify(data).substring(0, 100) + '...' : null
            });
            if (!data) {
                throw new Error('No data found in Redis');
            }
            return data;
        }).catch(error => {
            console.error('Redis operation failed:', error);
            // Fall back to static data if Redis fails
            console.log('Falling back to static data');
            const dataPath = path.join(process.cwd(), 'public', 'data', 'price-data.json');
            const fileData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            return fileData[token]?.[timeRange];
        });

        if (!cachedData) {
            console.log('No data found for:', cacheKey);
            return res.status(404).json({ 
                error: 'Data not found in cache',
                details: { timeRange, token, dataset, cacheKey }
            });
        }

        // Parse data if it's a string
        const data = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        
        // Validate data structure
        if (!data || !data.prices || !Array.isArray(data.prices)) {
            console.error('Invalid data structure:', data);
            return res.status(500).json({
                error: 'Invalid data structure',
                details: { hasData: !!data, type: typeof data }
            });
        }

        // Update memory cache
        memoryCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        console.log('Data retrieved successfully:', {
            token,
            timeRange,
            sampleSize: data.prices?.length
        });

        return res.json(data);
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            details: {
                hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
                hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN
            }
        });
    }
}