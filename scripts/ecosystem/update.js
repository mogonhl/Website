const { Redis } = require('@upstash/redis');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Token configurations
const TOKENS = {
    'HYPE': {
        coingeckoId: 'hyperliquid',
        symbol: 'HYPE'
    },
    'ARB': {
        coingeckoId: 'arbitrum',
        symbol: 'ARB'
    },
    'FRIEND': {
        coingeckoId: 'friend-tech',
        symbol: 'FRIEND'
    },
    'JTO': {
        coingeckoId: 'jito-governance-token',
        symbol: 'JTO'
    },
    'ME': {
        coingeckoId: 'magic-eden',
        symbol: 'ME'
    },
    'PENGU': {
        coingeckoId: 'pudgy-penguins',
        symbol: 'PENGU'
    },
    'UNI': {
        coingeckoId: 'uniswap',
        symbol: 'UNI'
    },
    'TIA': {
        coingeckoId: 'celestia',
        symbol: 'TIA'
    },
    'ENS': {
        coingeckoId: 'ethereum-name-service',
        symbol: 'ENS'
    },
    'JUP': {
        coingeckoId: 'jupiter-exchange-solana',
        symbol: 'JUP'
    },
    'WEN': {
        coingeckoId: 'wen-4',
        symbol: 'WEN'
    },
    'AEVO': {
        coingeckoId: 'aevo-exchange',
        symbol: 'AEVO'
    },
    'ENA': {
        coingeckoId: 'ethena',
        symbol: 'ENA'
    },
    'W': {
        coingeckoId: 'wormhole',
        symbol: 'W'
    },
    'ETHFI': {
        coingeckoId: 'ether-fi',
        symbol: 'ETHFI'
    },
    'ZRO': {
        coingeckoId: 'layerzero',
        symbol: 'ZRO'
    },
    'STRK': {
        coingeckoId: 'starknet',
        symbol: 'STRK'
    },
    'EIGEN': {
        coingeckoId: 'eigenlayer',
        symbol: 'EIGEN'
    },
    'DBR': {
        coingeckoId: 'debridge',
        symbol: 'DBR'
    }
};

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

// Price Data Population
async function fetchWithDelay(tokenId, timeRange) {
    console.log(`\nFetching ${tokenId} data for ${timeRange}...`);
    
    await new Promise(resolve => setTimeout(resolve, 12000));
    
    const url = `https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart?vs_currency=usd&days=${timeRange}`;
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 429) {
                console.log('Rate limit hit, waiting 2 minutes...');
                await new Promise(resolve => setTimeout(resolve, 120000));
                return fetchWithDelay(tokenId, timeRange);
            }
            
            if (response.status === 404) {
                console.log('404 error for URL:', url);
                console.log('Trying alternative date format...');
                const altUrl = `https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart?vs_currency=usd&days=${timeRange === '365' ? 'max' : timeRange}`;
                console.log('Alternative URL:', altUrl);
                const altResponse = await fetch(altUrl);
                if (altResponse.ok) {
                    return await altResponse.json();
                }
            }
            
            throw new Error(`HTTP error! status: ${response.status} for URL: ${url}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${tokenId} for ${timeRange}:`, error);
        throw error;
    }
}

async function checkTokenIcon(symbol) {
    const iconPath = path.join(process.cwd(), 'public', 'assets', 'icons', `${symbol}.svg`);
    try {
        await fs.access(iconPath);
        return true;
    } catch {
        return false;
    }
}

async function updateToken(symbol) {
    const token = TOKENS[symbol];
    if (!token) {
        console.error(`Token ${symbol} not found!`);
        return;
    }

    console.log(`\n=== Updating ${symbol} ===`);

    // Silently check for icon existence without logging
    await checkTokenIcon(symbol);

    const timeRanges = [
        { days: '1', key: '24H' },
        { days: '7', key: '7D' },
        { days: '30', key: '30D' },
        { days: '365', key: 'All-time' }
    ];

    for (const range of timeRanges) {
        const cacheKey = `price_data_${range.key}_${symbol.toLowerCase()}`;
        
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                console.log(`\nProcessing ${symbol} for ${range.key} (attempt ${retryCount + 1}/${maxRetries})`);
                
                const data = await fetchWithDelay(token.coingeckoId, range.days);
                if (!data || !data.prices || data.prices.length === 0) {
                    throw new Error('Invalid data received from CoinGecko');
                }

                await redis.set(cacheKey, JSON.stringify(data));
                console.log(`Successfully updated ${cacheKey}`);
                break;
                
            } catch (error) {
                console.error(`Error updating ${cacheKey} (attempt ${retryCount + 1}/${maxRetries}):`, error.message);
                retryCount++;
                
                if (retryCount < maxRetries) {
                    const waitTime = retryCount * 30000;
                    console.log(`Waiting ${waitTime/1000} seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    console.log(`Failed to update ${cacheKey} after ${maxRetries} attempts, moving on...`);
                    break;
                }
            }
        }
    }
}

// Main execution
(async () => {
    try {
        console.log('\n=== Starting Price Data Updates ===');
        const tokensToProcess = process.argv.slice(2).map(t => t.toUpperCase());
        if (tokensToProcess.length === 0) {
            console.log('No tokens specified, using all tokens...');
            tokensToProcess.push(...Object.keys(TOKENS));
        }

        for (const symbol of tokensToProcess) {
            await updateToken(symbol);
            if (tokensToProcess.indexOf(symbol) !== tokensToProcess.length - 1) {
                console.log('\nWaiting 1 minute before next token...');
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        }

        console.log('\n=== All updates completed successfully! ===');
    } catch (error) {
        console.error('Error in main execution:', error);
    } finally {
        process.exit(0);
    }
})(); 