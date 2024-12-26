const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Validate environment variables
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN || !process.env.CRON_SECRET) {
    console.error('\nMissing required environment variables:');
    if (!process.env.UPSTASH_REDIS_REST_URL) console.error('- UPSTASH_REDIS_REST_URL');
    if (!process.env.UPSTASH_REDIS_REST_TOKEN) console.error('- UPSTASH_REDIS_REST_TOKEN');
    if (!process.env.CRON_SECRET) console.error('- CRON_SECRET');
    process.exit(1);
}

const TOKENS = {
    HYPE: 'hyperliquid',
    ARB: 'arbitrum',
    FRIEND: 'friend-tech',
    JTO: 'jito-governance-token',
    ME: 'magic-eden',
    PENGU: 'pudgy-penguins',
    UNI: 'uniswap'
};

const TIME_RANGES = ['24H', '7D', '30D', 'All-time'];

async function populateCache() {
    try {
        console.log('Starting cache population...');
        
        for (const [symbol, coingeckoId] of Object.entries(TOKENS)) {
            console.log(`\nProcessing token: ${symbol} (${coingeckoId})`);
            
            for (const timeRange of TIME_RANGES) {
                console.log(`  Fetching ${timeRange} data...`);
                
                try {
                    const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/update-cache?timeRange=${timeRange}&token=${coingeckoId}`, {
                        headers: {
                            'Authorization': `Bearer ${process.env.CRON_SECRET}`
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const result = await response.json();
                    console.log(`  ✓ ${timeRange} data cached successfully`);
                } catch (error) {
                    console.error(`  ✗ Error caching ${timeRange} data:`, error.message);
                }
                
                // Add a delay between requests to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log('\nCache population complete!');
    } catch (error) {
        console.error('Error populating cache:', error);
    }
}

populateCache().catch(console.error); 