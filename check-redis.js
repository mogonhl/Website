require('dotenv').config();
const { Redis } = require('@upstash/redis');

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function checkRedis() {
    try {
        console.log('Testing Redis connection...');
        await redis.ping();
        console.log('Redis connection successful!\n');

        console.log('Fetching all keys...');
        const keys = await redis.keys('*');
        console.log(`Found ${keys.length} keys:\n`, keys);

        // Try to get the specific key we're having trouble with
        const testKey = 'price_data_7D_hype';
        console.log(`\nTrying to fetch specific key: ${testKey}`);
        const data = await redis.get(testKey);
        console.log('Data for key:', data ? 'Found' : 'Not found');
        if (data) {
            console.log('Sample of data:', data.slice(0, 200) + '...');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

checkRedis(); 