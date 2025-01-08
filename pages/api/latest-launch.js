import { Redis } from '@upstash/redis';
import fetch from 'node-fetch';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
    try {
        // Get stored launch data
        const launchData = await redis.get('latest_launch');
        if (!launchData) {
            return res.status(404).json({ error: 'No launch data found' });
        }

        const launch = JSON.parse(launchData);

        // Get current price and volume
        const now = Date.now();
        const response = await fetch('https://api-ui.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: "candleSnapshot",
                req: {
                    coin: launch.tradingSymbol,
                    interval: "1h",
                    startTime: now - (24 * 60 * 60 * 1000), // Last 24h
                    endTime: now
                }
            })
        });

        if (!response.ok) {
            return res.status(500).json({ error: 'Failed to fetch current data' });
        }

        const candles = await response.json();
        if (!candles || !candles.length) {
            return res.status(500).json({ error: 'No current data available' });
        }

        const lastCandle = candles[candles.length - 1];
        const currentPrice = parseFloat(lastCandle.c);
        const volume24h = parseFloat(lastCandle.v);
        const priceChange = ((currentPrice - launch.launchPrice) / launch.launchPrice * 100).toFixed(2);

        res.status(200).json({
            ...launch,
            currentPrice,
            volume24h,
            priceChange: parseFloat(priceChange),
            timeSinceLaunch: now - launch.launchTime
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
} 