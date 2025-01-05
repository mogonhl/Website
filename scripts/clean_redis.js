const { Redis } = require('@upstash/redis');
require('dotenv').config();

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function cleanRedis() {
    try {
        // Get all keys
        const keys = await redis.keys('*');
        console.log('Found keys:', keys);

        // Delete spot data keys
        for (const key of keys) {
            if (key.startsWith('spot_data_')) {
                await redis.del(key);
                console.log(`Deleted key: ${key}`);
            }
        }

        console.log('Cleanup complete!');
    } catch (error) {
        console.error('Error cleaning Redis:', error);
    }
}

cleanRedis().catch(console.error); 