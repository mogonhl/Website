const WebSocket = require('ws');

const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);
    return `${diff} sec ago`;
}

function shortenHash(hash) {
    if (hash === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        return "0x0000...0000";
    }
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function shortenAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Keep track of seen hashes to avoid duplicates
const seenHashes = new Set();
const MAX_SEEN_HASHES = 1000; // Prevent memory growth

ws.on('open', () => {
    console.log('Connected to Hyperliquid');
    
    // Subscribe to all major coins
    const coins = ["BTC", "ETH", "SOL", "DOGE", "XRP"];
    
    for (const coin of coins) {
        const subscription = {
            "method": "subscribe",
            "subscription": {
                "type": "trades",
                "coin": coin
            }
        };
        console.log(`Subscribing to ${coin} trades...`);
        ws.send(JSON.stringify(subscription));
    }
});

ws.on('message', (data) => {
    try {
        const parsed = JSON.parse(data.toString());
        
        if (parsed.channel === 'trades' && Array.isArray(parsed.data)) {
            console.log('\n=== Latest Transactions ===');
            console.log('Hash                Action         Block       Time         User');
            console.log('--------------------------------------------------------------------');
            
            parsed.data.forEach(trade => {
                // Skip if we've seen this hash before (unless it's a zero hash)
                if (trade.hash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && 
                    seenHashes.has(trade.hash)) {
                    return;
                }

                const hash = shortenHash(trade.hash);
                const action = `${trade.side === 'B' ? 'Buy' : 'Sell'} ${trade.coin}`;
                const time = formatTimeAgo(trade.time);
                // Show first user as the initiator
                const user = shortenAddress(trade.users[0]);
                
                console.log(`${hash.padEnd(18)} ${action.padEnd(14)} ${' '.padEnd(10)} ${time.padEnd(12)} ${user}`);
                
                // Add hash to seen set
                if (trade.hash !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
                    seenHashes.add(trade.hash);
                    // Prevent set from growing too large
                    if (seenHashes.size > MAX_SEEN_HASHES) {
                        const firstHash = seenHashes.values().next().value;
                        seenHashes.delete(firstHash);
                    }
                }
            });
            console.log('--------------------------------------------------------------------\n');
        }
    } catch (e) {
        console.log('Error parsing message:', e);
    }
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

ws.on('close', () => {
    console.log('Connection closed');
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nClosing connection...');
    ws.close();
    process.exit();
}); 