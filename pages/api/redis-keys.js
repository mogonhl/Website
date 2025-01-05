import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
    try {
        // Get all keys
        const keys = await redis.keys('*');
        console.log('Redis keys:', keys);

        // Get spot_data_daily_index specifically
        const indexData = await redis.get('spot_data_daily_index');
        console.log('spot_data_daily_index data:', indexData);

        return res.json({ 
            keys,
            indexData: indexData ? 'exists' : 'not found'
        });
    } catch (error) {
        console.error('Error listing Redis keys:', error);
        return res.status(500).json({ error: error.message });
    }
} 