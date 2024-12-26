import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function inspectKeys() {
    try {
        const key = 'price_data_All-time_hype';
        const data = await redis.get(key);
        
        if (!data) {
            console.log('No data found for key:', key);
            return;
        }

        // If data is a string, try to parse it
        let parsedData = typeof data === 'string' ? JSON.parse(data) : data;

        // Show data structure
        console.log('Data type:', typeof data);
        console.log('Is Array:', Array.isArray(parsedData));
        
        if (Array.isArray(parsedData)) {
            console.log('Array length:', parsedData.length);
            console.log('First 3 items:', parsedData.slice(0, 3));
            console.log('Last item:', parsedData[parsedData.length - 1]);
        } else {
            console.log('Data structure:', parsedData);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

inspectKeys(); 