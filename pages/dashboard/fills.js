// Import required classes and setup
class GRPCHandler {
    // Binary data helpers
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
}

// Include FillsHandler class
class FillsHandler extends GRPCHandler {
    constructor() {
        super();
        this.streams = new Map(); // Store multiple streams
        this.xhr = null;
        this.buffer = '';
        this.seenTrades = new Set();
        this.showHighValueOnly = false;
        this.currentPage = 1;
        this.transactionsPerPage = 15;
        this.allTrades = []; // Store all trades
        
        // Initialize table structure
        this.initializeTable();
        this.initializeToggle();
        
        // Start time updater
        this.startTimeUpdater();
    }

    initializeTable() {
        const container = document.getElementById('fills-container');
        container.innerHTML = `
            <table class="fills-table">
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Account</th>
                        <th>Asset</th>
                        <th>Price</th>
                        <th>Amount</th>
                        <th>Time</th>
                        <th>Total</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
            <div class="flex justify-end items-center gap-2 p-4 border-t border-[#0a2622]">
                <span class="text-[rgb(148,158,156)] text-sm" id="fills-pagination">1-15 of 0</span>
                <div class="flex gap-1">
                    <button onclick="fills.changePage(-1)" class="text-[rgba(72,255,225,0.9)] hover:text-[rgba(72,255,225,1)] px-2 disabled:opacity-50" id="fills-prev" disabled>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                    </button>
                    <button onclick="fills.changePage(1)" class="text-[rgba(72,255,225,0.9)] hover:text-[rgba(72,255,225,1)] px-2 disabled:opacity-50" id="fills-next" disabled>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                </div>
            </div>
            <style>
                .fills-table th:nth-child(2),
                .fills-table td:nth-child(2) {
                    width: 200px;
                }

                .fills-table th:nth-child(3),
                .fills-table td:nth-child(3) {
                    width: 80px;
                }

                .fills-table th:nth-child(4),
                .fills-table td:nth-child(4) {
                    width: 100px;
                }

                .fills-table th:nth-child(5),
                .fills-table td:nth-child(5) {
                    width: 100px;
                }

                .fills-table th:nth-child(6),
                .fills-table td:nth-child(6) {
                    width: 100px;
                }

                .fills-table th:nth-child(7),
                .fills-table td:nth-child(7) {
                    width: 50px;
                }

                .fills-table th:nth-child(8),
                .fills-table td:nth-child(8) {
                    width: 20px;
                }
            </style>
        `;
    }

    initializeToggle() {
        const toggleButton = document.getElementById('high-value-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                this.showHighValueOnly = !this.showHighValueOnly;
                toggleButton.classList.toggle('active');
                this.updateTableVisibility();
            });
        }
    }

    updateTableVisibility() {
        this.currentPage = 1; // Reset to first page
        this.refreshTableDisplay();
    }

    // Add new methods for stream handling
    addStream(name, payload) {
        if (this.streams.has(name)) {
            console.log(`Stream ${name} already exists`);
            return;
        }

        const streamConfig = {
            name,
            payload,
            isStreaming: false,
            endpoint: 'https://grpc.hypurr.fun/hypurr.Static/HyperliquidLaunchFills'
        };

        this.streams.set(name, streamConfig);
        this.connectStream(name);
    }

    connectStream(name) {
        const stream = this.streams.get(name);
        if (!stream || stream.isStreaming) return;

        fetch(stream.endpoint, {
            "headers": {
                "accept": "application/grpc-web-text",
                "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
                "content-type": "application/grpc-web-text",
                "priority": "u=1, i",
                "sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site",
                "x-grpc-web": "1"
            },
            "referrer": "https://app.hypurr.fun/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": stream.payload,
            "method": "POST",
            "mode": "cors",
            "credentials": "omit"
        }).then(async response => {
            const reader = response.body.getReader();
            stream.isStreaming = true;

            while(true) {
                const {value, done} = await reader.read();
                if (done) {
                    stream.isStreaming = false;
                    setTimeout(() => this.connectStream(name), 1000);
                    break;
                }
                
                const text = new TextDecoder().decode(value);
                this.handleResponse(text, name);
            }
        }).catch(error => {
            stream.isStreaming = false;
            setTimeout(() => this.connectStream(name), 1000);
        });
    }

    handleResponse(responseText, streamName) {
        try {
            if (!responseText || responseText.trim() === '' || responseText.length % 4 !== 0) {
                return;
            }
            
            const cleanedText = responseText.replace(/[^A-Za-z0-9+/=]/g, '');
            
            try {
                const decoded = atob(cleanedText);
                const data = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
                
                if (data.length < 5) {
                    return;
                }
                
                const messageLength = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
                const frameType = data[4];
                const message = data.slice(5);
                
                let offset = 0;
                while (offset < message.length) {
                    if (message[offset] === 0x0a) {
                        offset++;
                        const msgLength = message[offset];
                        offset++;
                        
                        const fillMessage = message.slice(offset, offset + msgLength);
                        this.processFrame(fillMessage, streamName);
                        
                        offset += msgLength;
                    } else {
                        offset++;
                    }
                }
            } catch (decodeError) {
                return;
            }
        } catch (error) {
            console.error('Error processing response:', error);
        }
    }

    processFrame(frameData, streamName) {
        try {
            let offset = 0;
            const fill = {
                assetName: streamName // Add asset name to fill data
            };
            const debug = {
                unhandledFields: {}
            };

            while (offset < frameData.length) {
                const tag = frameData[offset++];
                const fieldNumber = tag >> 3;
                const wireType = tag & 0x7;
                
                if (tag === 0x08) {
                    const [value, newOffset] = this.readVarint(frameData, offset);
                    offset = newOffset;
                    debug.marketId = Number(value);
                } else if (tag === 0x22) {
                    const len = frameData[offset++];
                    const accountData = frameData.slice(offset, offset + len);
                    for(let i = 0; i < accountData.length - 1; i++) {
                        if(accountData[i] === 0x30 && accountData[i + 1] === 0x78) {
                            fill.account = new TextDecoder().decode(accountData.slice(i));
                            break;
                        }
                    }
                    offset += len;
                } else if (tag === 0x28) {
                    const [value, newOffset] = this.readVarint(frameData, offset);
                    offset = newOffset;
                    
                    // For Buy orders, value is close to max uint64
                    if (value > 9223372036854775807n) {
                        // Convert from uint64 max minus value
                        const actualValue = Number(18446744073709551615n - value) / 100;
                        fill.total = actualValue;
                    } else {
                        // For Sell orders, use value directly
                        fill.total = Number(value) / 100;
                    }
                } else if (tag === 0x30) {
                    const [value, newOffset] = this.readVarint(frameData, offset);
                    offset = newOffset;
                    debug.rawPurrg = value;
                    
                    let purrgValue;
                    if (value > 9223372036854775807n) {
                        purrgValue = Number(value - 18446744073709551616n) / 100;
                    } else {
                        purrgValue = Number(value) / 100;
                    }
                    fill.type = purrgValue >= 0 ? 'Buy' : 'Sell';
                    fill.purrg = Math.abs(purrgValue);
                    
                    // Calculate price if we have total
                    if (fill.total !== undefined) {
                        fill.price = Math.abs(fill.total / fill.purrg);
                    }
                } else if (tag === 0x38) {
                    const [value, newOffset] = this.readVarint(frameData, offset);
                    offset = newOffset;
                    debug.timestamp = Number(value);
                    fill.timestamp = new Date(Number(value));
                } else if (tag === 0x48) {
                    const [value, newOffset] = this.readVarint(frameData, offset);
                    offset = newOffset;
                    debug.field9 = value; // Just store it for debugging
                } else {
                    let fieldValue;
                    let fieldHex;
                    
                    if (wireType === 0) {
                        const [value, newOffset] = this.readVarint(frameData, offset);
                        fieldValue = Number(value);
                        const bytes = frameData.slice(offset, newOffset);
                        fieldHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
                        offset = newOffset;
                    } else if (wireType === 1 && offset + 8 <= frameData.length) {
                        // Ensure we have enough bytes for a 64-bit value
                        const buffer = frameData.buffer.slice(frameData.byteOffset + offset, frameData.byteOffset + offset + 8);
                        fieldValue = new DataView(buffer).getBigInt64(0, true);
                        fieldHex = Array.from(frameData.slice(offset, offset + 8))
                            .map(b => b.toString(16).padStart(2, '0')).join(' ');
                        offset += 8;
                    } else if (wireType === 2) {
                        const len = frameData[offset++];
                        if (offset + len <= frameData.length) {
                            const bytes = frameData.slice(offset, offset + len);
                            fieldHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
                            try {
                                fieldValue = new TextDecoder().decode(bytes);
                            } catch {
                                fieldValue = `<${len} bytes>`;
                            }
                            offset += len;
                        }
                    } else if (wireType === 5 && offset + 4 <= frameData.length) {
                        // Ensure we have enough bytes for a 32-bit value
                        const buffer = frameData.buffer.slice(frameData.byteOffset + offset, frameData.byteOffset + offset + 4);
                        fieldValue = new DataView(buffer).getFloat32(0, true);
                        fieldHex = Array.from(frameData.slice(offset, offset + 4))
                            .map(b => b.toString(16).padStart(2, '0')).join(' ');
                        offset += 4;
                    }
                }
            }

            if (fill.account && fill.type && fill.purrg) {
                this.onFillsData(fill, streamName);
            }
        } catch (error) {
            console.error('Error in processFrame:', error);
        }
    }

    skipVarint(bytes, offset) {
        let currentOffset = offset;
        while (currentOffset < bytes.length && (bytes[currentOffset] & 0x80) !== 0) {
            currentOffset++;
        }
        return currentOffset + 1;
    }

    getRandomSticker(type) {
        // Limited sticker sets for Buy and Sell
        const buyStickers = [5, 10];
        const sellStickers = [8, 69];
        
        // Choose the appropriate set based on transaction type
        const stickerSet = type.toLowerCase() === 'buy' ? buyStickers : sellStickers;
        const randomIndex = Math.floor(Math.random() * stickerSet.length);
        return stickerSet[randomIndex];
    }

    formatTimeDiff(timestamp) {
        const now = new Date();
        const timeDiff = now - timestamp;
        const seconds = Math.floor(timeDiff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ago`;
        } else if (hours > 0) {
            return `${hours}h ago`;
        } else if (minutes > 0) {
            return `${minutes}m ago`;
        } else {
            return `${seconds}s ago`;
        }
    }

    startTimeUpdater() {
        setInterval(() => {
            const tbody = document.querySelector('#fills-container .fills-table tbody');
            if (!tbody) return;

            Array.from(tbody.children).forEach(row => {
                const timestamp = parseInt(row.dataset.timestamp);
                if (!timestamp) return;

                const timeCell = row.querySelector('.fill-time');
                if (!timeCell) return;

                timeCell.textContent = this.formatTimeDiff(timestamp);
            });
        }, 1000);
    }

    onFillsData(fill, streamName) {
        const tradeKey = `${fill.timestamp.getTime()}-${fill.account}-${fill.purrg}-${fill.type}`;
        
        if (this.seenTrades.has(tradeKey)) {
            return;
        }
        
        this.seenTrades.add(tradeKey);
        
        // Create the row data
        const rowData = {
            timestamp: fill.timestamp.getTime(),
            tradeKey: tradeKey,
            type: fill.type,
            account: fill.account,
            assetName: streamName,
            price: fill.price,
            purrg: fill.purrg,
            total: fill.total,
            html: this.createRowHTML(fill, streamName)
        };

        // Add to allTrades array
        this.allTrades.push(rowData);
        
        // Sort by timestamp (newest first)
        this.allTrades.sort((a, b) => b.timestamp - a.timestamp);
        
        // Keep only the last 200 trades
        if (this.allTrades.length > 200) {
            this.allTrades = this.allTrades.slice(0, 200);
        }

        // Refresh the table display
        this.refreshTableDisplay();
    }

    createRowHTML(fill, streamName) {
        const row = document.createElement('tr');
        row.dataset.timestamp = fill.timestamp.getTime();
        row.dataset.tradeKey = `${fill.timestamp.getTime()}-${fill.account}-${fill.purrg}-${fill.type}`;
        
        // Add all the cells (type, account, asset, etc...)
        const start = fill.account.slice(0, 8);
        const end = fill.account.slice(-6);
        
        row.innerHTML = `
            <td><span class="fill-type ${fill.type.toLowerCase()}">${fill.type}</span></td>
            <td class="fill-account">${start}...${end}</td>
            <td class="fill-asset">${streamName}</td>
            <td class="fill-price">$${fill.price.toFixed(4)}</td>
            <td class="fill-amount">${fill.purrg.toFixed(2)}</td>
            <td class="fill-time">${this.formatTimeDiff(fill.timestamp)}</td>
            <td class="fill-usd ${fill.type.toLowerCase()}">$${fill.total.toFixed(2)}</td>
            <td class="fill-sticker">${fill.total > 500 ? `<img src="/assets/Sticker/${this.getRandomSticker(fill.type)}.png" alt="High value trade" class="trade-sticker">` : ''}</td>
        `;
        
        return row.outerHTML;
    }

    refreshTableDisplay() {
        const tbody = document.querySelector('#fills-container .fills-table tbody');
        if (!tbody) return;

        // Filter trades if high value only is active
        let visibleTrades = this.allTrades;
        if (this.showHighValueOnly) {
            visibleTrades = this.allTrades.filter(trade => trade.total > 500);
        }

        // Calculate pagination
        const totalRows = visibleTrades.length;
        const start = (this.currentPage - 1) * this.transactionsPerPage;
        const end = Math.min(start + this.transactionsPerPage, totalRows);
        
        // Get current page trades
        const currentPageTrades = visibleTrades.slice(start, end);
        
        // Update tbody
        tbody.innerHTML = currentPageTrades.map(trade => trade.html).join('');
        
        // Update pagination display
        this.updatePagination(totalRows);
    }

    changePage(direction) {
        const visibleTrades = this.showHighValueOnly 
            ? this.allTrades.filter(trade => trade.total > 500)
            : this.allTrades;
            
        const totalPages = Math.ceil(visibleTrades.length / this.transactionsPerPage);
        const newPage = this.currentPage + direction;
        
        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.refreshTableDisplay();
        }
    }

    updatePagination(totalRows) {
        const start = (this.currentPage - 1) * this.transactionsPerPage + 1;
        const end = Math.min(this.currentPage * this.transactionsPerPage, totalRows);
        const totalPages = Math.ceil(totalRows / this.transactionsPerPage);
        
        const paginationText = document.getElementById('fills-pagination');
        const prevButton = document.getElementById('fills-prev');
        const nextButton = document.getElementById('fills-next');
        
        if (paginationText) {
            if (totalRows > 0) {
                paginationText.textContent = `${start}-${end} of ${totalRows}`;
            } else {
                paginationText.textContent = '0 entries';
            }
        }
        
        if (prevButton) prevButton.disabled = this.currentPage === 1;
        if (nextButton) nextButton.disabled = this.currentPage >= totalPages;
    }
}

// Initialize with multiple streams
try {
    console.log('Starting fills handler...');
    // Make the handler instance globally accessible
    window.fills = new FillsHandler();
    
    // Add both streams
    window.fills.addStream('VORTX', 'AAAAAAUKAwiwTQ==');
    window.fills.addStream('TILT', 'AAAAAAUKAwjGTg==');
    window.fills.addStream('GUARD', 'AAAAAAUKAwjXWg==');
    window.fills.addStream('FUND', 'AAAAAAUKAwjKIw==');
    window.fills.addStream('HORSY', 'AAAAAAUKAwjSKA==');
    window.fills.addStream('QUANT', 'AAAAAAUKAwj+EQ==');
    window.fills.addStream('DQNTA', 'AAAAAAUKAwjkZg==');
    window.fills.addStream('AIDIVN', 'AAAAAAUKAwj/Yw==');
    window.fills.addStream('BLOCK', 'AAAAAAUKAwj3OA==');
    window.fills.addStream('LUNA', 'AAAAAAUKAwjkGw==');
    window.fills.addStream('DEFIN', 'AAAAAAUKAwjmaA==');
    window.fills.addStream('PURRG', 'AAAAAAUKAwiJOw==');
    
    console.log('Connections initiated. Waiting for data...');
} catch (error) {
    console.error('Error running fills handler:', error);
} 