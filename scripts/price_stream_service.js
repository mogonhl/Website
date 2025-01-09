const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
const Redis = require('ioredis');
const redis = new Redis(); // Connects to localhost:6379 by default

// Redis key for the time series
const REDIS_KEY = 'hai_price_timeseries';

class PriceStream {
    constructor() {
        this.xhr = null;
        this.lastTimestamp = 0;
    }

    connect() {
        if (this.xhr) {
            console.log('Connection already exists');
            return;
        }

        console.log('Starting connection to candle stream...');
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://grpc.hypurr.fun/hypurr.Static/HyperliquidLaunchCandleStream', true);
        
        xhr.setRequestHeader('content-type', 'application/grpc-web-text');
        xhr.setRequestHeader('x-grpc-web', '1');
        
        let buffer = '';
        
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 3 || xhr.readyState === 4) {
                if (xhr.response) {
                    try {
                        const newData = xhr.response.slice(buffer.length);
                        if (newData) {
                            buffer += newData;
                            
                            while (buffer.length >= 2) {
                                const firstByte = parseInt(buffer.substr(0, 2), 16);
                                if (isNaN(firstByte)) break;
                                
                                if (buffer.length < 12) break;
                                
                                this.processResponse(buffer);
                                
                                const processedLength = Math.floor(buffer.length / 2) * 2;
                                buffer = buffer.slice(processedLength);
                            }
                        }
                    } catch (e) {
                        if (!(e.message.includes('atob'))) {
                            console.error('Error processing response:', e.message);
                        }
                    }
                }
            }
            
            if (xhr.readyState === 4) {
                console.log('Stream closed, reconnecting...');
                this.xhr = null;
                setTimeout(() => this.connect(), 1000);
            }
        };

        xhr.onerror = (error) => {
            console.error('Stream error:', error);
            this.xhr = null;
            setTimeout(() => this.connect(), 1000);
        };

        xhr.onabort = () => {
            console.log('Stream aborted');
            this.xhr = null;
        };

        const payload = 'AAAAAAcIiTsSAjVt';
        xhr.send(payload);
        this.xhr = xhr;
    }

    processResponse(response) {
        if (!response) return;

        try {
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(response)) {
                return;
            }

            const binary = Buffer.from(response, 'base64').toString('binary');
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            let offset = 0;
            while (offset < bytes.length) {
                const frameTag = bytes[offset];
                if (frameTag === 0x0a) {
                    offset++;
                    const frameLength = bytes[offset];
                    offset++;
                    if (frameLength > 0 && offset + frameLength <= bytes.length) {
                        const frameData = bytes.slice(offset, offset + frameLength);
                        this.processFrame(frameData);
                        offset += frameLength;
                    } else {
                        break;
                    }
                } else {
                    offset++;
                }
            }
        } catch (e) {
            if (!(e.message.includes('base64'))) {
                console.error('Error processing response:', e.message);
            }
        }
    }

    async processFrame(frameData) {
        try {
            let offset = 0;
            
            const tagByte = frameData[offset++];
            if ((tagByte >> 3) !== 1) {
                console.error('Invalid tag byte for timestamp:', tagByte.toString(16));
                return;
            }
            
            let [timestampBig, newOffset] = this.readVarint(frameData, offset);
            offset = newOffset;
            
            const timestamp = Number(timestampBig);
            const date = new Date(timestamp * 1000);
            
            if (timestamp <= this.lastTimestamp) {
                return;
            }
            this.lastTimestamp = timestamp;
            
            const prices = {};
            while (offset < frameData.length) {
                const fieldTag = frameData[offset++];
                const fieldNum = fieldTag >> 3;
                
                if (fieldNum >= 2 && fieldNum <= 6) {
                    const value = this.readFloat(frameData, offset);
                    offset += 4;
                    prices[fieldNum] = value;
                } else {
                    break;
                }
            }
            
            const { 2: open, 3: close, 4: low, 5: high, 6: volume } = prices;
            
            if (typeof close === 'number' && !isNaN(close)) {
                const dataPoint = {
                    timestamp: date.getTime(),
                    price: close,
                    volume: volume || 'N/A'
                };

                // Push to Redis
                try {
                    await redis.rpush(REDIS_KEY, JSON.stringify(dataPoint));
                    console.log(`Price update saved - Time: ${date.toISOString()}, Close: $${close.toFixed(2)}, Volume: ${volume?.toFixed(2) || 'N/A'}`);
                } catch (error) {
                    console.error('Error saving to Redis:', error);
                }
            }
            
        } catch (e) {
            console.error('Error parsing frame:', e.message, '\n', e.stack);
        }
    }

    readVarint(bytes, offset) {
        let value = 0n;
        let shift = 0n;
        let currentOffset = offset;
        
        while (currentOffset < bytes.length) {
            const byte = bytes[currentOffset++];
            value |= BigInt(byte & 0x7F) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7n;
        }
        
        return [value, currentOffset];
    }

    readFloat(bytes, offset) {
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        for (let i = 0; i < 4; i++) {
            view.setUint8(i, bytes[offset + i]);
        }
        return view.getFloat32(0, true);
    }

    disconnect() {
        if (this.xhr) {
            this.xhr.abort();
            this.xhr = null;
            console.log('Disconnected from stream');
        }
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down...');
    if (priceStream) {
        priceStream.disconnect();
    }
    redis.quit();
    process.exit(0);
});

// Initialize and connect to the price stream
const priceStream = new PriceStream();
priceStream.connect(); 