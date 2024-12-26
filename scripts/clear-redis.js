const { Redis } = require('@upstash/redis');
const readline = require('readline');
require('dotenv').config();

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

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function getUserInput(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.toLowerCase());
        });
    });
}

async function clearRedis() {
    try {
        // Get all keys
        const keys = await redis.keys('*');
        console.log('\nFound keys:', keys);
        
        const answer = await getUserInput('\nAre you sure you want to delete these keys? (yes/no): ');
        
        if (answer === 'yes') {
            // Delete all keys
            for (const key of keys) {
                await redis.del(key);
                console.log(`Deleted ${key}`);
            }
            console.log('\nRedis cleared successfully!');
        } else {
            console.log('\nOperation cancelled.');
        }
    } catch (error) {
        console.error('Error clearing Redis:', error);
    } finally {
        rl.close();
    }
}

clearRedis().catch(console.error); 