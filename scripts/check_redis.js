const { Redis } = require('@upstash/redis');
require('dotenv').config();

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function checkRedis() {
    try {
        // Get all keys
        const keys = await redis.keys('*');
        console.log('\nAll Redis keys:', keys);

        // Specifically check HYPE data
        const hypeData24h = await redis.get('price_data_24H_hype');
        const hypeData7d = await redis.get('price_data_7D_hype');
        const hypeData30d = await redis.get('price_data_30D_hype');
        const hypeDataAllTime = await redis.get('price_data_All-time_hype');

        console.log('\nHYPE data check:');
        console.log('24H data exists:', !!hypeData24h);
        console.log('7D data exists:', !!hypeData7d);
        console.log('30D data exists:', !!hypeData30d);
        console.log('All-time data exists:', !!hypeDataAllTime);

        if (hypeData24h) {
            const parsed = JSON.parse(hypeData24h);
            console.log('\n24H data details:');
            console.log('Has prices:', !!parsed.prices);
            console.log('Number of price points:', parsed.prices?.length);
            console.log('Latest price:', parsed.prices?.[parsed.prices.length - 1]);
            console.log('Has volumes:', !!parsed.total_volumes);
            console.log('Latest volume:', parsed.total_volumes?.[parsed.total_volumes.length - 1]);
        }

    } catch (error) {
        console.error('Error checking Redis:', error);
    }
}

checkRedis().catch(console.error); 