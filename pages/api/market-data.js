const fetch = require('node-fetch');

let cachedData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

async function getAllTokenDetails() {
    const payload = {
        type: "spotMetaAndAssetCtxs"
    };

    try {
        console.log('Fetching token details from Hyperliquid...');
        const response = await fetch('https://api.hyperliquid.xyz/info', {
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
        console.log('Received data from Hyperliquid:', {
            universeCount: data[0].universe.length,
            tokensCount: data[0].tokens.length,
            detailsCount: data[1].length
        });
        
        return {
            universe: data[0].universe,
            tokens: data[0].tokens,
            details: data[1]
        };
    } catch (error) {
        console.error('Error fetching token details:', error);
        return null;
    }
}

async function getMarketData() {
    // Return cached data if it's still fresh
    if (cachedData && (Date.now() - lastFetchTime < CACHE_DURATION)) {
        console.log('Returning cached market data');
        return cachedData;
    }

    console.log('Fetching fresh market data...');
    const data = await getAllTokenDetails();
    if (!data) {
        throw new Error('Failed to fetch token details');
    }

    // Log full data structure for PURR
    console.log('Universe Data:', data.universe.find(pair => pair.name === 'PURR/USDC'));
    console.log('All Tokens:', data.tokens);

    // Create maps for efficient lookups
    const tokenMap = new Map();
    data.tokens.forEach(token => {
        tokenMap.set(token.index, token);
    });

    const pairMap = new Map();
    data.universe.forEach(pair => {
        pairMap.set(pair.name, pair.tokens);
    });

    // Process token data
    const tokenData = [];
    let totalMarketCap = 0;

    for (const details of data.details) {
        if (!details.coin) continue;  // Only skip if no coin name

        // Log PURR data for debugging
        if (details.coin === 'PURR/USDC') {
            console.log('PURR Details:', details);
            console.log('PURR Pair Tokens:', pairMap.get(details.coin));
            const purrTokens = pairMap.get(details.coin);
            if (purrTokens) {
                console.log('PURR Token Info:', tokenMap.get(purrTokens[0]));
            }
        }

        const price = parseFloat(details.markPx);
        if (!price) continue;

        // Get token info
        const pairTokens = pairMap.get(details.coin);
        const tokenInfo = pairTokens ? tokenMap.get(pairTokens[0]) : null;
        const tokenId = tokenInfo ? tokenInfo.tokenId : null;
        
        // Special handling for PURR/USDC
        let name, ticker;
        if (details.coin === 'PURR/USDC') {
            name = 'PURR';
            ticker = 'PURR';
        } else {
            name = details.coin;
            ticker = details.coin.split('/')[0];  // Get ticker from the trading pair
        }

        // Calculate market cap
        const marketCap = price * parseFloat(details.circulatingSupply);
        totalMarketCap += marketCap;

        // Calculate 24h change
        const prevPrice = parseFloat(details.prevDayPx);
        const priceChange = prevPrice ? ((price - prevPrice) / prevPrice) * 100 : 0;

        tokenData.push({
            coin: details.coin,
            name,
            ticker,
            tokenId,
            price,
            priceChange,
            circulatingSupply: parseFloat(details.circulatingSupply),
            totalSupply: parseFloat(details.totalSupply),
            marketCap,
            volume24h: parseFloat(details.dayNtlVlm)
        });
    }

    // Sort by market cap
    tokenData.sort((a, b) => {
        // Ensure we have valid numbers for comparison
        const aMarketCap = a.marketCap || 0;
        const bMarketCap = b.marketCap || 0;
        
        // Primary sort by market cap
        if (aMarketCap !== bMarketCap) {
            return bMarketCap - aMarketCap;
        }
        
        // Secondary sort by volume if market caps are equal
        const aVolume = a.volume24h || 0;
        const bVolume = b.volume24h || 0;
        if (aVolume !== bVolume) {
            return bVolume - aVolume;
        }
        
        // Tertiary sort by name if both market cap and volume are equal
        return a.name.localeCompare(b.name);
    });

    // Update cache
    cachedData = {
        tokens: tokenData,
        totalMarketCap,
        timestamp: Date.now()
    };
    lastFetchTime = Date.now();

    console.log('Processed market data:', {
        tokenCount: tokenData.length,
        totalMarketCap
    });

    return cachedData;
}

module.exports = async function handler(req, res) {
    try {
        console.log('Market data API called');
        const data = await getMarketData();
        res.status(200).json(data);
    } catch (error) {
        console.error('Error in market-data API:', error);
        res.status(500).json({ error: 'Failed to fetch market data' });
    }
}; 