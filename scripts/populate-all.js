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
    }
};

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

    const tvlTimeRanges = [
        { days: '7', key: '7D' },
        { days: '30', key: '30D' },
        { days: '365', key: 'All-time' }
    ];
    
    // Handle price data first
    for (const range of priceTimeRanges) {
        const cacheKey = `price_data_${range.key}_${symbol.toLowerCase()}`;
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

    // Handle TVL data for HYPE separately
    if (symbol === 'HYPE') {
        for (const range of tvlTimeRanges) {
            const tvlCacheKey = `tvl_data_${range.key}_${symbol.toLowerCase()}`;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    console.log(`\nProcessing ${symbol} TVL data for ${range.key} (attempt ${retryCount + 1}/${maxRetries})`);
                    
                    const tvlData = await fetchTVLWithDelay(range.days);
                    if (!Array.isArray(tvlData) || tvlData.length === 0) {
                        throw new Error('Invalid TVL data received from DeFiLlama');
                    }

                    console.log('TVL data to be stored:', {
                        type: typeof tvlData,
                        isArray: Array.isArray(tvlData),
                        sampleTVL: tvlData.slice(0, 2),
                        dataPoints: tvlData.length
                    });

                    await redis.set(tvlCacheKey, JSON.stringify(tvlData), { ex: 86400 });
                    console.log(`Successfully populated ${tvlCacheKey}`);
                    break; // Success, exit retry loop
                    
                } catch (error) {
                    console.error(`Error populating TVL data (attempt ${retryCount + 1}/${maxRetries}):`, error.message);
                    retryCount++;
                    
                    if (retryCount < maxRetries) {
                        const waitTime = retryCount * 30000; // Wait longer for each retry
                        console.log(`Waiting ${waitTime/1000} seconds before retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    } else {
                        console.log(`Failed to populate TVL data after ${maxRetries} attempts, moving on...`);
                        break;
                    }
                }
            }
        }
    }
}

async function populateAll() {
    const tokens = Object.keys(TOKENS);
    console.log('\nStarting population for all tokens:', tokens.join(', '));
    
    for (let i = 0; i < tokens.length; i++) {
        const symbol = tokens[i];
        
        try {
            await populateToken(symbol);
            
            // If this isn't the last token, wait before processing the next one
            if (i < tokens.length - 1) {
                console.log('\nWaiting 1 minute before next token...');
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        } catch (error) {
            console.error(`\nError processing ${symbol}:`, error);
            console.log('Moving on to next token...');
        }
    }
}

// Start the population
console.log('Starting automatic population of all tokens...');
populateAll()
    .then(() => {
        console.log('\nAll tokens processed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\nFatal error:', error);
        process.exit(1);
    }); 