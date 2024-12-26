const { Redis } = require('@upstash/redis');

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
    const timeRange = req.query.timeRange || '24H';
    const token = req.query.token || 'HYPE';
    const dataset = req.query.dataset || 'dataset1';

    try {
        const cacheKey = dataset === 'dataset2' 
            ? `tvl_data_${timeRange}_${token.toLowerCase()}`
            : `price_data_${timeRange}_${token.toLowerCase()}`;

        console.log('Fetching key:', cacheKey);
        const cachedData = await redis.get(cacheKey);
        
        if (!cachedData) {
            console.log('No data found for:', cacheKey);
            return res.status(404).json({ error: 'Data not found in cache' });
        }

        // Handle the case where Redis returns an object directly
        const data = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        
        console.log('Data type:', typeof data);
        console.log('Data structure:', {
            isObject: typeof data === 'object',
            hasData: !!data,
            keys: Object.keys(data)
        });

        return res.json(data);
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
}