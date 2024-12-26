const { Redis } = require('@upstash/redis');
require('dotenv').config();

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function viewLogs() {
    try {
        console.log('\nFetching Redis operation logs...');
        const logs = await redis.lrange('redis_operation_log', 0, -1);
        
        if (!logs || logs.length === 0) {
            console.log('No operation logs found.');
            return;
        }

        console.log(`\nFound ${logs.length} operations:\n`);
        
        logs.forEach((log, index) => {
            try {
                const entry = typeof log === 'string' ? JSON.parse(log) : log;
                console.log(`[${index + 1}] ${entry.timestamp}`);
                console.log(`Operation: ${entry.operation}`);
                console.log('Details:', JSON.stringify(entry.details, null, 2));
                console.log('-'.repeat(80) + '\n');
            } catch (parseError) {
                console.log(`[${index + 1}] Error parsing log entry:`, log);
                console.log(`Parse error: ${parseError.message}`);
                console.log('-'.repeat(80) + '\n');
            }
        });

    } catch (error) {
        console.error('Error viewing logs:', error);
    }
}

viewLogs().catch(console.error); 