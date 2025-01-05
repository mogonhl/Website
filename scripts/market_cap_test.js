const fetch = require('node-fetch');
const { SPOT_TICKERS } = require('../app/types/spot_tickers.js');

async function getAllTokenDetails() {
    const payload = {
        type: "spotMetaAndAssetCtxs"
    };

    try {
        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data = await response.json();
        // Return both universe data and token details
        return {
            universe: data[0].universe,
            tokens: data[0].tokens,
            details: data[1]
        };
    } catch (error) {
        console.error('Error fetching token details:', error.message);
        return null;
    }
}

function getTokenInfo(atNumber) {
    // Convert @123 to @123 format
    const key = atNumber.startsWith('@') ? atNumber : `@${atNumber.replace('@', '')}`;
    const tokenInfo = SPOT_TICKERS[key];
    return tokenInfo || { ticker: atNumber, name: atNumber };
}

async function testMarketCap() {
    console.log('Fetching all token details...');
    const data = await getAllTokenDetails();
    if (!data) {
        console.error('Failed to fetch token details');
        return;
    }

    // Create a map of token index to token info
    const tokenMap = new Map();
    data.tokens.forEach(token => {
        tokenMap.set(token.index, token);
    });

    // Create a map of pair name to token indices
    const pairMap = new Map();
    data.universe.forEach(pair => {
        pairMap.set(pair.name, pair.tokens);
    });

    // Sort tokens by market cap
    const tokenData = [];

    for (const details of data.details) {
        if (!details.coin || details.coin === 'PURR/USDC') continue; // Skip PURR/USDC pair

        console.log(`\nProcessing ${details.coin}...`);
        
        // Get current price
        const price = parseFloat(details.markPx);
        if (!price) {
            console.log(`No price data available for ${details.coin}`);
            continue;
        }

        // Get token info from universe data
        const pairTokens = pairMap.get(details.coin);
        const tokenInfo = pairTokens ? tokenMap.get(pairTokens[0]) : null;
        const name = tokenInfo ? tokenInfo.name : details.coin;

        // Calculate market cap
        const marketCap = price * parseFloat(details.circulatingSupply);
        
        tokenData.push({
            coin: details.coin,
            name: name,
            tokenId: tokenInfo ? tokenInfo.tokenId : null,
            price,
            circulatingSupply: parseFloat(details.circulatingSupply),
            totalSupply: parseFloat(details.totalSupply),
            marketCap,
            volume24h: parseFloat(details.dayNtlVlm)
        });
    }

    // Sort by market cap
    tokenData.sort((a, b) => b.marketCap - a.marketCap);

    // Print results
    console.log('\n=== Market Cap Rankings ===');
    tokenData.forEach((token, index) => {
        console.log(`\n#${index + 1} - ${token.name}`);
        console.log(`ID: ${token.coin} (${token.tokenId || 'unknown'})`);
        console.log(`Price: $${token.price.toFixed(6)}`);
        console.log(`Market Cap: $${token.marketCap.toLocaleString('en-US', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
        })}`);
        console.log(`24h Volume: $${token.volume24h.toLocaleString('en-US', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
        })}`);
        console.log(`Circulating Supply: ${token.circulatingSupply.toLocaleString('en-US')}`);
    });

    // Calculate total market cap
    const totalMarketCap = tokenData.reduce((sum, token) => sum + token.marketCap, 0);
    console.log(`\nTotal Market Cap: $${totalMarketCap.toLocaleString('en-US', { 
        minimumFractionDigits: 2,
        maximumFractionDigits: 2 
    })}`);

    // Save data to file for future use
    const fs = require('fs');
    fs.writeFileSync('market_cap_data.json', JSON.stringify(tokenData, null, 2));
    console.log('\nData saved to market_cap_data.json');
}

// Run the test
console.log('Starting market cap test...');
testMarketCap().catch(console.error); 