import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    try {
        // Read the market cap data file
        const dataPath = path.join(process.cwd(), 'market_cap_data.json');
        const marketCapData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        // Create a mapping of @number to actual token names
        const tokenNames = {};
        marketCapData.forEach(token => {
            tokenNames[token.coin] = token.name;
        });

        res.status(200).json(tokenNames);
    } catch (error) {
        console.error('Error reading token names:', error);
        res.status(500).json({ error: 'Failed to load token names' });
    }
} 