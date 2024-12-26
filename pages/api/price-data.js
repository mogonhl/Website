const { Redis } = require('@upstash/redis');

// Create a single Redis instance
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    automaticDeserialization: true,
    retry: {
        retries: 3,
        backoff: {
            min: 100,
            max: 3000
        }
    }
});

// In-memory cache with 5-minute expiry
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const memoryCache = new Map();

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
        const cachedData = await redis.get(cacheKey);
        
        if (!cachedData) {
            console.log('No data found for:', cacheKey);
            return res.status(404).json({ 
                error: 'Data not found in cache',
                details: { timeRange, token, dataset, cacheKey }
            });
        }

        // Parse data if it's a string
        const data = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        
        // Update memory cache
        memoryCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        console.log('Data retrieved successfully:', {
            type: typeof data,
            hasData: !!data,
            keys: Object.keys(data),
            sampleSize: data.prices?.length
        });

        return res.json(data);
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}