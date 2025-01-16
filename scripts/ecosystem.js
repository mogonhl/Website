// Environment Variables
process.env.CRON_SECRET = "126d7c963b4644e8c384d00d25e483be6a25d507e0acd3b8d7d09da83752bc2d";
process.env.NX_DAEMON = "";
process.env.TURBO_CACHE = "";
process.env.TURBO_DOWNLOAD_LOCAL_ENABLED = "";
process.env.TURBO_REMOTE_ONLY = "";
process.env.TURBO_RUN_SUMMARY = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "AZxyAAIjcDE3Mzk2MTJkNzJjMDg0Yzk0ODMyZWE3YmRjOGRmZTQxZHAxMA";
process.env.UPSTASH_REDIS_REST_URL = "https://witty-dassie-40050.upstash.io";
process.env.VERCEL = "1";
process.env.VERCEL_ENV = "development";
process.env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN = "";
process.env.VERCEL_GIT_COMMIT_AUTHOR_NAME = "";
process.env.VERCEL_GIT_COMMIT_MESSAGE = "";
process.env.VERCEL_GIT_COMMIT_REF = "";
process.env.VERCEL_GIT_COMMIT_SHA = "";
process.env.VERCEL_GIT_PREVIOUS_SHA = "";
process.env.VERCEL_GIT_PROVIDER = "";
process.env.VERCEL_GIT_PULL_REQUEST_ID = "";
process.env.VERCEL_GIT_REPO_ID = "";
process.env.VERCEL_GIT_REPO_OWNER = "";
process.env.VERCEL_GIT_REPO_SLUG = "";
process.env.VERCEL_URL = "";

const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');
const https = require('https');
const fetch = require('node-fetch');
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

const ICONS_DIR = path.join(__dirname, '../public/assets/icons/spot');

// ===== Icon Download Functions =====

async function fetchTokenNames() {
    console.log('Fetching token names from Hyperliquid API...');
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.hyperliquid.xyz',
            path: '/info',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    if (!Array.isArray(jsonData) || jsonData.length < 2) {
                        throw new Error('Invalid API response structure');
                    }

                    const universe = jsonData[0].universe;
                    const tokens = jsonData[0].tokens;
                    const marketData = jsonData[1];

                    const tokenNames = {};
                    marketData.forEach(t => {
                        const meta = universe.find(m => m.name === t.coin);
                        if (!meta) {
                            console.log(`No metadata found for token ${t.coin}`);
                            return;
                        }
                        
                        const tokenInfo = tokens.find(token => token.index === meta.tokens[0]);
                        if (!tokenInfo) {
                            console.log(`No token info found for ${t.coin}`);
                            return;
                        }

                        console.log(`Processing token: ${t.coin} -> ${tokenInfo.name}`);
                        tokenNames[t.coin] = tokenInfo.name;
                    });

                    tokenNames['PURR/USDC'] = 'PURR';

                    console.log(`Found ${Object.keys(tokenNames).length} tokens`);
                    
                    const namesPath = path.join(__dirname, '../spot_names.json');
                    fs.writeFileSync(namesPath, JSON.stringify(tokenNames, null, 2));
                    console.log('Token names saved to spot_names.json');

                    resolve(tokenNames);
                } catch (error) {
                    console.error('Error parsing token data:', error.message);
                    resolve({});
                }
            });
        });

        req.on('error', (error) => {
            console.error('Error fetching token names:', error.message);
            resolve({});
        });

        req.write(JSON.stringify({
            type: "spotMetaAndAssetCtxs"
        }));
        req.end();
    });
}

async function downloadIcon(name) {
    console.log(`Downloading icon for ${name}...`);
    
    return new Promise((resolve) => {
        const iconUrl = `https://app.hyperliquid.xyz/coins/${name}_USDC.svg`;
        const iconPath = path.join(ICONS_DIR, `${name}.svg`);

        const req = https.get(iconUrl, (res) => {
            if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(iconPath);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`Successfully downloaded ${name}.svg`);
                    resolve(true);
                });
            } else {
                console.log(`Failed to download ${name}.svg (status: ${res.statusCode})`);
                resolve(false);
            }
        });

        req.on('error', (error) => {
            console.error(`Error downloading ${name}.svg:`, error.message);
            resolve(false);
        });
    });
}

async function downloadAllIcons() {
    console.log('\n=== Downloading Icons ===');
    
    if (!fs.existsSync(ICONS_DIR)) {
        fs.mkdirSync(ICONS_DIR, { recursive: true });
    }

    await downloadIcon('default');
    const tokenNames = await fetchTokenNames();
    
    for (const [id, name] of Object.entries(tokenNames)) {
        await downloadIcon(name);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// ===== Spot Data Update Functions =====

async function fetchSpotData(coin, interval, days) {
    const isTokenId = typeof coin === 'number';
    const coinStr = isTokenId ? `@${coin}` : coin;
    console.log(`\nFetching ${interval} data for ${isTokenId ? 'token' : 'pair'} ${coinStr} (${days} days)...`);
    
    const now = Date.now();
    const startTime = now - (days * 24 * 60 * 60 * 1000);
    
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
                console.log(`No supply data found for token ${coinStr}`);
                return null;
            }

            console.log(`Found circulating supply for ${coinStr}: ${circulatingSupply.toLocaleString()}`);
        } catch (error) {
            console.error(`Error fetching supply data for ${coinStr}:`, error.message);
            return null;
        }
    }

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

        const marketCaps = data.map(candle => [
            candle.t, 
            isTokenId ? parseFloat(candle.c) * circulatingSupply : 0
        ]);

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
    console.log('\n=== Populating Spot Data ===');
    
    const dailyData = [];
    const CHUNK_SIZE = 5;
    
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

        if (dailyData.length >= CHUNK_SIZE) {
            try {
                const chunkNumber = Math.floor((tokenId - 1) / CHUNK_SIZE);
                console.log(`\nStoring chunk ${chunkNumber} (tokens ${tokenId - CHUNK_SIZE} to ${tokenId - 1})...`);
                
                const dataStr = JSON.stringify(dailyData);
                if (dataStr.length > 900000) {
                    console.log('Data size too large, splitting chunk further...');
                    const halfSize = Math.ceil(dailyData.length / 2);
                    const firstHalf = dailyData.slice(0, halfSize);
                    const secondHalf = dailyData.slice(halfSize);
                    
                    await redis.set(`spot_data_daily_chunk_${chunkNumber}_a`, JSON.stringify(firstHalf));
                    await redis.set(`spot_data_daily_chunk_${chunkNumber}_b`, JSON.stringify(secondHalf));
                } else {
                    await redis.set(`spot_data_daily_chunk_${chunkNumber}`, dataStr);
                }
                
                dailyData.length = 0;
            } catch (error) {
                console.error('Error storing data chunk:', error);
                throw error;
            }
        }
    }

    if (dailyData.length > 0) {
        try {
            const chunkNumber = Math.floor((tokenId - 1) / CHUNK_SIZE);
            console.log(`\nStoring final chunk ${chunkNumber} (${dailyData.length} tokens)...`);
            
            const dataStr = JSON.stringify(dailyData);
            if (dataStr.length > 900000) {
                const halfSize = Math.ceil(dailyData.length / 2);
                const firstHalf = dailyData.slice(0, halfSize);
                const secondHalf = dailyData.slice(halfSize);
                
                await redis.set(`spot_data_daily_chunk_${chunkNumber}_a`, JSON.stringify(firstHalf));
                await redis.set(`spot_data_daily_chunk_${chunkNumber}_b`, JSON.stringify(secondHalf));
            } else {
                await redis.set(`spot_data_daily_chunk_${chunkNumber}`, dataStr);
            }
        } catch (error) {
            console.error('Error storing final chunk:', error);
            throw error;
        }
    }

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

    return await loadAllChunks();
}

// ===== Consolidation Functions =====

async function consolidateSpotData() {
    console.log('\n=== Consolidating Spot Data ===');
    
    try {
        const numChunks = await redis.get('spot_data_7d_chunks');
        if (!numChunks) {
            console.error('No spot data chunks found');
            return;
        }

        console.log(`Found ${numChunks} chunks to process...`);
        const consolidatedData = {};

        for (let i = 0; i < parseInt(numChunks); i++) {
            console.log(`Processing chunk ${i}...`);
            const chunkData = await redis.get(`spot_data_7d_${i}`);
            if (chunkData) {
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

                    const latestPrice = token.prices[token.prices.length - 1][1];
                    const latestTimestamp = token.prices[token.prices.length - 1][0];
                    
                    const oneDayAgo = latestTimestamp - (24 * 60 * 60 * 1000);
                    let price24hAgo = latestPrice;
                    let closestTimeDiff = Infinity;
                    
                    for (let j = 0; j < token.prices.length; j++) {
                        const timeDiff = Math.abs(token.prices[j][0] - oneDayAgo);
                        if (timeDiff < closestTimeDiff) {
                            closestTimeDiff = timeDiff;
                            price24hAgo = token.prices[j][1];
                        }
                    }

                    let volume24h = 0;
                    if (token.total_volumes) {
                        for (let j = token.total_volumes.length - 1; j >= 0; j--) {
                            const [timestamp, volume] = token.total_volumes[j];
                            if (timestamp >= oneDayAgo) {
                                const priceAtTime = findClosestPrice(token.prices, timestamp);
                                volume24h += volume * priceAtTime;
                            } else {
                                break;
                            }
                        }
                    }

                    const priceChange24h = ((latestPrice - price24hAgo) / price24hAgo) * 100;

                    const sevenDaysAgo = latestTimestamp - (7 * 24 * 60 * 60 * 1000);
                    const snapshotData = token.prices
                        .filter(([timestamp]) => timestamp >= sevenDaysAgo)
                        .map(([timestamp, price]) => [timestamp, price]);
                    
                    consolidatedData[token.tokenId] = {
                        p: latestPrice,
                        op: price24hAgo,
                        pc: priceChange24h,
                        v: volume24h,
                        t: latestTimestamp,
                        s: snapshotData
                    };
                });
            }
        }

        console.log('Storing consolidated data...');
        await redis.set('spot_data_latest', JSON.stringify(consolidatedData));
        console.log('Successfully stored consolidated data');

        return consolidatedData;
    } catch (error) {
        console.error('Error consolidating data:', error);
        throw error;
    }
}

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

// ===== Index Creation Functions =====

async function loadAllChunks() {
    try {
        const metadata = await redis.get('spot_data_daily_metadata');
        if (!metadata) {
            throw new Error('No metadata found for daily data chunks');
        }

        const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
        const { totalChunks } = parsedMetadata;
        const allData = [];

        console.log(`Loading ${totalChunks} daily data chunks...`);
        for (let i = 0; i < totalChunks; i++) {
            console.log(`Loading daily chunk ${i}...`);
            const chunkData = await redis.get(`spot_data_daily_chunk_${i}`);
            if (chunkData) {
                const parsed = typeof chunkData === 'string' ? JSON.parse(chunkData) : chunkData;
                allData.push(...parsed);
            }
        }

        console.log(`\nLoaded ${allData.length} tokens from ${totalChunks} chunks`);
        return allData;
    } catch (error) {
        console.error('Error loading daily data chunks:', error);
        throw error;
    }
}

async function determineStableStartPoint(tokens, minTokens = 5) {
    console.log(`\n=== Determining Stable Start Point (minimum ${minTokens} tokens) ===`);
    
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

    const timestampEntries = Array.from(tokensByTimestamp.entries())
        .sort(([a], [b]) => a - b);

    for (const [timestamp, activeTokens] of timestampEntries) {
        if (activeTokens.size >= minTokens) {
            console.log(`Found stable start point at ${new Date(timestamp).toISOString()}`);
            console.log(`Number of active tokens: ${activeTokens.size}`);
            return timestamp;
        }
    }

    console.log('Warning: Could not find a point with enough tokens, using earliest available data');
    return timestampEntries[0]?.[0];
}

async function createIndices(tokens) {
    console.log('\n=== Creating Multiple Indices ===');

    const stableStartTimestamp = await determineStableStartPoint(tokens, 5);
    
    console.log('\nCreating Market Cap Index (with HYPE)...');
    await createMarketCapIndex(tokens, true, 'spot_data_mcap_index', stableStartTimestamp);
    
    console.log('\nCreating Market Cap Ex-HYPE Index...');
    await createMarketCapIndex(tokens, false, 'spot_data_mcap_ex_hype_index', stableStartTimestamp);
}

async function createMarketCapIndex(tokens, includeHype, redisKey, stableStartTimestamp) {
    console.log(`\nProcessing index with includeHype = ${includeHype}`);
    
    const tokensToProcess = includeHype 
        ? tokens 
        : tokens.filter(t => String(t.tokenId) !== '107');

    const timestamps = new Set();
    tokensToProcess.forEach(token => {
        if (!token.prices) return;
        token.prices.forEach(([timestamp]) => {
            if (timestamp >= stableStartTimestamp) {
                timestamps.add(timestamp);
            }
        });
    });

    const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b);
    
    const indexValues = sortedTimestamps.map(timestamp => {
        let totalMcap = 0;
        let weightedSum = 0;
        let validTokenCount = 0;
        
        tokensToProcess.forEach(token => {
            const pricePoint = token.prices?.find(([t]) => t === timestamp);
            const mcapPoint = token.market_caps?.find(([t]) => t === timestamp);
            
            if (pricePoint && mcapPoint) {
                const [, price] = pricePoint;
                const [, mcap] = mcapPoint;
                if (!isNaN(mcap) && mcap > 0) {
                    totalMcap += mcap;
                    validTokenCount++;
                }
            }
        });
        
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
                    }
                }
            });
        }
        
        return [timestamp, weightedSum];
    }).filter(([, value]) => !isNaN(value) && value > 0);

    await redis.set(redisKey, { prices: indexValues });
}

// ===== Latest Launch Tracking Functions =====

async function findLatestToken() {
    try {
        const tokenNames = JSON.parse(fs.readFileSync(path.join(__dirname, '../spot_names.json'), 'utf8'));

        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: "spotMetaAndAssetCtxs" })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const tokens = data[1];

        const activeTokens = tokens
            .filter(token => 
                token.coin.startsWith('@') && 
                token.markPx !== '1.0' && 
                parseFloat(token.circulatingSupply) > 0)
            .sort((a, b) => {
                const idA = parseInt(a.coin.replace('@', ''));
                const idB = parseInt(b.coin.replace('@', ''));
                return idB - idA;
            });

        const latestTokens = activeTokens.slice(0, 3);
        if (latestTokens.length === 0) {
            console.log('No tokens found');
            return;
        }

        const newLaunches = [];
        for (const token of latestTokens) {
            const tokenId = parseInt(token.coin.replace('@', ''));
            const batchNum = Math.floor(tokenId / 20);
            
            const batchData = await redis.get(`spot_data_7d_${batchNum}`);
            const parsedBatchData = typeof batchData === 'string' ? JSON.parse(batchData) : batchData;
            
            const tokenData = Array.isArray(parsedBatchData) ? 
                parsedBatchData.find(d => d.tokenId === tokenId) : null;

            if (!tokenData || !Array.isArray(tokenData.prices) || tokenData.prices.length === 0) {
                console.log('No historical data found for token:', token.coin);
                continue;
            }

            const sortedPrices = [...tokenData.prices].sort((a, b) => a[0] - b[0]);
            newLaunches.push({
                fullName: token.coin,
                name: tokenNames[token.coin] || token.coin,
                launchTime: sortedPrices[0][0],
                launchPrice: sortedPrices[0][1]
            });
        }

        if (newLaunches.length === 0) {
            console.log('No launch data found for any tokens');
            return;
        }

        newLaunches.sort((a, b) => a.launchTime - b.launchTime);
        await redis.set('latest_launches', JSON.stringify(newLaunches));
        console.log('Updated launches:', newLaunches);

        return newLaunches[newLaunches.length - 1];
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

// ===== Main Execution =====

async function main() {
    try {
        // 1. Get PURR/USDC 7-day hourly data
        console.log('\n=== Fetching PURR/USDC 7-day hourly data ===');
        const purrHourlyData = await fetchSpotData('PURR/USDC', '1h', 7);
        if (purrHourlyData && purrHourlyData.prices && purrHourlyData.prices.length > 0) {
            console.log('Successfully fetched PURR/USDC hourly data');
            console.log(`Found ${purrHourlyData.prices.length} data points`);
            
            // Ensure timestamps are in the past
            const now = Date.now();
            const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
            
            // Sort by timestamp and filter out future timestamps
            const validPrices = purrHourlyData.prices
                .filter(([timestamp]) => timestamp <= now && timestamp >= sevenDaysAgo)
                .sort((a, b) => a[0] - b[0]);
            
            const validVolumes = purrHourlyData.total_volumes
                .filter(([timestamp]) => timestamp <= now && timestamp >= sevenDaysAgo)
                .sort((a, b) => a[0] - b[0]);

            // Format data in the structure expected by the frontend
            const formattedData = [{
                tokenId: 'purr',
                prices: validPrices,
                total_volumes: validVolumes
            }];

            console.log('Sample data:', {
                firstPrice: validPrices[0],
                lastPrice: validPrices[validPrices.length - 1],
                totalPoints: validPrices.length
            });

            console.log('Storing PURR/USDC hourly data...');
            await redis.set('spot_data_7d_purr', JSON.stringify(formattedData));
            await redis.set('spot_data_7d_has_purr', 'true');
            console.log('Successfully stored PURR/USDC hourly data');
        } else {
            console.log('No PURR/USDC hourly data found');
        }

        // 2. Download Icons
        await downloadAllIcons();

        // 3. Update Spot Data
        const spotData = await populateSpotData();
        
        // 4. Consolidate Spot Data
        await consolidateSpotData();
        
        // 5. Create Indices
        await createIndices(spotData);
        
        // 6. Track Latest Launch
        await findLatestToken();

        console.log('\nAll ecosystem updates completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error in main execution:', error);
        process.exit(1);
    }
}

main(); 