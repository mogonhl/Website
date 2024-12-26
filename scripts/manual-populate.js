const { Redis } = require('@upstash/redis');
const readline = require('readline');
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

async function fetchWithDelay(tokenId, timeRange) {
    console.log(`\nFetching ${tokenId} data for ${timeRange}...`);
    
    // Add a delay of 6.5 seconds between requests (allows ~9 requests per minute)
    await new Promise(resolve => setTimeout(resolve, 6500));
    
    const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart?vs_currency=usd&days=${timeRange}`
    );
    
    if (!response.ok) {
        if (response.status === 429) {
            console.log('Rate limit hit, waiting 65 seconds...');
            await new Promise(resolve => setTimeout(resolve, 65000));
            return fetchWithDelay(tokenId, timeRange); // Retry after waiting
        }
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
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
    console.log('\nRaw DeFiLlama response:', {
        dataLength: data?.length,
        firstItem: data?.[0],
        lastItem: data?.[data?.length - 1]
    });
    
    if (!Array.isArray(data)) {
        throw new Error('Invalid TVL data format from DeFiLlama');
    }
    
    const now = Math.floor(Date.now() / 1000);
    const secondsPerDay = 24 * 60 * 60;
    
    // Convert timeRange to seconds
    const timeRangeSecs = {
        '1': secondsPerDay,
        '7': 7 * secondsPerDay,
        '30': 30 * secondsPerDay,
        '365': 365 * secondsPerDay
    }[timeRange] || 365 * secondsPerDay;
    
    // Filter and transform TVL data
    const filteredTvl = data
        .filter(item => (now - item.date) <= timeRangeSecs)
        .map(item => {
            const timestamp = item.date * 1000; // Convert to milliseconds
            const value = parseFloat(item.tvl);
            if (isNaN(value)) {
                console.warn('Invalid TVL value:', item);
                return null;
            }
            return [timestamp, value];
        })
        .filter(item => item !== null);

    if (filteredTvl.length === 0) {
        throw new Error('No TVL data available for the specified time range');
    }

    // Sort TVL data by timestamp
    filteredTvl.sort((a, b) => a[0] - b[0]);

    // Create the final data structure
    const tvlData = { tvl: filteredTvl };
    
    console.log('Final TVL data structure:', {
        type: typeof tvlData,
        keys: Object.keys(tvlData),
        hasTVL: !!tvlData.tvl,
        isTVLArray: Array.isArray(tvlData.tvl),
        sampleItems: tvlData.tvl.slice(0, 2),
        totalItems: tvlData.tvl.length,
        firstTimestamp: new Date(tvlData.tvl[0][0]).toISOString(),
        lastTimestamp: new Date(tvlData.tvl[tvlData.tvl.length - 1][0]).toISOString()
    });
    
    return tvlData;
}

async function populateToken(symbol) {
    const token = TOKENS[symbol];
    if (!token) {
        console.error(`Token ${symbol} not found!`);
        return;
    }

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
    for (let i = 0; i < priceTimeRanges.length; i++) {
        const range = priceTimeRanges[i];
        
        try {
            console.log(`\nProcessing ${symbol} price data for ${range.key}`);
            
            const priceCacheKey = `price_data_${range.key}_${symbol.toLowerCase()}`;
            const existingPrice = await redis.get(priceCacheKey);
            
            if (existingPrice) {
                const answer = await getUserInput(`Price data exists for ${priceCacheKey}. Override? (y/n): `);
                if (answer === 'y') {
                    const priceData = await fetchWithDelay(token.coingeckoId, range.days);
                    if (!priceData || !priceData.prices || priceData.prices.length === 0) {
                        throw new Error('Invalid price data received from CoinGecko');
                    }
                    console.log('Sample of price data to be stored:', {
                        type: typeof priceData,
                        keys: Object.keys(priceData),
                        samplePrice: priceData.prices?.[0],
                        dataPoints: priceData.prices?.length
                    });
                    await redis.set(priceCacheKey, JSON.stringify(priceData), { ex: 86400 });
                    console.log(`Successfully populated ${priceCacheKey}`);
                } else {
                    console.log('Skipping price data...');
                }
            } else {
                const priceData = await fetchWithDelay(token.coingeckoId, range.days);
                if (!priceData || !priceData.prices || priceData.prices.length === 0) {
                    throw new Error('Invalid price data received from CoinGecko');
                }
                await redis.set(priceCacheKey, JSON.stringify(priceData), { ex: 86400 });
                console.log(`Successfully populated ${priceCacheKey}`);
            }
        } catch (error) {
            console.error(`Error populating price data:`, error);
            const retry = await getUserInput('Would you like to retry? (y/n): ');
            if (retry === 'y') {
                i--;
            }
        }
    }

    // Handle TVL data for HYPE separately
    if (symbol === 'HYPE') {
        for (let i = 0; i < tvlTimeRanges.length; i++) {
            const range = tvlTimeRanges[i];
            
            try {
                console.log(`\nProcessing ${symbol} TVL data for ${range.key}`);
                
                const tvlCacheKey = `tvl_data_${range.key}_${symbol.toLowerCase()}`;
                const existingTVL = await redis.get(tvlCacheKey);
                
                if (existingTVL) {
                    const answer = await getUserInput(`TVL data exists for ${tvlCacheKey}. Override? (y/n): `);
                    if (answer === 'y') {
                        const tvlData = await fetchTVLWithDelay(range.days);
                        if (!tvlData || !tvlData.tvl || tvlData.tvl.length === 0) {
                            throw new Error('Invalid TVL data received from DeFiLlama');
                        }
                        console.log('TVL data to be stored:', {
                            type: typeof tvlData,
                            keys: Object.keys(tvlData),
                            sampleTVL: tvlData.tvl?.[0],
                            dataPoints: tvlData.tvl?.length
                        });
                        await redis.set(tvlCacheKey, JSON.stringify(tvlData), { ex: 86400 });
                        console.log(`Successfully populated ${tvlCacheKey}`);
                    } else {
                        console.log('Skipping TVL data...');
                    }
                } else {
                    const tvlData = await fetchTVLWithDelay(range.days);
                    if (!tvlData || !tvlData.tvl || tvlData.tvl.length === 0) {
                        throw new Error('Invalid TVL data received from DeFiLlama');
                    }
                    console.log('TVL data to be stored:', {
                        type: typeof tvlData,
                        keys: Object.keys(tvlData),
                        sampleTVL: tvlData.tvl?.[0],
                        dataPoints: tvlData.tvl?.length
                    });
                    await redis.set(tvlCacheKey, JSON.stringify(tvlData), { ex: 86400 });
                    console.log(`Successfully populated ${tvlCacheKey}`);
                }
            } catch (error) {
                console.error(`Error populating TVL data:`, error);
                const retry = await getUserInput('Would you like to retry? (y/n): ');
                if (retry === 'y') {
                    i--;
                }
            }
        }
    }
}

async function main() {
    const symbol = process.argv[2];
    if (!symbol) {
        console.log('\nPlease provide a token symbol. Available tokens:');
        console.log(Object.keys(TOKENS).join(', '));
        rl.close();
        return;
    }

    if (symbol === 'ALL') {
        for (const tokenSymbol of Object.keys(TOKENS)) {
            console.log(`\nProcessing ${tokenSymbol}...`);
            await populateToken(tokenSymbol);
        }
    } else if (TOKENS[symbol]) {
        await populateToken(symbol);
    } else {
        console.error(`Invalid token symbol: ${symbol}`);
        console.log('Available tokens:', Object.keys(TOKENS).join(', '));
    }
    
    console.log('\nDone!');
    rl.close();
}

main().catch(console.error); 