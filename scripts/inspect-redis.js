import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function inspectKeys() {
    try {
        // Get all keys
        const keys = await redis.keys('*');
        console.log('Found keys:', keys);
    } catch (error) {
        console.error('Error:', error);
    }
}

inspectKeys(); 