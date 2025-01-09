class PriceStream {
    constructor(tokenId) {
        this.tokenId = tokenId;
        this.ws = null;
        this.onPriceUpdate = null;
        this.onTradeUpdate = null;
    }

    connect() {
        // Try connecting to their WebSocket endpoint
        this.ws = new WebSocket(`wss://app.hypurr.fun/ws`);

        this.ws.onopen = () => {
            console.log('Connected to price stream');
            // Subscribe to the token's updates
            this.ws.send(JSON.stringify({
                action: 'subscribe',
                token: this.tokenId
            }));
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Received data:', data);
                
                // Handle different types of updates
                if (data.type === 'price' && this.onPriceUpdate) {
                    this.onPriceUpdate(data);
                } else if (data.type === 'trade' && this.onTradeUpdate) {
                    this.onTradeUpdate(data);
                }
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('Connection closed, attempting to reconnect...');
            setTimeout(() => this.connect(), 5000);
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Example usage:
/*
const stream = new PriceStream('9894');

stream.onPriceUpdate = (data) => {
    console.log('New price:', data.price);
    // Update your UI here
};

stream.onTradeUpdate = (data) => {
    console.log('New trade:', data);
    // Update your trades list here
};

stream.connect();
*/ 