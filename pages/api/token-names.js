import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    try {
        const filePath = path.join(process.cwd(), 'spot_names.json');
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const tokenNames = JSON.parse(fileContents);
        
        res.status(200).json(tokenNames);
    } catch (error) {
        console.error('Error reading token names:', error);
        res.status(500).json({ error: 'Failed to read token names' });
    }
} 