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
        const { timeRange, type = 'snipe' } = req.query;
        
        // Map index type to Redis key
        const keyMap = {
            'snipe': 'spot_data_snipe_index',
            'mcap': 'spot_data_mcap_index',
            'mcap-ex-hype': 'spot_data_mcap_ex_hype_index',
            'volume': 'spot_data_volume_index',
            'equal': 'spot_data_equal_index'
        };
        
        const key = keyMap[type] || 'spot_data_snipe_index';
        
        console.log(`Fetching index data for ${timeRange}, type: ${type}...`);
        const indexData = await redis.get(key);
        console.log('Raw index data:', indexData);

        if (!indexData) {
            return res.status(404).json({
                error: 'Index data not found',
                details: { timeRange, key }
            });
        }

        const data = typeof indexData === 'string' ? JSON.parse(indexData) : indexData;
        console.log('Parsed index data:', {
            hasPrices: !!data.prices,
            numPrices: data.prices?.length,
            hasBestPerformer: !!data.bestPerformer,
            bestPerformerTicker: data.bestPerformer?.ticker,
            bestPerformerReturn: data.bestPerformer?.return_pct
        });

        // The index data should already be in the correct format with prices array
        if (!data.prices || !Array.isArray(data.prices)) {
            return res.status(500).json({
                error: 'Invalid index data format'
            });
        }

        // Return both prices and performer data
        return res.json({
            prices: data.prices,
            bestPerformer: data.bestPerformer,
            secondBestPerformer: data.secondBestPerformer,
            thirdBestPerformer: data.thirdBestPerformer
        });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: error.message,
            details: 'Check server logs for more information'
        });
    }
} 