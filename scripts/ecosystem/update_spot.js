const { Redis } = require('@upstash/redis');
const fetch = require('node-fetch');
require('dotenv').config({ path: '../.env' });

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

async function fetchSpotData(coin, interval, days) {
    const isTokenId = typeof coin === 'number';
    const coinStr = isTokenId ? `@${coin}` : coin;
    console.log(`\nFetching ${interval} data for ${isTokenId ? 'token' : 'pair'} ${coinStr} (${days} days)...`);
    
    const now = Date.now();
    const startTime = now - (days * 24 * 60 * 60 * 1000);
    
    // First get the token's current circulating supply if it's a token ID
    let circulatingSupply = null;
    if (isTokenId) {
        const supplyPayload = {
            type: "spotMetaAndAssetCtxs"
        };

        try {
            console.log(`Fetching supply data for token ${coinStr}...`);
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
            const tokenDetails = supplyData[1].find(d => d.coin === coinStr);
            circulatingSupply = tokenDetails ? parseFloat(tokenDetails.circulatingSupply) : null;

            if (!circulatingSupply) {
                console.log(`No supply data found for token ${coinStr}, will use 0 for market cap calculations`);
                circulatingSupply = 0;
            }

            console.log(`Using circulating supply for ${coinStr}: ${circulatingSupply.toLocaleString()}`);
        } catch (error) {
            console.error(`Error fetching supply data for ${coinStr}:`, error.message);
            console.log('Will use 0 for market cap calculations');
            circulatingSupply = 0;
        }
    }

    // Then get the price data
    console.log(`Fetching price data for ${isTokenId ? 'token' : 'pair'} ${coinStr}...`);
    const pricePayload = {
        type: "candleSnapshot",
        req: {
            coin: coinStr,
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
            body: JSON.stringify(pricePayload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        // Calculate market caps for tokens, or set to 0 for trading pairs
        const marketCaps = data.map(candle => [
            candle.t, 
            isTokenId ? parseFloat(candle.c) * circulatingSupply : 0
        ]);

        console.log(`\nSample data for ${coinStr}:`);
        console.log('First data point:', {
            timestamp: new Date(data[0].t).toISOString(),
            price: parseFloat(data[0].c).toFixed(4),
            volume: parseFloat(data[0].v).toFixed(2),
            marketCap: isTokenId ? (parseFloat(data[0].c) * circulatingSupply).toLocaleString() : 'N/A'
        });
        console.log('Last data point:', {
            timestamp: new Date(data[data.length - 1].t).toISOString(),
            price: parseFloat(data[data.length - 1].c).toFixed(4),
            volume: parseFloat(data[data.length - 1].v).toFixed(2),
            marketCap: isTokenId ? (parseFloat(data[data.length - 1].c) * circulatingSupply).toLocaleString() : 'N/A'
        });

        return {
            tokenId: coinStr,
            prices: data.map(candle => [candle.t, parseFloat(candle.c)]),
            total_volumes: data.map(candle => [candle.t, parseFloat(candle.v)]),
            market_caps: marketCaps
        };
    } catch (error) {
        console.error(`Error fetching ${interval} data for ${coinStr}:`, error.message);
        return null;
    }
}

async function populateSpotData() {
    console.log('\n=== Populating spot data ===');
    
    const dailyData = [];
    const CHUNK_SIZE = 5; // Reduced chunk size to avoid request size limit
    
    let tokenId = 1;
    let consecutiveEmptyResponses = 0;
    const MAX_EMPTY_RESPONSES = 5;
    
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
                
                // Split the data into smaller chunks if needed
                const dataStr = JSON.stringify(dailyData);
                if (dataStr.length > 900000) { // Leave some buffer below the 1MB limit
                    console.log('Data size too large, splitting chunk further...');
                    const halfSize = Math.ceil(dailyData.length / 2);
                    const firstHalf = dailyData.slice(0, halfSize);
                    const secondHalf = dailyData.slice(halfSize);
                    
                    await redis.set(`spot_data_daily_chunk_${chunkNumber}_a`, JSON.stringify(firstHalf));
                    await redis.set(`spot_data_daily_chunk_${chunkNumber}_b`, JSON.stringify(secondHalf));
                    console.log('Successfully stored split chunks');
                } else {
                    await redis.set(`spot_data_daily_chunk_${chunkNumber}`, dataStr);
                    console.log('Successfully stored chunk');
                }
                
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
            
            // Split the final chunk if needed
            const dataStr = JSON.stringify(dailyData);
            if (dataStr.length > 900000) {
                console.log('Final chunk too large, splitting...');
                const halfSize = Math.ceil(dailyData.length / 2);
                const firstHalf = dailyData.slice(0, halfSize);
                const secondHalf = dailyData.slice(halfSize);
                
                await redis.set(`spot_data_daily_chunk_${chunkNumber}_a`, JSON.stringify(firstHalf));
                await redis.set(`spot_data_daily_chunk_${chunkNumber}_b`, JSON.stringify(secondHalf));
                console.log('Successfully stored split final chunks');
            } else {
                await redis.set(`spot_data_daily_chunk_${chunkNumber}`, dataStr);
                console.log('Successfully stored final chunk');
            }
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
        console.log('Metadata from Redis:', metadataStr);
        console.log('Metadata type:', typeof metadataStr);
        
        if (!metadataStr) {
            throw new Error('No metadata found for chunked data');
        }

        const metadata = typeof metadataStr === 'string' ? JSON.parse(metadataStr) : metadataStr;
        const { totalChunks } = metadata;
        const allData = [];

        console.log(`\nLoading ${totalChunks} chunks of data...`);

        for (let i = 0; i < totalChunks; i++) {
            console.log(`Loading chunk ${i}...`);
            // Try to load the main chunk first
            let chunkData = await redis.get(`spot_data_daily_chunk_${i}`);
            console.log(`Chunk ${i} type:`, typeof chunkData);
            console.log(`Chunk ${i} data:`, chunkData?.slice?.(0, 100) + '...');
            
            if (chunkData) {
                // If it's already an object, use it directly
                if (typeof chunkData === 'object' && Array.isArray(chunkData)) {
                    allData.push(...chunkData);
                }
                // If it's a string, try to parse it
                else if (typeof chunkData === 'string') {
                    try {
                        const parsed = JSON.parse(chunkData);
                        if (Array.isArray(parsed)) {
                            allData.push(...parsed);
                        } else {
                            console.error(`Chunk ${i} is not an array:`, typeof parsed);
                        }
                    } catch (e) {
                        console.error(`Error parsing chunk ${i}:`, e);
                        continue;
                    }
                } else {
                    console.error(`Unexpected chunk ${i} type:`, typeof chunkData);
                }
            } else {
                // If main chunk doesn't exist, try loading split chunks
                console.log(`Loading split chunks ${i}_a and ${i}_b...`);
                let chunkAData = await redis.get(`spot_data_daily_chunk_${i}_a`);
                let chunkBData = await redis.get(`spot_data_daily_chunk_${i}_b`);
                
                if (chunkAData) {
                    if (typeof chunkAData === 'object' && Array.isArray(chunkAData)) {
                        allData.push(...chunkAData);
                    } else if (typeof chunkAData === 'string') {
                        try {
                            const parsed = JSON.parse(chunkAData);
                            if (Array.isArray(parsed)) {
                                allData.push(...parsed);
                            }
                        } catch (e) {
                            console.error(`Error parsing chunk ${i}_a:`, e);
                        }
                    }
                }
                
                if (chunkBData) {
                    if (typeof chunkBData === 'object' && Array.isArray(chunkBData)) {
                        allData.push(...chunkBData);
                    } else if (typeof chunkBData === 'string') {
                        try {
                            const parsed = JSON.parse(chunkBData);
                            if (Array.isArray(parsed)) {
                                allData.push(...parsed);
                            }
                        } catch (e) {
                            console.error(`Error parsing chunk ${i}_b:`, e);
                        }
                    }
                }
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
            console.log('Active token IDs:', Array.from(activeTokens).join(', '));
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
        // Start with PURR/USDC 7-day data first
        console.log('\n=== Fetching PURR/USDC 7-day hourly data ===');
        const purrHourlyData = await fetchSpotData('PURR/USDC', '1h', 7);
        if (purrHourlyData && purrHourlyData.prices && purrHourlyData.prices.length > 0) {
            console.log('Successfully fetched PURR/USDC hourly data');
            console.log(`Found ${purrHourlyData.prices.length} data points`);
            
            // Format data for storage
            const formattedData = {
                prices: purrHourlyData.prices.map(p => p[1]),
                timestamps: purrHourlyData.prices.map(p => p[0]),
                total_volumes: purrHourlyData.total_volumes.map(v => v[1])
            };

            console.log('Formatted data:', JSON.stringify(formattedData, null, 2));

            // Store PURR data
            if (formattedData.prices.length > 0 && formattedData.timestamps.length > 0) {
                console.log('Storing PURR/USDC hourly data...');
                await redis.set('spot_data_7d_purr', JSON.stringify(formattedData));
                await redis.set('spot_data_7d_has_purr', 'true');
                console.log('Successfully stored PURR/USDC hourly data');
            } else {
                console.log('No valid PURR/USDC data to store');
            }
        } else {
            console.log('No PURR/USDC hourly data found');
        }

        /* Temporarily commenting out rest of processing for quick testing
        // Now proceed with the rest of the data
        // 1. Populate spot data (this includes daily data chunking)
        const spotData = await populateSpotData();
        
        // 2. Create all indices
        await createIndices(spotData);

        // 3. Update 7-day snapshot data with hourly granularity
        console.log('\n=== Updating 7-day snapshot data with hourly granularity ===');

        // Process other tokens
        const tokenIds = Array.from({ length: lastTokenId }, (_, i) => i + 1);
        const uniqueBatches = Math.ceil(tokenIds.length / CHUNK_SIZE);

        console.log(`Processing ${tokenIds.length} tokens in ${uniqueBatches} batches...`);

        for (const batchNum of uniqueBatches) {
            const batchTokenIds = tokenIds.filter(id => Math.floor(parseInt(id) / batchSize) === batchNum);
            console.log(`\nProcessing batch ${batchNum} with ${batchTokenIds.length} tokens...`);
            
            const batchData = [];
            // Fetch hourly data for each token in the batch
            for (const tokenId of batchTokenIds) {
                console.log(`Fetching hourly data for token ${tokenId}...`);
                const hourlyData = await fetchSpotData(tokenId, '1h', 7);
                if (hourlyData && hourlyData.prices && hourlyData.prices.length > 0) {
                    const formattedData = {
                        tokenId,
                        prices: hourlyData.prices.map(p => [p[0], parseFloat(p[1]) || 0]),
                        total_volumes: hourlyData.total_volumes.map(v => [v[0], parseFloat(v[1]) || 0])
                    };
                    batchData.push(formattedData);
                }
            }
            
            if (batchData.length > 0) {
                const key = `spot_data_7d_${batchNum}`;
                console.log(`Storing ${batchData.length} tokens in ${key}...`);
                await redis.set(key, JSON.stringify(batchData));
            }
        }

        // Store the number of chunks
        const numChunks = Math.max(...uniqueBatches) + 1;
        await redis.set('spot_data_7d_chunks', numChunks);
        console.log(`\nStored ${numChunks} chunks of hourly snapshot data`);

        // 4. Update latest launch data
        console.log('\n=== Updating latest launch data ===');
        // Find the token with the highest ID that has data
        const latestToken = spotData.reduce((latest, current) => {
            return (!latest || current.tokenId > latest.tokenId) ? current : latest;
        }, null);

        if (latestToken) {
            const latestLaunchData = {
                fullName: `@${latestToken.tokenId}`,
                name: latestToken.displayName || `@${latestToken.tokenId}`,
                launchTime: latestToken.prices[0][0],
                launchPrice: latestToken.prices[0][1]
            };
            console.log('Latest launch data:', latestLaunchData);
            await redis.set('latest_launch', JSON.stringify(latestLaunchData));
        }
        */
        
        console.log('\nPURR data update completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error in main execution:', error);
        process.exit(1);
    }
}

main();