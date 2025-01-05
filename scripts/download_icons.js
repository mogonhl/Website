const fs = require('fs');
const https = require('https');
const path = require('path');
const { SPOT_TICKERS } = require('../app/types/spot_tickers');

const ICONS_DIR = path.join(__dirname, '../public/assets');

// Create icons directory if it doesn't exist
if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
}

async function downloadIcon(ticker) {
    if (!ticker) return; // Skip empty tickers
    
    const url = `https://app.hyperliquid.xyz/coins/${ticker}_USDC.svg`;
    const filePath = path.join(ICONS_DIR, `${ticker}.svg`);

    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                const file = fs.createWriteStream(filePath);
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`Downloaded ${ticker}.svg`);
                    resolve();
                });
            } else {
                console.log(`Failed to download ${ticker}.svg - Status: ${response.statusCode}`);
                resolve(); // Continue with other downloads even if one fails
            }
        }).on('error', (err) => {
            console.error(`Error downloading ${ticker}.svg:`, err.message);
            resolve(); // Continue with other downloads even if one fails
        });
    });
}

async function downloadAllIcons() {
    console.log('Starting icon downloads...');
    // Get all valid tickers
    const tickers = Object.entries(SPOT_TICKERS)
        .map(([id, data]) => data.ticker)
        .filter(ticker => ticker); // Remove empty tickers
    
    for (const ticker of tickers) {
        await downloadIcon(ticker);
    }
    
    console.log('Icon downloads complete!');
}

downloadAllIcons(); 