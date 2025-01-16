const fs = require('fs');
const path = require('path');
const https = require('https');

const ICONS_DIR = path.join(__dirname, '../public/assets/icons/spot');

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

                    // Extract metadata from universe array
                    const universe = jsonData[0].universe;
                    const tokens = jsonData[0].tokens;
                    const marketData = jsonData[1];

                    // Get all active tokens with their metadata
                    const tokenNames = {};
                    marketData.forEach(t => {
                        // Find metadata for this token in universe array
                        const meta = universe.find(m => m.name === t.coin);
                        if (!meta) {
                            console.log(`No metadata found for token ${t.coin}`);
                            return;
                        }
                        
                        // Find token info in tokens array
                        const tokenInfo = tokens.find(token => token.index === meta.tokens[0]);
                        if (!tokenInfo) {
                            console.log(`No token info found for ${t.coin}`);
                            return;
                        }

                        console.log(`Processing token: ${t.coin} -> ${tokenInfo.name}`);
                        tokenNames[t.coin] = tokenInfo.name;
                    });

                    // Add PURR/USDC manually since it's special
                    tokenNames['PURR/USDC'] = 'PURR';

                    console.log(`Found ${Object.keys(tokenNames).length} tokens`);
                    console.log('First few tokens:', Object.entries(tokenNames).slice(0, 5));

                    // Save to spot_names.json
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
    // Create icons directory if it doesn't exist
    if (!fs.existsSync(ICONS_DIR)) {
        fs.mkdirSync(ICONS_DIR, { recursive: true });
    }

    // Download default icon first
    await downloadIcon('default');

    // Fetch token names and download their icons
    const tokenNames = await fetchTokenNames();
    
    // Download icons for each token
    for (const [id, name] of Object.entries(tokenNames)) {
        await downloadIcon(name);
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Run the script
console.log('Starting icon downloads...');
downloadAllIcons().catch(console.error); 