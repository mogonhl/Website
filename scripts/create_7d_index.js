const { Redis } = require('@upstash/redis');
require('dotenv').config({ path: '../.env' });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function create7dIndex() {
    try {
        // First, get the daily index data to determine token weights
        console.log('Fetching daily index data...');
        const dailyIndexData = await redis.get('spot_data_daily_index');
        if (!dailyIndexData) {
            throw new Error('Daily index data not found - needed for token weights');
        }

        const dailyIndex = typeof dailyIndexData === 'string' ? JSON.parse(dailyIndexData) : dailyIndexData;
        if (!dailyIndex.prices || !Array.isArray(dailyIndex.prices)) {
            throw new Error('Invalid daily index data format');
        }

        // Get the latest price point from daily data
        const latestDailyPoint = dailyIndex.prices[dailyIndex.prices.length - 1];
        console.log('Latest daily index point:', {
            timestamp: new Date(latestDailyPoint[0]).toISOString(),
            price: latestDailyPoint[1]
        });

        // Collect all 7D data from individual tokens
        const tokens = [
            'aevo', 'arb', 'dbr', 'eigen', 'ena', 'ens', 'ethfi', 'friend', 
            'hype', 'jto', 'jup', 'me', 'pengu', 'strk', 'tia', 'uni', 'w', 
            'wen', 'zro'
        ];

        console.log('\nFetching 7D data for all tokens...');
        const tokenData = [];

        // First, get the daily data for each token to determine their weights
        const tokenWeights = new Map();
        let totalValue = 0;

        for (const token of tokens) {
            const dailyData = await redis.get(`price_data_All-time_${token}`);
            if (dailyData) {
                const parsed = typeof dailyData === 'string' ? JSON.parse(dailyData) : dailyData;
                if (parsed && parsed.prices && parsed.prices.length > 0) {
                    // Get the latest price from daily data
                    const latestPrice = parsed.prices[parsed.prices.length - 1][1];
                    // Assume 1 unit of each token for now (we'll normalize later)
                    tokenWeights.set(token, latestPrice);
                    totalValue += latestPrice;
                }
            }
        }

        // Normalize weights to match the daily index value
        const targetValue = latestDailyPoint[1];
        const normalizer = targetValue / totalValue;
        
        console.log('\nCalculated token weights:');
        for (const [token, weight] of tokenWeights) {
            const normalizedWeight = weight * normalizer;
            tokenWeights.set(token, normalizedWeight);
            console.log(`${token}: ${normalizedWeight.toFixed(8)}`);
        }

        // Now fetch hourly data for the last 7 days
        for (const token of tokens) {
            const data = await redis.get(`price_data_7D_${token}`);
            if (data) {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                if (parsed && parsed.prices && Array.isArray(parsed.prices)) {
                    tokenData.push({
                        token,
                        weight: tokenWeights.get(token) || 0,
                        ...parsed
                    });
                    console.log(`Fetched hourly data for ${token}: ${parsed.prices.length} points`);
                }
            }
        }

        console.log(`\nFound hourly data for ${tokenData.length} tokens`);

        // Create a map of timestamp to aggregated data
        const timestampMap = new Map();

        // Process each token's data
        tokenData.forEach((token) => {
            if (!token.prices || !token.total_volumes) {
                console.log(`Skipping token ${token.token} - missing price or volume data`);
                return;
            }

            // Get first price for logging
            const firstPrice = token.prices[0]?.[1];
            if (!firstPrice) {
                console.log(`Skipping token ${token.token} - no valid first price`);
                return;
            }

            console.log(`\nProcessing ${token.token}:`);
            console.log(`Weight: ${token.weight}`);
            console.log(`First price: ${firstPrice}`);
            console.log(`Last price: ${token.prices[token.prices.length - 1]?.[1]}`);
            console.log(`Price points: ${token.prices.length}`);

            // Process each price point
            token.prices.forEach((pricePoint, index) => {
                const [timestamp, price] = pricePoint;
                const volume = token.total_volumes[index]?.[1] || 0;
                const weightedPrice = price * token.weight;

                if (!timestampMap.has(timestamp)) {
                    timestampMap.set(timestamp, {
                        totalVolume: 0,
                        totalValue: 0,
                        tokenCount: 0,
                        rawPrices: []
                    });
                }

                const data = timestampMap.get(timestamp);
                data.totalVolume += volume;
                data.totalValue += weightedPrice;
                data.tokenCount++;
                data.rawPrices.push({
                    token: token.token,
                    price: weightedPrice,
                    volume
                });
            });
        });

        // Calculate final weighted prices and create arrays
        const indexData = {
            prices: [],
            total_volumes: [],
            market_caps: []
        };

        // Convert map to sorted arrays
        const sortedTimestamps = Array.from(timestampMap.keys()).sort();
        
        // Debug first few timestamps
        console.log('\nFirst 5 timestamps processing:');
        sortedTimestamps.slice(0, 5).forEach(timestamp => {
            const data = timestampMap.get(timestamp);
            console.log(`\nTimestamp: ${new Date(timestamp).toISOString()}`);
            console.log(`Token count: ${data.tokenCount}`);
            console.log(`Total volume: ${data.totalVolume}`);
            console.log(`Total value: ${data.totalValue.toFixed(4)}`);
            console.log(`Sample weighted prices:`, data.rawPrices.slice(0, 3).map(p => p.price.toFixed(4)));
        });

        // Process all timestamps
        sortedTimestamps.forEach(timestamp => {
            const data = timestampMap.get(timestamp);
            const indexPrice = data.totalValue;  // Sum of weighted prices

            indexData.prices.push([timestamp, indexPrice]);
            indexData.total_volumes.push([timestamp, data.totalVolume]);
            indexData.market_caps.push([timestamp, 0]);
        });

        // Store the index data
        console.log('\nStoring 7D index data...');
        console.log(`Generated ${indexData.prices.length} data points`);
        
        await redis.set('spot_data_7d_index', JSON.stringify(indexData));
        console.log('Successfully stored 7D index data');

        // Print some stats
        if (indexData.prices.length > 0) {
            const firstPrice = indexData.prices[0];
            const lastPrice = indexData.prices[indexData.prices.length - 1];
            const priceChange = ((lastPrice[1] - firstPrice[1]) / firstPrice[1]) * 100;

            console.log('\nIndex Statistics:');
            console.log('Start date:', new Date(firstPrice[0]).toISOString());
            console.log('End date:', new Date(lastPrice[0]).toISOString());
            console.log('First price:', firstPrice[1].toFixed(4));
            console.log('Last price:', lastPrice[1].toFixed(4));
            console.log('Price change:', priceChange.toFixed(2) + '%');
            console.log('Total data points:', indexData.prices.length);

            // Print some intermediate points
            console.log('\nSample points throughout the period:');
            const numSamples = 5;
            for (let i = 0; i < numSamples; i++) {
                const idx = Math.floor(i * (indexData.prices.length - 1) / (numSamples - 1));
                const point = indexData.prices[idx];
                console.log(`${new Date(point[0]).toISOString()}: ${point[1].toFixed(4)}`);
            }
        } else {
            console.log('No price data points were generated');
        }

    } catch (error) {
        console.error('Error creating 7D index:', error);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

create7dIndex().catch(console.error); 