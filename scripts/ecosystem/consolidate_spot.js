const { Redis } = require('@upstash/redis');
require('dotenv').config();

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function consolidateSpotData() {
    try {
        // Get number of chunks
        const numChunks = await redis.get('spot_data_7d_chunks');
        if (!numChunks) {
            console.error('No spot data chunks found');
            return;
        }

        console.log(`Found ${numChunks} chunks to process...`);
        const consolidatedData = {};

        // Process each chunk
        for (let i = 0; i < parseInt(numChunks); i++) {
            console.log(`Processing chunk ${i}...`);
            const chunkData = await redis.get(`spot_data_7d_${i}`);
            if (chunkData) {
                // Handle both string and object responses
                const tokens = typeof chunkData === 'string' ? JSON.parse(chunkData) : chunkData;
                if (!Array.isArray(tokens)) {
                    console.error(`Invalid data in chunk ${i}:`, tokens);
                    continue;
                }

                tokens.forEach(token => {
                    if (!token.prices || token.prices.length === 0) {
                        console.log(`Skipping token ${token.tokenId} - no price data`);
                        return;
                    }

                    // Get the latest price
                    const latestPrice = token.prices[token.prices.length - 1][1];
                    const latestTimestamp = token.prices[token.prices.length - 1][0];
                    
                    // Find price from exactly 24h ago
                    const oneDayAgo = latestTimestamp - (24 * 60 * 60 * 1000);
                    let price24hAgo = latestPrice; // Default to latest price if no 24h data
                    let closestTimeDiff = Infinity;
                    
                    // Find the closest price point to 24h ago
                    for (let j = 0; j < token.prices.length; j++) {
                        const timeDiff = Math.abs(token.prices[j][0] - oneDayAgo);
                        if (timeDiff < closestTimeDiff) {
                            closestTimeDiff = timeDiff;
                            price24hAgo = token.prices[j][1];
                        }
                    }

                    // Calculate 24h volume by summing up all volumes in the last 24h
                    let volume24h = 0;
                    if (token.total_volumes) {
                        for (let j = token.total_volumes.length - 1; j >= 0; j--) {
                            const [timestamp, volume] = token.total_volumes[j];
                            if (timestamp >= oneDayAgo) {
                                // Convert volume to USDC terms by multiplying with the price at that time
                                const priceAtTime = findClosestPrice(token.prices, timestamp);
                                volume24h += volume * priceAtTime;
                            } else {
                                break; // Stop once we're before 24h ago
                            }
                        }
                    }

                    // Calculate price change percentage
                    const priceChange24h = ((latestPrice - price24hAgo) / price24hAgo) * 100;

                    // Create snapshot data for chart (using all hourly data points)
                    const sevenDaysAgo = latestTimestamp - (7 * 24 * 60 * 60 * 1000);
                    const snapshotData = token.prices
                        .filter(([timestamp]) => timestamp >= sevenDaysAgo)
                        .map(([timestamp, price]) => [timestamp, price]);
                    
                    // Ensure we have the token ID in the correct format
                    const tokenIdStr = token.tokenId.toString().replace('@', '');
                    
                    consolidatedData[tokenIdStr] = {
                        p: latestPrice, // latest price
                        op: price24hAgo, // price 24h ago
                        pc: priceChange24h, // 24h price change percentage
                        v: volume24h, // 24h volume in USDC
                        t: latestTimestamp, // timestamp of latest price
                        s: snapshotData // snapshot data for chart (all hourly points)
                    };

                    console.log(`Processed token ${tokenIdStr}:`, {
                        price: latestPrice.toFixed(4),
                        price24hAgo: price24hAgo.toFixed(4),
                        priceChange: priceChange24h.toFixed(2) + '%',
                        volume24h: volume24h.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD'
                        }),
                        timestamp: new Date(latestTimestamp).toISOString(),
                        snapshotPoints: snapshotData.length
                    });
                });
            } else {
                console.log(`No data found for chunk ${i}`);
            }
        }

        // Store the consolidated data
        console.log('Storing consolidated data...');
        await redis.set('spot_data_latest', JSON.stringify(consolidatedData));
        console.log('Successfully stored consolidated data');

        // Print some stats
        console.log('\nConsolidated Data Stats:');
        console.log('Total tokens:', Object.keys(consolidatedData).length);
        Object.entries(consolidatedData).forEach(([tokenId, data]) => {
            console.log(`Token @${tokenId}:`, {
                price: data.p.toFixed(4),
                '24h_change': data.pc.toFixed(2) + '%',
                '24h_volume': `$${data.v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                'last_update': new Date(data.t).toISOString(),
                'snapshot_points': data.s.length
            });
        });

    } catch (error) {
        console.error('Error consolidating data:', error);
    }
}

// Helper function to find the closest price for a given timestamp
function findClosestPrice(prices, targetTimestamp) {
    let closestPrice = prices[0][1];
    let closestDiff = Math.abs(prices[0][0] - targetTimestamp);

    for (let i = 1; i < prices.length; i++) {
        const diff = Math.abs(prices[i][0] - targetTimestamp);
        if (diff < closestDiff) {
            closestDiff = diff;
            closestPrice = prices[i][1];
        }
    }

    return closestPrice;
}

// Run the consolidation
consolidateSpotData().catch(console.error); 