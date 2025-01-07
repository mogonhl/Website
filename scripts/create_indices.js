const { Redis } = require('@upstash/redis');
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

async function loadAllChunks() {
    try {
        console.log('Loading metadata...');
        const metadata = await redis.get('spot_data_daily_metadata');
        if (!metadata) {
            throw new Error('No metadata found for chunked data');
        }

        const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
        console.log('Metadata:', parsedMetadata);

        const { totalChunks } = parsedMetadata;
        const allData = [];

        console.log(`Loading ${totalChunks} chunks...`);
        for (let i = 0; i < totalChunks; i++) {
            console.log(`Loading chunk ${i}...`);
            const chunkData = await redis.get(`spot_data_daily_chunk_${i}`);
            if (chunkData) {
                const parsed = typeof chunkData === 'string' ? JSON.parse(chunkData) : chunkData;
                console.log(`Chunk ${i} contains ${parsed.length} tokens`);
                allData.push(...parsed);
            } else {
                console.log(`Warning: Chunk ${i} not found`);
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
    await redis.set(redisKey, { prices });
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