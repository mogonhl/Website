const WebSocket = require('ws');

const ws = new WebSocket('wss://api.hyperliquid.xyz/ws', {
    headers: {
        'Origin': 'https://purrg.com'
    }
});

ws.on('open', function open() {
    console.log('Connected to Hyperliquid WebSocket API');
    // Send the subscription message
    const subscribeMsg = {
        method: "subscribe",
        subscription: {
            type: "explorerBlock"
        }
    };
    ws.send(JSON.stringify(subscribeMsg));
});

ws.on('message', function incoming(data) {
    try {
        const blockData = JSON.parse(data);
        // Skip the subscription confirmation message
        if (blockData.channel === "subscriptionResponse") {
            console.log('Successfully subscribed to block updates');
            return;
        }
        // Print the block data in a cleaner format
        blockData.forEach(block => {
            console.log(`Block ${block.height} | Time: ${new Date(block.blockTime).toISOString()} | Hash: ${block.hash} | Txs: ${block.numTxs}`);
        });
    } catch (error) {
        console.error('Error parsing message:', error);
    }
});

ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
});

ws.on('close', function close() {
    console.log('Disconnected from Hyperliquid WebSocket API');
}); 