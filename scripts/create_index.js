const { Redis } = require('@upstash/redis');
require('dotenv').config({ path: '../.env' });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function createIndex() {
    try {
        console.log('Fetching spot data...');
        const spotData = await redis.get('spot_data_daily_all');
        if (!spotData) {
            throw new Error('No spot data found');
        }

        // Handle both string and object responses
        const tokens = typeof spotData === 'string' ? JSON.parse(spotData) : spotData;
        console.log(`Found data for ${tokens.length} tokens`);

        // Create a map of timestamp to aggregated data
        const timestampMap = new Map();
        let totalProcessedTokens = 0;

        // Process each token's data
        tokens.forEach((token, idx) => {
            if (!token.prices || !token.total_volumes) {
                console.log(`Skipping token ${idx} - missing price or volume data`);
                return;
            }

            // Need at least 2 price points
            if (token.prices.length < 2) {
                console.log(`Skipping token ${idx} - need at least 2 price points`);
                return;
            }

            // Get first 48 hours of prices for DCA
            const first48Hours = token.prices.slice(0, 48);
            if (first48Hours.length < 10) {
                console.log(`Skipping token ${idx} - need at least 10 price points in first 48 hours`);
                return;
            }

            // Select 10 evenly spaced points for investment
            const step = Math.floor(first48Hours.length / 10);
            const investmentPoints = Array.from({length: 10}, (_, i) => first48Hours[i * step]);
            
            // Calculate total units from $0.1 investments at each point
            let totalUnits = 0;
            investmentPoints.forEach(([timestamp, price]) => {
                const investment = 0.1; // $0.1 per investment
                const units = investment / price;
                totalUnits += units;
            });

            console.log(`\nProcessing token ${idx}:`);
            console.log(`First day price: ${token.prices[0]?.[1]}`);
            console.log(`Average entry price: ${1 / totalUnits}`);
            console.log(`Total units: ${totalUnits}`);
            console.log(`Last price: ${token.prices[token.prices.length - 1]?.[1]}`);
            console.log(`Price points: ${token.prices.length}`);

            // Process each price point
            token.prices.forEach((pricePoint, index) => {
                const [timestamp, price] = pricePoint;
                // Adjust timestamp by subtracting one year
                const adjustedTimestamp = timestamp - (365 * 24 * 60 * 60 * 1000);
                const currentValue = price * totalUnits; // Value of our total investment

                if (!timestampMap.has(adjustedTimestamp)) {
                    timestampMap.set(adjustedTimestamp, {
                        totalValue: 0,
                        tokenCount: 0,
                        investments: []
                    });
                }

                const data = timestampMap.get(adjustedTimestamp);
                data.totalValue += currentValue;
                data.tokenCount++;
                data.investments.push({
                    token: idx,
                    value: currentValue,
                    price,
                    units: totalUnits,
                    averageEntryPrice: 1 / totalUnits
                });
            });

            totalProcessedTokens++;
        });

        console.log(`\nProcessed ${totalProcessedTokens} tokens successfully`);

        // Calculate final index values and create arrays
        const indexData = {
            prices: [],
            total_volumes: [],
            market_caps: []
        };

        // Track individual token performance
        const tokenPerformance = new Map();
        tokens.forEach((token, idx) => {
            if (token.prices && token.prices.length >= 2) {
                const initialPrice = token.prices[1][1];
                const finalPrice = token.prices[token.prices.length - 1][1];
                const return_pct = ((finalPrice - initialPrice) / initialPrice) * 100;
                tokenPerformance.set(idx, {
                    initialPrice,
                    finalPrice,
                    return_pct
                });
            }
        });

        // Get top 3 performers
        const topPerformers = Array.from(tokenPerformance.entries())
            .sort((a, b) => b[1].return_pct - a[1].return_pct)
            .slice(0, 3);

        // Convert map to sorted arrays
        const sortedTimestamps = Array.from(timestampMap.keys()).sort();
        
        // Debug first few timestamps
        console.log('\nFirst 5 timestamps processing:');
        sortedTimestamps.slice(0, 5).forEach(timestamp => {
            const data = timestampMap.get(timestamp);
            console.log(`\nTimestamp: ${new Date(timestamp).toISOString()}`);
            console.log(`Token count: ${data.tokenCount}`);
            console.log(`Total portfolio value: $${data.totalValue.toFixed(4)}`);
            console.log(`Sample investments:`, data.investments.slice(0, 3).map(inv => ({
                value: `$${inv.value.toFixed(4)}`,
                units: inv.units.toFixed(4),
                price: `$${inv.price.toFixed(4)}`
            })));
        });

        // Process all timestamps
        sortedTimestamps.forEach(timestamp => {
            const data = timestampMap.get(timestamp);
            const indexValue = data.totalValue; // Total value of all $1 investments

            indexData.prices.push([timestamp, indexValue]);
            indexData.total_volumes.push([timestamp, 0]); // We don't use volumes for this index
            indexData.market_caps.push([timestamp, 0]);
        });

        // Store the index data
        console.log('\nStoring index data...');
        console.log(`Generated ${indexData.prices.length} data points`);

        // Find the top performers
        const [first, second, third] = topPerformers;
        const performersInfo = {
            bestPerformer: {
                tokenId: first[0],
                ticker: `Token ${first[0]}`,
                initialPrice: first[1].initialPrice,
                finalPrice: first[1].finalPrice,
                return_pct: first[1].return_pct
            },
            secondBestPerformer: second ? {
                tokenId: second[0],
                ticker: `Token ${second[0]}`,
                initialPrice: second[1].initialPrice,
                finalPrice: second[1].finalPrice,
                return_pct: second[1].return_pct
            } : null,
            thirdBestPerformer: third ? {
                tokenId: third[0],
                ticker: `Token ${third[0]}`,
                initialPrice: third[1].initialPrice,
                finalPrice: third[1].finalPrice,
                return_pct: third[1].return_pct
            } : null
        };
        
        // Store both index data and performers info
        const dataToStore = {
            ...indexData,
            ...performersInfo
        };
        
        await redis.set('spot_data_daily_index', JSON.stringify(dataToStore));
        console.log('Successfully stored index data');

        // Print some stats
        if (indexData.prices.length > 0) {
            const firstPrice = indexData.prices[0];
            const lastPrice = indexData.prices[indexData.prices.length - 1];
            const priceChange = ((lastPrice[1] - firstPrice[1]) / firstPrice[1]) * 100;

            console.log('\nIndex Statistics:');
            console.log('Start date:', new Date(firstPrice[0]).toISOString());
            console.log('End date:', new Date(lastPrice[0]).toISOString());
            console.log('First value:', `$${firstPrice[1].toFixed(4)}`);
            console.log('Last value:', `$${lastPrice[1].toFixed(4)}`);
            console.log('Total return:', priceChange.toFixed(2) + '%');
            console.log('Total data points:', indexData.prices.length);

            // Print top performers
            console.log('\nTop 3 Performing Tokens:');
            topPerformers.forEach(([tokenIdx, perf], rank) => {
                console.log(`${rank + 1}. Token ${tokenIdx}:`);
                console.log(`   Initial Price: $${perf.initialPrice.toFixed(4)}`);
                console.log(`   Final Price: $${perf.finalPrice.toFixed(4)}`);
                console.log(`   Return: ${perf.return_pct.toFixed(2)}%`);
            });

            // Print some intermediate points
            console.log('\nSample points throughout the period:');
            const numSamples = 5;
            for (let i = 0; i < numSamples; i++) {
                const idx = Math.floor(i * (indexData.prices.length - 1) / (numSamples - 1));
                const point = indexData.prices[idx];
                console.log(`${new Date(point[0]).toISOString()}: $${point[1].toFixed(4)}`);
            }
        } else {
            console.log('No price data points were generated');
        }

    } catch (error) {
        console.error('Error creating index:', error);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

createIndex().catch(console.error); 