import { Redis } from '@upstash/redis';
import * as readline from 'readline';
import * as dotenv from 'dotenv';

dotenv.config();

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function inspectRedis() {
    try {
        // Get all keys
        const keys = await redis.keys('*');
        console.log('\nFound keys:', keys);

        // For each key, get a sample of the data
        for (const key of keys) {
            const data = await redis.get(key);
            console.log(`\nKey: ${key}`);
            console.log('Raw data:', data); // Log the raw data
            
            if (data) {
                try {
                    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                    console.log('Parsed data structure:', {
                        type: typeof parsed,
                        hasPrices: !!parsed.prices,
                        hasMarketCaps: !!parsed.market_caps,
                        pricesLength: parsed.prices?.length,
                        firstPrice: parsed.prices?.[0],
                        lastPrice: parsed.prices?.[parsed.prices?.length - 1]
                    });
                } catch (e) {
                    console.log(`Error parsing data for key ${key}:`, e);
                }
            }
        }
    } catch (error) {
        console.error('Error inspecting Redis:', error);
    }
}

inspectRedis()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 