const WebSocket = require('ws');

const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

ws.on('open', () => {
    console.log('Connected to Hyperliquid');
    
    const subscription = {
        "method": "subscribe",
        "subscription": {
            "type": "meta"
        }
    };
    
    console.log('Sending subscription:', JSON.stringify(subscription));
    ws.send(JSON.stringify(subscription));
});

ws.on('message', (data) => {
    try {
        const parsed = JSON.parse(data.toString());
        console.log('\n=== Block/Meta Update ===');
        console.log(JSON.stringify(parsed, null, 2));
        console.log('=====================\n');
    } catch (e) {
        console.log('Error parsing message:', e);
        console.log('Raw data:', data.toString());
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