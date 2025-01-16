const { Redis } = require('@upstash/redis');
require('dotenv').config({ path: '../.env' });

// Direct Redis configuration
const redis = new Redis({
    url: "https://witty-dassie-40050.upstash.io",
    token: "AZxyAAIjcDE3Mzk2MTJkNzJjMDg0Yzk0ODMyZWE3YmRjOGRmZTQxZHAxMA"
});

async function loadAllChunks() {
    try {
        console.log('\n=== Loading Data ===');
        console.log('Loading metadata...');
        const metadata = await redis.get('spot_data_daily_metadata');
        console.log('Raw metadata:', metadata);
        
        if (!metadata) {
            // If no metadata, try to get individual token data
            console.log('\nNo metadata found, trying to get individual token data...');
            const keys = await redis.keys('price_data_*');
            console.log(`Found ${keys.length} price data keys`);
            
            // Get HYPE token data first
            const hypeData = await redis.get('price_data_30D_hype');
            if (!hypeData) {
                throw new Error('No HYPE token data found');
            }
            console.log('Found HYPE token data');
            
            // Process all tokens
            const allData = [];
            for (const key of keys) {
                if (key.startsWith('price_data_30D_')) {
                    const tokenId = key.replace('price_data_30D_', '');
                    console.log(`Processing ${tokenId}...`);
                    const data = await redis.get(key);
                    if (data) {
                        try {
                            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                            if (parsed.prices && Array.isArray(parsed.prices)) {
                                allData.push({
                                    tokenId,
                                    prices: parsed.prices,
                                    market_caps: parsed.market_caps || []
                                });
                                console.log(`Added ${tokenId} with ${parsed.prices.length} price points`);
                            }
                        } catch (e) {
                            console.error(`Error processing ${tokenId}:`, e);
                        }
                    }
                }
            }
            
            console.log(`\nProcessed ${allData.length} tokens`);
            return allData;
        }

        const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
        console.log('Parsed metadata:', parsedMetadata);

        const { totalChunks } = parsedMetadata;
        const allData = [];

        console.log(`Loading ${totalChunks} daily data chunks...`);
        for (let i = 0; i < totalChunks; i++) {
            console.log(`Loading daily chunk ${i}...`);
            const chunkData = await redis.get(`spot_data_daily_chunk_${i}`);
            if (chunkData) {
                const parsed = typeof chunkData === 'string' ? JSON.parse(chunkData) : chunkData;
                console.log(`Chunk ${i} contains ${parsed.length} tokens`);
                allData.push(...parsed);
            } else {
                console.warn(`Warning: Daily chunk ${i} not found`);
            }
        }

        console.log(`\nLoaded ${allData.length} tokens from ${totalChunks} chunks`);
        return allData;
    } catch (error) {
        console.error('Error loading data:', error);
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
            console.log('Active tokens:', Array.from(activeTokens).join(', '));
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
    
    // Create indices with different calculation methods
    console.log('\nCreating Market Cap Index (with HYPE)...');
    await createMarketCapIndex(tokens, true, 'spot_data_mcap_index', stableStartTimestamp);
    
    console.log('\nCreating Market Cap Ex-HYPE Index...');
    await createMarketCapIndex(tokens, false, 'spot_data_mcap_ex_hype_index', stableStartTimestamp);
}

async function createMarketCapIndex(tokens, includeHype, redisKey, stableStartTimestamp) {
    console.log(`\nProcessing index with includeHype = ${includeHype}`);
    
    // Filter out HYPE token if needed and validate data
    const tokensToProcess = includeHype 
        ? tokens 
        : tokens.filter(t => t.tokenId !== '@107');

    // Log token counts and HYPE token presence
    console.log(`Total tokens before filtering: ${tokens.length}`);
    console.log(`Tokens after filtering: ${tokensToProcess.length}`);
    const hypeToken = tokens.find(t => t.tokenId === '@107');
    console.log('HYPE token found:', hypeToken ? 'Yes' : 'No', hypeToken ? `(ID: ${hypeToken.tokenId})` : '');

    // Debug: Log first few tokens' data structure
    console.log('\nSample token data:');
    tokensToProcess.slice(0, 3).forEach(token => {
        console.log(`\nToken ${token.tokenId}:`);
        console.log('Has prices:', !!token.prices, 'Length:', token.prices?.length || 0);
        console.log('Has market_caps:', !!token.market_caps, 'Length:', token.market_caps?.length || 0);
        if (token.prices?.length > 0) {
            console.log('First price entry:', token.prices[0]);
            console.log('Last price entry:', token.prices[token.prices.length - 1]);
        }
        if (token.market_caps?.length > 0) {
            console.log('First mcap entry:', token.market_caps[0]);
            console.log('Last mcap entry:', token.market_caps[token.market_caps.length - 1]);
        }
    });

    // Validate token data structure
    let validTokens = 0;
    tokensToProcess.forEach((token, index) => {
        if (!token.prices || !Array.isArray(token.prices)) {
            console.warn(`Token ${token.tokenId} has invalid price data`);
        } else if (!token.market_caps || !Array.isArray(token.market_caps)) {
            console.warn(`Token ${token.tokenId} has invalid market cap data`);
        } else {
            validTokens++;
        }
    });
    console.log(`\nFound ${validTokens} tokens with valid data out of ${tokensToProcess.length}`);
    
    // Get all unique timestamps from price data
    const timestamps = new Set();
    tokensToProcess.forEach(token => {
        if (!token.prices) return;
        token.prices.forEach(([timestamp]) => {
            if (timestamp >= stableStartTimestamp) {
                timestamps.add(timestamp);
            }
        });
    });

    // Convert to sorted array
    const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b);
    console.log(`\nFound ${sortedTimestamps.length} unique timestamps`);
    
    // Calculate index values for each timestamp
    const indexValues = sortedTimestamps.map(timestamp => {
        let totalMcap = 0;
        let weightedSum = 0;
        let validTokenCount = 0;
        let debugInfo = [];
        
        // Calculate total market cap for this timestamp
        tokensToProcess.forEach(token => {
            const pricePoint = token.prices?.find(([t]) => t === timestamp);
            const mcapPoint = token.market_caps?.find(([t]) => t === timestamp);
            
            if (pricePoint && mcapPoint) {
                const [, price] = pricePoint;
                const [, mcap] = mcapPoint;
                if (!isNaN(mcap) && mcap > 0) {
                    totalMcap += mcap;
                    validTokenCount++;
                    if (String(token.tokenId) === '107') {
                        debugInfo.push(`HYPE mcap: ${mcap}, price: ${price}`);
                    }
                }
            }
        });
        
        // If we have valid total market cap, calculate weighted prices
        if (totalMcap > 0) {
            tokensToProcess.forEach(token => {
                const pricePoint = token.prices?.find(([t]) => t === timestamp);
                const mcapPoint = token.market_caps?.find(([t]) => t === timestamp);
                
                if (pricePoint && mcapPoint) {
                    const [, price] = pricePoint;
                    const [, mcap] = mcapPoint;
                    if (!isNaN(price) && !isNaN(mcap) && mcap > 0) {
                        const weight = mcap / totalMcap;
                        weightedSum += price * weight;
                        if (String(token.tokenId) === '107') {
                            debugInfo.push(`HYPE weight: ${weight}, contribution: ${price * weight}`);
                        }
                    }
                }
            });
        }
        
        if (validTokenCount === 0) {
            console.log(`No valid tokens found for timestamp ${new Date(timestamp).toISOString()}`);
        } else if (debugInfo.length > 0) {
            console.log(`Timestamp ${new Date(timestamp).toISOString()}:`, debugInfo.join(', '));
        }
        
        return [timestamp, weightedSum];
    }).filter(([, value]) => !isNaN(value) && value > 0);

    // Print statistics
    console.log('\nIndex Statistics:');
    console.log(`Start date: ${new Date(sortedTimestamps[0]).toISOString()}`);
    console.log(`End date: ${new Date(sortedTimestamps[sortedTimestamps.length - 1]).toISOString()}`);
    console.log(`Initial value: ${indexValues[0]?.[1]?.toFixed(4) || 'NaN'}`);
    console.log(`Final value: ${indexValues[indexValues.length - 1]?.[1]?.toFixed(4) || 'NaN'}`);
    console.log(`Number of tokens: ${tokensToProcess.length}`);
    console.log(`Total data points: ${indexValues.length}`);

    // Store in Redis
    await redis.set(redisKey, { prices: indexValues });
}

async function main() {
    try {
        // Load the chunked data
        const tokens = await loadAllChunks();
        
        // Create indices
        await createIndices(tokens);
        
        console.log('\nAll indices created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error in main execution:', error);
        process.exit(1);
    }
}

main(); 