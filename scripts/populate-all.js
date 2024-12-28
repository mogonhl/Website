const { Redis } = require('@upstash/redis');
const fetch = require('node-fetch');
require('dotenv').config();

// Token configurations
const TOKENS = {
    'HYPE': {
        coingeckoId: 'hyperliquid',
        symbol: 'HYPE'
    },
    'ARB': {
        coingeckoId: 'arbitrum',
        symbol: 'ARB'
    },
    'FRIEND': {
        coingeckoId: 'friend-tech',
        symbol: 'FRIEND'
    },
    'JTO': {
        coingeckoId: 'jito-governance-token',
        symbol: 'JTO'
    },
    'ME': {
        coingeckoId: 'magic-eden',
        symbol: 'ME'
    },
    'PENGU': {
        coingeckoId: 'pudgy-penguins',
        symbol: 'PENGU'
    },
    'UNI': {
        coingeckoId: 'uniswap',
        symbol: 'UNI'
    },
    'TIA': {
        coingeckoId: 'celestia',
        symbol: 'TIA'
    },
    'ENS': {
        coingeckoId: 'ethereum-name-service',
        symbol: 'ENS'
    },
    'JUP': {
        coingeckoId: 'jupiter-exchange-solana',
        symbol: 'JUP'
    },
    'WEN': {
        coingeckoId: 'wen-4',
        symbol: 'WEN'
    },
    'AEVO': {
        coingeckoId: 'aevo-exchange',
        symbol: 'AEVO'
    },
    'ENA': {
        coingeckoId: 'ethena',
        symbol: 'ENA'
    },
    'W': {
        coingeckoId: 'wormhole',
        symbol: 'W'
    },
    'ETHFI': {
        coingeckoId: 'ether-fi',
        symbol: 'ETHFI'
    },
    'ZRO': {
        coingeckoId: 'layerzero',
        symbol: 'ZRO'
    },
    'STRK': {
        coingeckoId: 'starknet',
        symbol: 'STRK'
    },
    'EIGEN': {
        coingeckoId: 'eigenlayer',
        symbol: 'EIGEN'
    },
    'DBR': {
        coingeckoId: 'debridge',
        symbol: 'DBR'
    }
};

// Get tokens to process from command line arguments
const tokensToProcess = process.argv.slice(2).map(t => t.toUpperCase());
const NEW_TOKENS = ['ENA', 'W', 'ETHFI', 'ZRO', 'STRK', 'EIGEN', 'DBR'];

if (tokensToProcess.length === 0) {
    console.log('No tokens specified, using default list of all tokens...');
    tokensToProcess.push(...Object.keys(TOKENS));
} else {
    // Validate tokens
    for (const token of tokensToProcess) {
        if (!TOKENS[token]) {
            console.error(`Invalid token: ${token}`);
            console.error('Available tokens:', Object.keys(TOKENS).join(', '));
            process.exit(1);
        }
    }
}

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

async function fetchWithDelay(tokenId, timeRange) {
    console.log(`\nFetching ${tokenId} data for ${timeRange}...`);
    
    // Increase base delay to 12 seconds between requests (5 requests per minute)
    await new Promise(resolve => setTimeout(resolve, 12000));
    
    const url = `https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart?vs_currency=usd&days=${timeRange}`;
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 429) {
                console.log('Rate limit hit, waiting 2 minutes...');
                await new Promise(resolve => setTimeout(resolve, 120000));
                return fetchWithDelay(tokenId, timeRange); // Retry after waiting
            }
            
            // For 404s, try with a different date range format
            if (response.status === 404) {
                console.log('404 error for URL:', url);
                console.log('Trying alternative date format...');
                const altUrl = `https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart?vs_currency=usd&days=${timeRange === '365' ? 'max' : timeRange}`;
                console.log('Alternative URL:', altUrl);
                const altResponse = await fetch(altUrl);
                if (altResponse.ok) {
                    return await altResponse.json();
                }
            }
            
            throw new Error(`HTTP error! status: ${response.status} for URL: ${url}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${tokenId} for ${timeRange}:`);
        console.error('Failed URL:', url);
        console.error('Error details:', error.message);
        throw error;
    }
}

async function fetchTVLWithDelay(timeRange) {
    console.log(`\nFetching HYPE TVL data for ${timeRange}...`);
    
    // Add a delay between requests
    await new Promise(resolve => setTimeout(resolve, 6500));
    
    const response = await fetch(
        `https://api.llama.fi/v2/historicalChainTvl/Hyperliquid`
    );
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
        throw new Error('Invalid TVL data format from DeFiLlama');
    }
    
    const now = Math.floor(Date.now() / 1000);
    const secondsPerDay = 24 * 60 * 60;
    
    const timeRangeSecs = {
        '7': 7 * secondsPerDay,
        '30': 30 * secondsPerDay,
        '365': 365 * secondsPerDay
    }[timeRange] || 365 * secondsPerDay;
    
    // Filter and transform the data
    const filteredTvl = data
        .filter(item => (now - item.date) <= timeRangeSecs)
        .map(item => ({
            date: item.date,
            tvl: item.tvl
        }));

    if (filteredTvl.length === 0) {
        throw new Error('No TVL data available for the specified time range');
    }

    // Sort TVL data by timestamp
    filteredTvl.sort((a, b) => a.date - b.date);
    return filteredTvl; // Return array of {date, tvl} objects
}

async function checkRedisData(symbol, timeRange) {
    const cacheKey = `price_data_${timeRange}_${symbol.toLowerCase()}`;
    try {
        const data = await redis.get(cacheKey);
        return data !== null;
    } catch (error) {
        console.error(`Error checking Redis data for ${cacheKey}:`, error.message);
        return false;
    }
}

async function populateToken(symbol) {
    const token = TOKENS[symbol];
    if (!token) {
        console.error(`Token ${symbol} not found!`);
        return;
    }

    console.log(`\n=== Starting population for ${symbol} ===`);

    // Different time ranges for price and TVL data
    const priceTimeRanges = [
        { days: '1', key: '24H' },
        { days: '7', key: '7D' },
        { days: '30', key: '30D' },
        { days: '365', key: 'All-time' }
    ];

    // Handle price data first
    for (const range of priceTimeRanges) {
        const cacheKey = `price_data_${range.key}_${symbol.toLowerCase()}`;
        
        // Check if data already exists
        const hasData = await checkRedisData(symbol, range.key);
        if (hasData) {
            console.log(`Data already exists for ${cacheKey}, skipping...`);
            continue;
        }

        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                console.log(`\nProcessing ${symbol} for ${range.key} (attempt ${retryCount + 1}/${maxRetries})`);
                
                const data = await fetchWithDelay(token.coingeckoId, range.days);
                if (!data || !data.prices || data.prices.length === 0) {
                    throw new Error('Invalid data received from CoinGecko');
                }

                console.log('Sample of data to be stored:', {
                    type: typeof data,
                    keys: Object.keys(data),
                    samplePrice: data.prices?.[0],
                    dataPoints: data.prices?.length
                });

                await redis.set(cacheKey, JSON.stringify(data), { ex: 86400 });
                console.log(`Successfully populated ${cacheKey}`);
                break; // Success, exit retry loop
                
            } catch (error) {
                console.error(`Error populating ${cacheKey} (attempt ${retryCount + 1}/${maxRetries}):`, error.message);
                retryCount++;
                
                if (retryCount < maxRetries) {
                    const waitTime = retryCount * 30000; // Wait longer for each retry
                    console.log(`Waiting ${waitTime/1000} seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    console.log(`Failed to populate ${cacheKey} after ${maxRetries} attempts, moving on...`);
                    break;
                }
            }
        }
    }
}

// Main execution
console.log('Starting population for specified tokens:', tokensToProcess.join(', '));

(async () => {
    for (const symbol of tokensToProcess) {
        await populateToken(symbol);
        // Wait 1 minute between tokens to avoid rate limits
        if (tokensToProcess.indexOf(symbol) !== tokensToProcess.length - 1) {
            console.log('\nWaiting 1 minute before next token...');
            await new Promise(resolve => setTimeout(resolve, 60000));
        }
    }
    console.log('\nPopulation complete!');
})(); 