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

async function fetchSpotData(tokenId, interval, days) {
    console.log(`\nFetching ${interval} data for token @${tokenId} (${days} days)...`);
    
    const now = Date.now();
    const startTime = now - (days * 24 * 60 * 60 * 1000);
    
    const payload = {
        type: "candleSnapshot",
        req: {
            coin: `@${tokenId}`,
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
        
        // If we get an empty array or invalid response, assume this token ID doesn't exist
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        // Print the latest candle data
        const latestCandle = data[data.length - 1];
        console.log(`Latest ${interval} data for @${tokenId}:`, {
            timestamp: new Date(latestCandle.t).toISOString(),
            close: latestCandle.c,
            volume: latestCandle.v,
            high: latestCandle.h,
            low: latestCandle.l,
            dataPoints: data.length
        });

        // Transform the data into the format we need
        return {
            tokenId,
            prices: data.map(candle => [candle.t, parseFloat(candle.c)]),
            total_volumes: data.map(candle => [candle.t, parseFloat(candle.v)]),
            market_caps: data.map(candle => [candle.t, 0]) // We don't have market cap data
        };
    } catch (error) {
        console.error(`Error fetching ${interval} data for token @${tokenId}:`, error.message);
        return null;
    }
}

async function populateSpotTokens() {
    console.log('Starting spot tokens population...');
    
    let tokenId = 1;
    let consecutiveEmptyResponses = 0;
    const MAX_EMPTY_RESPONSES = 5;
    
    const hourlyData = [];  // 7 days of hourly data
    const dailyData = [];   // All available daily data
    
    while (consecutiveEmptyResponses < MAX_EMPTY_RESPONSES) {
        // Add delay between requests to avoid rate limiting
        if (tokenId > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Fetch 7 days of hourly data and 365 days of daily data
        const hourly = await fetchSpotData(tokenId, '1h', 7);
        const daily = await fetchSpotData(tokenId, '1d', 365);
        
        if (!hourly && !daily) {
            console.log(`No data found for token @${tokenId}`);
            consecutiveEmptyResponses++;
            tokenId++;
            continue;
        }

        // Reset consecutive empty responses counter if we got data
        consecutiveEmptyResponses = 0;

        if (hourly) hourlyData.push(hourly);
        if (daily) dailyData.push(daily);

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
        console.log(`\nStored chunk count: ${numChunks}`);
    } catch (error) {
        console.error('Error storing chunk count:', error.message);
    }

    // Store all daily data
    try {
        console.log(`\nStoring daily data for ${dailyData.length} tokens...`);
        await redis.set('spot_data_daily_all', JSON.stringify(dailyData));
        console.log('Successfully stored daily data');
    } catch (error) {
        console.error('Error storing daily data:', error.message);
    }

    // Verify the data was stored
    try {
        const keys = await redis.keys('*');
        console.log('\nCurrent Redis keys:', keys);
        
        // Check a sample chunk
        const chunk0 = await redis.get('spot_data_7d_0');
        const dailyVerify = await redis.get('spot_data_daily_all');
        const numChunksVerify = await redis.get('spot_data_7d_chunks');
        
        console.log('\nData verification:');
        console.log('First hourly chunk exists:', !!chunk0);
        console.log('Daily data exists:', !!dailyVerify);
        console.log('Number of chunks:', numChunksVerify);
        
        if (chunk0) {
            const parsed = JSON.parse(chunk0);
            console.log('\nFirst chunk details:');
            console.log('Number of tokens in chunk:', parsed.length);
            if (parsed.length > 0) {
                console.log('First token ID:', parsed[0].tokenId);
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