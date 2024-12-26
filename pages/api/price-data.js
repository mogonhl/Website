import path from 'path';
import fs from 'fs';

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

    try {
        console.log('API Request:', { timeRange, token });

        const cacheKey = `${token}_${timeRange}`;

        // Check memory cache first
        const cachedItem = memoryCache.get(cacheKey);
        if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_DURATION) {
            console.log('Serving from memory cache:', cacheKey);
            return res.json(cachedItem.data);
        }

        // Read the static data file
        const dataPath = path.join(process.cwd(), 'public', 'data', 'price-data.json');
        const fileData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        // Get data for specific token and timeRange
        if (!fileData[token] || !fileData[token][timeRange]) {
            return res.status(404).json({
                error: 'Data not found',
                details: { token, timeRange }
            });
        }

        const data = fileData[token][timeRange];

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
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}