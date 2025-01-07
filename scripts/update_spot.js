const { Redis } = require('@upstash/redis');
const fetch = require('node-fetch');
const { SPOT_TICKERS } = require('../app/types/spot_tickers');
require('dotenv').config();

// Validate environment variables
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
    
    // First get the token's current circulating supply
    const supplyPayload = {
        type: "spotMetaAndAssetCtxs"
    };

    try {
        console.log(`Fetching supply data for token @${tokenId}...`);
        const supplyResponse = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(supplyPayload)
        });

        if (!supplyResponse.ok) {
            throw new Error(`HTTP error! status: ${supplyResponse.status}`);
        }

        const supplyData = await supplyResponse.json();
        const tokenDetails = supplyData[1].find(d => d.coin === `@${tokenId}`);
        const circulatingSupply = tokenDetails ? parseFloat(tokenDetails.circulatingSupply) : null;

        if (!circulatingSupply) {
            console.log(`No supply data found for token @${tokenId}`);
            return null;
        }

        console.log(`Found circulating supply for @${tokenId}: ${circulatingSupply.toLocaleString()}`);

        // Then get the price data
        console.log(`Fetching price data for token @${tokenId}...`);
        const pricePayload = {
            type: "candleSnapshot",
            req: {
                coin: `@${tokenId}`,
                interval: interval,
                startTime: startTime,
                endTime: now
            }
        };

        const response = await fetch('https://api-ui.hyperliquid.xyz/info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(pricePayload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        // Calculate market caps and log some sample data
        const marketCaps = data.map(candle => [candle.t, parseFloat(candle.c) * circulatingSupply]);
        console.log(`\nSample data for token @${tokenId}:`);
        console.log('First data point:', {
            timestamp: new Date(data[0].t).toISOString(),
            price: parseFloat(data[0].c).toFixed(4),
            volume: parseFloat(data[0].v).toFixed(2),
            marketCap: (parseFloat(data[0].c) * circulatingSupply).toLocaleString()
        });
        console.log('Last data point:', {
            timestamp: new Date(data[data.length - 1].t).toISOString(),
            price: parseFloat(data[data.length - 1].c).toFixed(4),
            volume: parseFloat(data[data.length - 1].v).toFixed(2),
            marketCap: (parseFloat(data[data.length - 1].c) * circulatingSupply).toLocaleString()
        });

        return {
            tokenId,
            prices: data.map(candle => [candle.t, parseFloat(candle.c)]),
            total_volumes: data.map(candle => [candle.t, parseFloat(candle.v)]),
            market_caps: marketCaps
        };
    } catch (error) {
        console.error(`Error fetching ${interval} data for token @${tokenId}:`, error.message);
        return null;
    }
}

async function populateSpotData() {
    console.log('\n=== Populating spot data ===');
    
    let tokenId = 1;
    let consecutiveEmptyResponses = 0;
    const MAX_EMPTY_RESPONSES = 5;
    const dailyData = [];
    const CHUNK_SIZE = 10; // Store data in chunks of 10 tokens
    
    while (consecutiveEmptyResponses < MAX_EMPTY_RESPONSES) {
        if (tokenId > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const daily = await fetchSpotData(tokenId, '1d', 365);
        
        if (!daily) {
            console.log(`No data found for token @${tokenId}`);
            consecutiveEmptyResponses++;
            tokenId++;
            continue;
        }

        consecutiveEmptyResponses = 0;
        dailyData.push(daily);
        tokenId++;

        // Store data in chunks to avoid Redis size limit
        if (dailyData.length >= CHUNK_SIZE) {
            try {
                const chunkNumber = Math.floor((tokenId - 1) / CHUNK_SIZE);
                console.log(`\nStoring chunk ${chunkNumber} (tokens ${tokenId - CHUNK_SIZE} to ${tokenId - 1})...`);
                await redis.set(`spot_data_daily_chunk_${chunkNumber}`, JSON.stringify(dailyData));
                console.log('Successfully stored chunk');
                dailyData.length = 0; // Clear the array after storing
            } catch (error) {
                console.error('Error storing data chunk:', error);
                throw error;
            }
        }
    }

    // Store any remaining data
    if (dailyData.length > 0) {
        try {
            const chunkNumber = Math.floor((tokenId - 1) / CHUNK_SIZE);
            console.log(`\nStoring final chunk ${chunkNumber} (${dailyData.length} tokens)...`);
            await redis.set(`spot_data_daily_chunk_${chunkNumber}`, JSON.stringify(dailyData));
            console.log('Successfully stored final chunk');
        } catch (error) {
            console.error('Error storing final chunk:', error);
            throw error;
        }
    }

    // Store metadata about the chunks
    try {
        const metadata = {
            totalChunks: Math.ceil((tokenId - 1) / CHUNK_SIZE),
            lastTokenId: tokenId - 1,
            chunkSize: CHUNK_SIZE,
            timestamp: Date.now()
        };
        await redis.set('spot_data_daily_metadata', JSON.stringify(metadata));
        console.log('\nStored metadata:', metadata);
    } catch (error) {
        console.error('Error storing metadata:', error);
        throw error;
    }

    // Now modify createIndices to handle chunked data
    return await loadAllChunks();
}

async function loadAllChunks() {
    try {
        const metadataStr = await redis.get('spot_data_daily_metadata');
        if (!metadataStr) {
            throw new Error('No metadata found for chunked data');
        }

        const metadata = JSON.parse(metadataStr);
        const { totalChunks } = metadata;
        const allData = [];

        for (let i = 0; i < totalChunks; i++) {
            const chunkDataStr = await redis.get(`spot_data_daily_chunk_${i}`);
            if (chunkDataStr) {
                const parsed = JSON.parse(chunkDataStr);
                allData.push(...parsed);
            }
        }

        console.log(`\nLoaded ${allData.length} tokens from ${totalChunks} chunks`);
        return allData;
    } catch (error) {
        console.error('Error loading chunked data:', error);
        throw error;
    }
}

async function determineStableStartPoint(tokens, minTokens = 5) {
    console.log(`\n=== Determining Stable Start Point (minimum ${minTokens} tokens) ===`);
    
    // Create a map of timestamp to active tokens
    const tokensByTimestamp = new Map();
    
    tokens.forEach(token => {
        if (!token.prices || token.prices.length < 2) return;
        
        token.prices.forEach(([timestamp]) => {
            if (!tokensByTimestamp.has(timestamp)) {
                tokensByTimestamp.set(timestamp, new Set());
            }
            tokensByTimestamp.get(timestamp).add(token.tokenId);
        });
    });

    // Convert to array and sort by timestamp
    const timestampEntries = Array.from(tokensByTimestamp.entries())
        .sort(([a], [b]) => a - b);

    // Find the first timestamp with enough tokens
    for (const [timestamp, activeTokens] of timestampEntries) {
        if (activeTokens.size >= minTokens) {
            console.log(`Found stable start point at ${new Date(timestamp).toISOString()}`);
            console.log(`Number of active tokens: ${activeTokens.size}`);
            console.log('Active tokens:', Array.from(activeTokens).map(id => SPOT_TICKERS[`@${id}`]?.ticker || `Token ${id}`).join(', '));
            return timestamp;
        }
    }

    console.log('Warning: Could not find a point with enough tokens, using earliest available data');
    return timestampEntries[0]?.[0];
}

async function createIndices(tokens) {
    console.log('\n=== Creating Multiple Indices ===');

    // Determine stable start point for regular indices (minimum 5 tokens)
    const stableStartTimestamp = await determineStableStartPoint(tokens, 5);
    
    // Create market cap weighted indices
    console.log('\nCreating Market Cap Index (with HYPE)...');
    await createMarketCapIndex(tokens, true, 'spot_data_mcap_index', stableStartTimestamp);
    
    console.log('\nCreating Market Cap Ex-HYPE Index...');
    await createMarketCapIndex(tokens, false, 'spot_data_mcap_ex_hype_index', stableStartTimestamp);

    // Create equal weight index
    console.log('\nCreating Equal Weight Index...');
    await createEqualWeightIndex(tokens, 'spot_data_equal_index', stableStartTimestamp);

    // Create volume weighted index
    console.log('\nCreating Volume Weighted Index...');
    await createVolumeWeightedIndex(tokens, 'spot_data_volume_index', stableStartTimestamp);
}

async function createMarketCapIndex(tokens, includeHype, redisKey, stableStartTimestamp) {
    console.log(`\nProcessing index with includeHype = ${includeHype}`);
    
    // Filter out HYPE token if needed
    const tokensToProcess = includeHype ? tokens : tokens.filter(t => String(t.tokenId) !== '107');
    
    // First pass: Calculate total market cap for each timestamp
    const totalMcapByTimestamp = new Map();
    
    tokensToProcess.forEach(token => {
        if (!token.market_caps) return;
        token.market_caps.forEach(([timestamp, mcap]) => {
            if (timestamp < stableStartTimestamp) return;
            const currentTotal = totalMcapByTimestamp.get(timestamp) || 0;
            totalMcapByTimestamp.set(timestamp, currentTotal + mcap);
        });
    });

    // Convert to sorted array of timestamps
    const timestamps = Array.from(totalMcapByTimestamp.keys()).sort();
    if (timestamps.length === 0) {
        console.log('No valid timestamps found');
        return;
    }

    // Second pass: Calculate weighted prices
    const weightedPrices = new Map();
    timestamps.forEach(timestamp => {
        const totalMcap = totalMcapByTimestamp.get(timestamp);
        let weightedSum = 0;

        tokensToProcess.forEach(token => {
            if (!token.prices || !token.market_caps) return;
            
            // Find price and mcap for this timestamp
            const priceEntry = token.prices.find(([t]) => t === timestamp);
            const mcapEntry = token.market_caps.find(([t]) => t === timestamp);
            
            if (priceEntry && mcapEntry) {
                const [, price] = priceEntry;
                const [, mcap] = mcapEntry;
                const weight = mcap / totalMcap;
                weightedSum += price * weight;
            }
        });

        weightedPrices.set(timestamp, weightedSum);
    });

    // Convert to array format for storage
    const prices = timestamps.map(timestamp => [
        timestamp,
        weightedPrices.get(timestamp)
    ]);

    // Print statistics
    const firstPrice = prices[0][1];
    const lastPrice = prices[prices.length - 1][1];
    const totalReturn = lastPrice - firstPrice;
    const percentReturn = (totalReturn / firstPrice) * 100;

    console.log('\nIndex Statistics:');
    console.log(`Start date: ${new Date(timestamps[0]).toISOString()}`);
    console.log(`End date: ${new Date(timestamps[timestamps.length - 1]).toISOString()}`);
    console.log(`Initial value: ${firstPrice.toFixed(4)}`);
    console.log(`Final value: ${lastPrice.toFixed(4)}`);
    console.log(`Total return: ${totalReturn.toFixed(4)} (${percentReturn.toFixed(2)}%)`);
    console.log(`Number of tokens: ${tokensToProcess.length}`);
    console.log(`Total data points: ${prices.length}`);

    // Store in Redis
    await redis.set(redisKey, JSON.stringify({ prices }));
}

async function createEqualWeightIndex(tokens, redisKey, stableStartTimestamp) {
    console.log('\nProcessing equal weight index...');
    
    // First pass: Get all valid timestamps
    const validTimestamps = new Set();
    tokens.forEach(token => {
        if (!token.prices) return;
        token.prices.forEach(([timestamp]) => {
            if (timestamp >= stableStartTimestamp) {
                validTimestamps.add(timestamp);
            }
        });
    });

    // Convert to sorted array
    const timestamps = Array.from(validTimestamps).sort();
    if (timestamps.length === 0) {
        console.log('No valid timestamps found');
        return;
    }

    // Second pass: Calculate equal weighted prices
    const weightedPrices = new Map();
    timestamps.forEach(timestamp => {
        let totalPrice = 0;
        let validTokenCount = 0;

        tokens.forEach(token => {
            if (!token.prices) return;
            const priceEntry = token.prices.find(([t]) => t === timestamp);
            if (priceEntry) {
                totalPrice += priceEntry[1];
                validTokenCount++;
            }
        });

        // Calculate average price (equal weight)
        if (validTokenCount > 0) {
            weightedPrices.set(timestamp, totalPrice / validTokenCount);
        }
    });

    // Convert to array format for storage
    const prices = timestamps.map(timestamp => [
        timestamp,
        weightedPrices.get(timestamp)
    ]);

    // Print statistics
    const firstPrice = prices[0][1];
    const lastPrice = prices[prices.length - 1][1];
    const totalReturn = lastPrice - firstPrice;
    const percentReturn = (totalReturn / firstPrice) * 100;

    console.log('\nEqual Weight Index Statistics:');
    console.log(`Start date: ${new Date(timestamps[0]).toISOString()}`);
    console.log(`End date: ${new Date(timestamps[timestamps.length - 1]).toISOString()}`);
    console.log(`Initial value: ${firstPrice.toFixed(4)}`);
    console.log(`Final value: ${lastPrice.toFixed(4)}`);
    console.log(`Total return: ${totalReturn.toFixed(4)} (${percentReturn.toFixed(2)}%)`);
    console.log(`Total data points: ${prices.length}`);

    // Store in Redis
    await redis.set(redisKey, JSON.stringify({ prices }));
}

async function createVolumeWeightedIndex(tokens, redisKey, stableStartTimestamp) {
    console.log('\nProcessing volume weighted index...');
    
    // First pass: Calculate total volume for each timestamp
    const totalVolumeByTimestamp = new Map();
    
    tokens.forEach(token => {
        if (!token.total_volumes) return;
        token.total_volumes.forEach(([timestamp, volume]) => {
            if (timestamp < stableStartTimestamp) return;
            const currentTotal = totalVolumeByTimestamp.get(timestamp) || 0;
            totalVolumeByTimestamp.set(timestamp, currentTotal + volume);
        });
    });

    // Convert to sorted array of timestamps
    const timestamps = Array.from(totalVolumeByTimestamp.keys()).sort();
    if (timestamps.length === 0) {
        console.log('No valid timestamps found');
        return;
    }

    // Second pass: Calculate weighted prices
    const weightedPrices = new Map();
    timestamps.forEach(timestamp => {
        const totalVolume = totalVolumeByTimestamp.get(timestamp);
        let weightedSum = 0;

        tokens.forEach(token => {
            if (!token.prices || !token.total_volumes) return;
            
            // Find price and volume for this timestamp
            const priceEntry = token.prices.find(([t]) => t === timestamp);
            const volumeEntry = token.total_volumes.find(([t]) => t === timestamp);
            
            if (priceEntry && volumeEntry) {
                const [, price] = priceEntry;
                const [, volume] = volumeEntry;
                const weight = volume / totalVolume;
                weightedSum += price * weight;
            }
        });

        weightedPrices.set(timestamp, weightedSum);
    });

    // Convert to array format for storage
    const prices = timestamps.map(timestamp => [
        timestamp,
        weightedPrices.get(timestamp)
    ]);

    // Print statistics
    const firstPrice = prices[0][1];
    const lastPrice = prices[prices.length - 1][1];
    const totalReturn = lastPrice - firstPrice;
    const percentReturn = (totalReturn / firstPrice) * 100;

    console.log('\nVolume Weighted Index Statistics:');
    console.log(`Start date: ${new Date(timestamps[0]).toISOString()}`);
    console.log(`End date: ${new Date(timestamps[timestamps.length - 1]).toISOString()}`);
    console.log(`Initial value: ${firstPrice.toFixed(4)}`);
    console.log(`Final value: ${lastPrice.toFixed(4)}`);
    console.log(`Total return: ${totalReturn.toFixed(4)} (${percentReturn.toFixed(2)}%)`);
    console.log(`Total data points: ${prices.length}`);

    // Store in Redis
    await redis.set(redisKey, JSON.stringify({ prices }));
}

async function main() {
    try {
        // 1. Populate spot data
        const spotData = await populateSpotData();
        
        // 2. Create all indices
        await createIndices(spotData);
        
        console.log('\nAll indices created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error in main execution:', error);
        process.exit(1);
    }
}

main(); 