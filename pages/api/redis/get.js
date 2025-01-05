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
        const { key } = req.query;
        if (!key) {
            return res.status(400).json({ error: 'Key parameter is required' });
        }

        const value = await redis.get(key);
        if (value === null) {
            return res.status(404).json({ error: 'Key not found' });
        }

        // If the value is a string that looks like JSON, parse it
        if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
            try {
                return res.json(JSON.parse(value));
            } catch {
                return res.json(value);
            }
        }

        return res.json(value);
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: error.message,
            details: 'Check server logs for more information'
        });
    }
} 