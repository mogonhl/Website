const { Redis } = require('@upstash/redis');

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

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

        console.log('Fetching key:', cacheKey);
        const cachedData = await redis.get(cacheKey);
        
        if (!cachedData) {
            console.log('No data found for:', cacheKey);
            return res.status(404).json({ 
                error: 'Data not found in cache',
                details: { timeRange, token, dataset, cacheKey }
            });
        }

        // Handle the case where Redis returns an object directly
        const data = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        
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