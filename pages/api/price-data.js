import path from 'path';
import fs from 'fs';
import { Redis } from '@upstash/redis';

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
        // Try Redis first
        const cacheKey = dataset === 'dataset2' 
            ? `tvl_data_${timeRange}_${token.toLowerCase()}`
            : `price_data_${timeRange}_${token.toLowerCase()}`;

        try {
            const redisData = await redis.get(cacheKey);
            if (redisData) {
                const data = typeof redisData === 'string' ? JSON.parse(redisData) : redisData;
                if (data && data.prices && Array.isArray(data.prices)) {
                    return res.json(data);
                }
            }
        } catch (error) {
            console.error('Redis error:', error);
        }

        // Fall back to static data
        const dataPath = path.join(process.cwd(), 'public', 'data', 'price-data.json');
        const fileData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const data = fileData[token]?.[timeRange];

        if (!data || !data.prices || !Array.isArray(data.prices)) {
            return res.status(404).json({
                error: 'Data not found',
                details: { timeRange, token, dataset }
            });
        }

        return res.json(data);
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: error.message,
            details: 'Check server logs for more information'
        });
    }
}