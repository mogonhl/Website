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
        // Special handling for INDEX token
        if (token === 'INDEX') {
            try {
                console.log('Fetching INDEX data from Redis...');
                const indexData = await redis.get('spot_data_daily_index');
                console.log('Raw INDEX data:', indexData);
                
                if (indexData) {
                    const data = typeof indexData === 'string' ? JSON.parse(indexData) : indexData;
                    console.log('Parsed INDEX data:', data);
                    
                    // The data should be an object with prices array
                    if (data && data.prices && Array.isArray(data.prices)) {
                        // Get the most recent timestamp from the data
                        const latestTimestamp = Math.max(...data.prices.map(([timestamp]) => timestamp));
                        console.log('Latest timestamp:', new Date(latestTimestamp).toISOString());

                        // Filter data based on timeRange from the latest timestamp
                        const timeRangeMs = {
                            '24H': 24 * 60 * 60 * 1000,
                            '7D': 7 * 24 * 60 * 60 * 1000,
                            '30D': 30 * 24 * 60 * 60 * 1000
                        }[timeRange] || 0;

                        const filteredPrices = timeRange === 'All-time' 
                            ? data.prices 
                            : data.prices.filter(([timestamp]) => timestamp >= latestTimestamp - timeRangeMs);

                        console.log(`Filtered ${filteredPrices.length} price points for ${timeRange}`);
                        return res.json({
                            prices: filteredPrices
                        });
                    }
                }
                console.log('No valid INDEX data found');
                throw new Error('Index data not found or invalid format');
            } catch (error) {
                console.error('Redis error for INDEX:', error);
                return res.status(404).json({
                    error: 'Index data not found',
                    details: { timeRange, token, dataset, message: error.message }
                });
            }
        }

        // For other tokens, try Redis first
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