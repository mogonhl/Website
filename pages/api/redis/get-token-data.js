import { Redis } from '@upstash/redis';

// Log Redis connection details (without tokens)
console.log('API Route: get-token-data called');
console.log('Redis URL available:', !!process.env.UPSTASH_REDIS_REST_URL);
console.log('Redis token available:', !!process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    console.log('Request received:', {
        method: req.method,
        query: req.query,
        headers: req.headers
    });

    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { token } = req.query;

    if (!token) {
        console.log('No token provided in request');
        return res.status(400).json({ error: 'Token parameter is required' });
    }

    try {
        // Test Redis connection first
        try {
            const pingResult = await redis.ping();
            console.log('Redis connection test:', { pingResult });
        } catch (pingError) {
            console.error('Redis connection failed:', pingError);
            return res.status(500).json({ 
                error: 'Redis connection failed',
                details: pingError.message
            });
        }

        // List all keys to see what's available
        const allKeys = await redis.keys('*');
        console.log('Available Redis keys:', allKeys);
        
        // Get price data from Redis using the correct key format
        const cacheKey = `price_data_All-time_${token.toLowerCase()}`;
        console.log('Attempting to fetch key:', cacheKey);
        
        const data = await redis.get(cacheKey);
        console.log('Raw Redis data type:', typeof data);
        console.log('Raw Redis data:', data ? 'Data exists' : 'No data found');
        
        if (!data) {
            console.log('No data found for key:', cacheKey);
            console.log('Available keys were:', allKeys);
            return res.status(404).json({ error: 'No price data found for token' });
        }

        // Check if data is already an object
        let parsedData = data;
        if (typeof data === 'string') {
            try {
                parsedData = JSON.parse(data);
                console.log('Successfully parsed data');
            } catch (parseError) {
                console.error('Failed to parse data:', parseError);
                return res.status(500).json({ 
                    error: 'Invalid data format',
                    details: parseError.message
                });
            }
        }
        
        if (!parsedData || !parsedData.prices || !Array.isArray(parsedData.prices)) {
            console.log('Invalid data format:', parsedData);
            return res.status(404).json({ error: 'Invalid price data format' });
        }

        console.log('Successfully retrieved and validated data');
        res.setHeader('Cache-Control', 's-maxage=60');
        res.status(200).json(parsedData);
    } catch (error) {
        console.error('Redis error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ 
            error: 'Failed to fetch price data',
            details: error.message
        });
    }
} 