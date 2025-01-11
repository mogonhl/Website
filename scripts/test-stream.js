// Test script for Hypurr fills data stream
class HypurrStreamTest {
    constructor() {
        this.buffer = '';
        this.sequence = 0;
    }

    // Helper function to decode base64
    decodeBase64(str) {
        try {
            return atob(str);
        } catch (e) {
            console.error('Base64 decode error:', e);
            return null;
        }
    }

    // Helper function to convert bytes to hex for debugging
    bytesToHex(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    }

    // Helper function to parse binary data
    parseBinaryMessage(binaryData) {
        try {
            // Convert binary data to array of bytes
            const bytes = new Uint8Array(binaryData.split('').map(c => c.charCodeAt(0)));
            console.log('Raw bytes:', this.bytesToHex(bytes));
            
            // First byte appears to be 0x00
            let offset = 1;
            
            // Next byte is message count
            const messageCount = bytes[offset++];
            console.log('Message count:', messageCount);
            
            // Look for message markers
            const messages = [];
            while (offset < bytes.length - 4) {
                // Look for marker sequence: 0xC0 0x8F 0x36 0x02 0x22 0xC0 0xA2 0xA3
                if (bytes[offset] === 0xC0 && 
                    bytes[offset + 1] === 0x8F && 
                    bytes[offset + 2] === 0x36 && 
                    bytes[offset + 3] === 0x02 && 
                    bytes[offset + 4] === 0x22 && 
                    bytes[offset + 5] === 0xC0 && 
                    bytes[offset + 6] === 0xA2 && 
                    bytes[offset + 7] === 0xA3) {
                    
                    // Extract message data (next 16 bytes after marker)
                    const messageData = bytes.slice(offset + 8, offset + 24);
                    console.log('Message data:', this.bytesToHex(messageData));
                    
                    // Try to parse the message
                    const message = this.parseMessage(messageData);
                    if (message) {
                        messages.push(message);
                    }
                    
                    offset += 24;
                } else {
                    offset++;
                }
            }
            
            console.log('Parsed messages:', messages);
            return messages;
            
        } catch (e) {
            console.error('Binary parse error:', e);
            return null;
        }
    }

    // Helper function to parse a message
    parseMessage(data) {
        try {
            const view = new DataView(data.buffer, data.byteOffset, data.length);
            
            // First byte might be a type indicator
            const type = data[0];
            
            // Next 4 bytes might be a sequence or timestamp
            const sequence = view.getUint32(1, true);
            
            // Next 4 bytes could be a price
            const price = view.getFloat32(5, true);
            
            // Last 4 bytes might be a quantity
            const quantity = view.getFloat32(9, true);
            
            return {
                type,
                sequence,
                price,
                quantity,
                raw: this.bytesToHex(data)
            };
        } catch (e) {
            console.error('Message parse error:', e);
            return null;
        }
    }

    connect() {
        console.log('Starting connection to HyperliquidLaunchFills...');
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://grpc.hypurr.fun/hypurr.Static/HyperliquidLaunchFills', true);
        
        xhr.setRequestHeader('content-type', 'application/grpc-web-text');
        xhr.setRequestHeader('x-grpc-web', '1');
        
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 3 && xhr.response) {
                const newData = xhr.response.slice(this.buffer.length);
                if (newData) {
                    console.log('Received new chunk of data');
                    this.buffer += newData;
                    
                    // Process complete messages
                    while (this.buffer.length >= 2) {
                        // First byte is the length prefix
                        const firstByte = parseInt(this.buffer.substr(0, 2), 16);
                        if (isNaN(firstByte)) break;
                        
                        // Need at least 5 bytes for a complete frame (1 length + 4 frame header)
                        if (this.buffer.length < 10) break;
                        
                        // Extract the message
                        const messageLength = firstByte;
                        const frameEnd = 2 + (messageLength * 2); // *2 because hex encoding
                        if (this.buffer.length < frameEnd) break;
                        
                        const frame = this.buffer.substring(2, frameEnd);
                        this.buffer = this.buffer.slice(frameEnd);
                        
                        // Decode and parse the message
                        const binaryData = this.decodeBase64(frame);
                        if (binaryData) {
                            const messages = this.parseBinaryMessage(binaryData);
                            if (messages && messages.length > 0) {
                                console.log('Messages:', messages);
                            }
                        }
                    }
                }
            }
        };

        // Use the correct payload for fills stream
        const payload = 'AAAAAAUKAwjzYA==';
        console.log('Sending payload:', payload);
        xhr.send(payload);
    }
}

// Start the test
const test = new HypurrStreamTest();
test.connect(); 