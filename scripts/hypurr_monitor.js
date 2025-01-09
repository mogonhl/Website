const puppeteer = require('puppeteer');

class HypurrMonitor {
    constructor() {
        this.browser = null;
        this.page = null;
        this.wsMessages = [];
        this.networkRequests = new Map();
    }

    async initialize(tokenId) {
        console.log('Launching browser...');
        
        // Launch browser with specific arguments
        this.browser = await puppeteer.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1280,800'
            ]
        });

        console.log('Creating new page...');
        this.page = await this.browser.newPage();
        
        // Set a reasonable timeout
        this.page.setDefaultNavigationTimeout(30000);
        this.page.setDefaultTimeout(30000);

        // Enable all necessary features
        await Promise.all([
            this.page.setRequestInterception(true),
            this.page.setJavaScriptEnabled(true)
        ]);

        console.log('Setting up network monitoring...');
        
        // Monitor network requests
        this.page.on('request', request => {
            try {
                this.networkRequests.set(request.url(), {
                    method: request.method(),
                    headers: request.headers(),
                    postData: request.postData()
                });
                request.continue();
            } catch (e) {
                console.error('Error handling request:', e);
                request.continue();
            }
        });

        // Monitor network responses
        this.page.on('response', async response => {
            try {
                const url = response.url();
                const contentType = response.headers()['content-type'] || '';
                
                if (contentType.includes('application/json')) {
                    const data = await response.json();
                    console.log(`API Response from ${url}:`, data);
                }
            } catch (e) {
                // Ignore response parsing errors
            }
        });

        // Monitor console messages
        this.page.on('console', msg => {
            console.log('Browser console:', msg.text());
        });

        console.log(`Navigating to https://app.hypurr.fun/launch/${tokenId}`);
        
        // Navigate and wait for network to be idle
        await this.page.goto(`https://app.hypurr.fun/launch/${tokenId}`, {
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 30000
        });

        console.log('Page loaded, setting up data monitoring...');

        // Inject our monitoring code
        await this.page.evaluate(() => {
            // Intercept WebSocket creation
            const wsProto = window.WebSocket.prototype;
            const originalSend = wsProto.send;
            wsProto.send = function(data) {
                console.log('WS Sending:', data);
                return originalSend.apply(this, arguments);
            };
            
            // Monitor DOM updates for price changes
            const observer = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    if (mutation.type === 'characterData' || mutation.type === 'childList') {
                        const text = mutation.target.textContent;
                        if (text?.match(/\$?\d+(\.\d+)?/)) {
                            console.log('Price Update:', text);
                        }
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        });

        console.log('Setup complete, monitoring data...');
    }

    async getPrice() {
        try {
            return await this.page.evaluate(() => {
                const priceElements = Array.from(document.querySelectorAll('*'));
                const priceEl = priceElements.find(el => 
                    el.textContent?.match(/\$?\d+(\.\d+)?/)
                );
                return priceEl ? {
                    text: priceEl.textContent,
                    path: getElementPath(priceEl)
                } : null;

                function getElementPath(el) {
                    const path = [];
                    while (el && el.nodeType === Node.ELEMENT_NODE) {
                        let selector = el.nodeName.toLowerCase();
                        if (el.id) {
                            selector += '#' + el.id;
                        } else {
                            let sib = el, nth = 1;
                            while (sib.previousElementSibling) {
                                sib = sib.previousElementSibling;
                                nth++;
                            }
                            selector += `:nth-child(${nth})`;
                        }
                        path.unshift(selector);
                        el = el.parentNode;
                    }
                    return path.join(' > ');
                }
            });
        } catch (e) {
            console.error('Error getting price:', e);
            return null;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Usage
async function main() {
    const monitor = new HypurrMonitor();
    
    try {
        console.log('Starting monitor...');
        await monitor.initialize('9894');
        
        // Monitor for 60 seconds
        console.log('Monitoring for 60 seconds...');
        
        const interval = setInterval(async () => {
            const price = await monitor.getPrice();
            if (price) {
                console.log('Current price:', price);
            }
        }, 5000);

        // Clean up after 60 seconds
        setTimeout(async () => {
            clearInterval(interval);
            console.log('Monitoring complete, closing...');
            await monitor.close();
        }, 60000);
        
    } catch (error) {
        console.error('Fatal error:', error);
        await monitor.close();
    }
}

if (require.main === module) {
    main().catch(console.error);
} 