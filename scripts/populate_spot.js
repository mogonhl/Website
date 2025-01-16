const { Redis } = require('@upstash/redis');
const fetch = require('node-fetch');
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

async function fetchSpotData(coin, interval, days) {
    const isTokenId = coin.startsWith('@');
    console.log(`\nFetching ${interval} data for ${isTokenId ? 'token' : 'pair'} ${coin} (${days} days)...`);
    
    const now = Date.now();
    const startTime = now - (days * 24 * 60 * 60 * 1000);
    
    const payload = {
        type: "candleSnapshot",
        req: {
            coin: coin,
            interval: interval,
            startTime: startTime,
            endTime: now
        }
    };

    try {
        const response = await fetch('https://api-ui.hyperliquid.xyz/info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // If we get an empty array or invalid response, assume this token/pair doesn't exist
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        // Print the latest candle data
        const latestCandle = data[data.length - 1];
        console.log(`Latest ${interval} data for ${coin}:`, {
            timestamp: new Date(latestCandle.t).toISOString(),
            close: latestCandle.c,
            volume: latestCandle.v,
            high: latestCandle.h,
            low: latestCandle.l,
            dataPoints: data.length
        });

        // Transform the data into the format we need
        return {
            tokenId: coin,
            prices: data.map(candle => [candle.t, parseFloat(candle.c)]),
            total_volumes: data.map(candle => [candle.t, parseFloat(candle.v)]),
            market_caps: data.map(candle => [candle.t, 0]) // We don't have market cap data
        };
    } catch (error) {
        console.error(`Error fetching ${interval} data for ${coin}:`, error.message);
        return null;
    }
}

async function populateSpotTokens() {
    console.log('Starting spot tokens population...');
    
    // First handle PURR/USDC specifically
    console.log('\nFetching PURR/USDC data...');
    const purrData = await fetchSpotData('PURR/USDC', '1h', 7);
    const hourlyData = [];

    if (purrData) {
        console.log('Successfully fetched PURR/USDC data');
        hourlyData.push(purrData);
    } else {
        console.error('Failed to fetch PURR/USDC data');
    }
    
    let tokenId = 1;
    let consecutiveEmptyResponses = 0;
    const MAX_EMPTY_RESPONSES = 5;
    
    while (consecutiveEmptyResponses < MAX_EMPTY_RESPONSES) {
        // Add delay between requests to avoid rate limiting
        if (tokenId > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Fetch 7 days of hourly data
        const hourly = await fetchSpotData(`@${tokenId}`, '1h', 7);
        
        if (!hourly) {
            console.log(`No data found for token @${tokenId}`);
            consecutiveEmptyResponses++;
            tokenId++;
            continue;
        }

        // Reset consecutive empty responses counter if we got data
        consecutiveEmptyResponses = 0;
        hourlyData.push(hourly);
        tokenId++;
    }

    // Store hourly data in chunks of 20 tokens
    const CHUNK_SIZE = 20;
    for (let i = 0; i < hourlyData.length; i += CHUNK_SIZE) {
        const chunk = hourlyData.slice(i, i + CHUNK_SIZE);
        const chunkNumber = Math.floor(i / CHUNK_SIZE);
        try {
            console.log(`\nStoring 7d hourly data chunk ${chunkNumber} (${chunk.length} tokens)...`);
            await redis.set(`spot_data_7d_${chunkNumber}`, JSON.stringify(chunk));
            console.log(`Successfully stored hourly chunk ${chunkNumber}`);
        } catch (error) {
            console.error(`Error storing hourly chunk ${chunkNumber}:`, error.message);
        }
    }

    // Store the number of chunks for later reference
    try {
        const numChunks = Math.ceil(hourlyData.length / CHUNK_SIZE);
        await redis.set('spot_data_7d_chunks', numChunks.toString());
        console.log(`\nStored hourly chunk count: ${numChunks}`);
    } catch (error) {
        console.error('Error storing hourly chunk count:', error.message);
    }

    // Verify the data was stored
    try {
        const keys = await redis.keys('*');
        console.log('\nCurrent Redis keys:', keys);
        
        // Check samples
        const hourlyChunk0 = await redis.get('spot_data_7d_0');
        
        console.log('\nData verification:');
        console.log('First hourly chunk exists:', !!hourlyChunk0);
        
        if (hourlyChunk0) {
            const parsed = JSON.parse(hourlyChunk0);
            console.log('\nFirst hourly chunk details:');
            console.log('Number of tokens in chunk:', parsed.length);
            if (parsed.length > 0) {
                console.log('First token data:', parsed[0].tokenId);
                console.log('Sample price points:', parsed[0].prices.length);
            }
        }
    } catch (error) {
        console.error('Error verifying data:', error);
    }

    console.log('\nSpot tokens population complete!');
    console.log(`Processed ${hourlyData.length} tokens`);
}

// Run the population
populateSpotTokens().catch(console.error); 