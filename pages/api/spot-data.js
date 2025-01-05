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

    try {
        // List all keys to debug
        const allKeys = await redis.keys('price_data_*');
        console.log('Available price data keys:', allKeys);

        // Get all price data for 24H
        const priceData = [];
        for (const key of allKeys) {
            if (key.startsWith('price_data_24H_')) {
                const data = await redis.get(key);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        const token = key.replace('price_data_24H_', '');
                        priceData.push({
                            tokenId: token,
                            ...parsed
                        });
                    } catch (parseError) {
                        console.error(`Error parsing data for ${key}:`, parseError);
                    }
                }
            }
        }

        if (priceData.length === 0) {
            return res.status(404).json({ 
                error: 'No price data found',
                availableKeys: allKeys
            });
        }

        console.log('Total tokens in response:', priceData.length);
        return res.json(priceData);
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: error.message,
            details: 'Check server logs for more information'
        });
    }
} 