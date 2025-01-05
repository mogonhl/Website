const Redis = require('ioredis');

let redis = null;
let isConnecting = false;
let connectionTimeout = null;

async function getRedisClient() {
    if (redis) return redis;
    if (isConnecting) return null;

    try {
        isConnecting = true;
        clearTimeout(connectionTimeout);

        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 2,
            connectTimeout: 5000,
            enableReadyCheck: true,
        });

        // Set up event handlers
        redis.on('error', (err) => {
            console.error('Redis connection error:', err);
            redis = null;
            isConnecting = false;
        });

        redis.on('connect', () => {
            console.log('Connected to Redis');
            isConnecting = false;
        });

        // Test the connection
        await redis.ping();
        return redis;
    } catch (error) {
        console.error('Failed to create Redis client:', error);
        redis = null;
        isConnecting = false;

        // Set a timeout to clear the connection state
        connectionTimeout = setTimeout(() => {
            isConnecting = false;
        }, 5000);

        return null;
    }
}

module.exports = async function handler(req, res) {
    const { tokenId } = req.query;
    if (!tokenId) {
        return res.status(400).json({ error: 'Token ID is required' });
    }

    try {
        const client = await getRedisClient();
        if (!client) {
            return res.status(503).json({ 
                error: 'Redis service temporarily unavailable',
                retry: true
            });
        }

        // Convert hex tokenId to number for Redis key lookup
        const numericId = parseInt(tokenId.replace('0x', ''), 16);
        const chunkIndex = Math.floor(numericId / 20);
        const key = `spot_data_7d_${chunkIndex}`;

        try {
            // Get data from Redis with timeout
            const data = await Promise.race([
                client.get(key),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Redis timeout')), 3000)
                )
            ]);

            if (!data) {
                return res.status(404).json({ 
                    error: 'No data found for this token',
                    details: { key, tokenId, numericId, chunkIndex }
                });
            }

            // Parse the data and find the specific token
            const chunkData = JSON.parse(data);
            const tokenData = chunkData.find(t => t.tokenId === tokenId);

            if (!tokenData) {
                return res.status(404).json({ 
                    error: 'Token not found in chunk',
                    details: { key, tokenId, numericId, chunkIndex }
                });
            }

            res.status(200).json(tokenData);
        } catch (error) {
            if (error.message === 'Redis timeout') {
                return res.status(503).json({ 
                    error: 'Redis operation timed out',
                    retry: true
                });
            }
            throw error;
        }
    } catch (error) {
        console.error('Error in snapshot-data handler:', error);
        res.status(500).json({ 
            error: 'Failed to fetch snapshot data',
            details: error.message,
            retry: true
        });
    }
}; 