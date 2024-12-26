import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate environment variables first
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('\nMissing required environment variables:');
    if (!process.env.UPSTASH_REDIS_REST_URL) console.error('- UPSTASH_REDIS_REST_URL');
    if (!process.env.UPSTASH_REDIS_REST_TOKEN) console.error('- UPSTASH_REDIS_REST_TOKEN');
    process.exit(1);
}

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function viewRedisContent() {
    try {
        // Get all keys
        const keys = await redis.keys('*');
        console.log('\nFound Redis keys:', keys);
        
        if (keys.length === 0) {
            console.log('\nNo data in Redis. The cache might be empty or cleared.');
            return;
        }

        // Show content for each key
        console.log('\nContent for each key:');
        for (const key of keys) {
            const value = await redis.get(key);
            console.log(`\nKey: ${key}`);
            console.log('Value:', JSON.stringify(value, null, 2));
        }
    } catch (error) {
        console.error('Error viewing Redis content:', error);
    }
}

viewRedisContent().catch(console.error); 