const fetch = require('node-fetch');
const { SPOT_TICKERS } = require('../../app/types/spot_tickers');

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
        if (!details.coin || details.coin === 'PURR/USDC') continue;

        const price = parseFloat(details.markPx);
        if (!price) continue;

        // Get token info
        const pairTokens = pairMap.get(details.coin);
        const tokenInfo = pairTokens ? tokenMap.get(pairTokens[0]) : null;
        const tokenId = tokenInfo ? tokenInfo.tokenId : null;
        
        // Get ticker from SPOT_TICKERS
        const spotTicker = Object.entries(SPOT_TICKERS).find(([id]) => id === `@${tokenId}`)?.[1];
        const ticker = spotTicker?.ticker || '';
        const name = spotTicker?.name || details.coin;

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
    tokenData.sort((a, b) => b.marketCap - a.marketCap);

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