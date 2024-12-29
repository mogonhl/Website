document.addEventListener('DOMContentLoaded', () => {
    const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
    const timeRanges = ['24H', '7D', '30D', 'All-time'];
    let currentTimeRange = '7D';
    let currentDataset = 'dataset1';
    
    // Configure target data points for each time range
    const targetDataPoints = {
        '24H': 24,
        '7D': 42,
        '30D': 60,
        'All-time': 90
    };

    // Initialize data cache
    const dataCache = {
        dataset1: {},
        dataset3: {}
    };

    // Define dataset labels
    const datasetLabels = [
        ['Price', 'dataset1'],
        ['Airdrop', 'dataset3']
    ];

    // Create chart section with proper sizing
    const chartSection = document.createElement('div');
    chartSection.className = 'chart-section';
    chartSection.style.cssText = `
        margin-top: 16px;
        height: 280px;
        position: relative;
        width: 100%;
        margin-bottom: 0;
        padding-bottom: 0;
    `;

    // Create dropdown container with absolute positioning
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'flex items-center';
    dropdownContainer.style.cssText = `
        position: absolute;
        top: 0;
        right: 15px;
        z-index: 1;
    `;

    // Create dropdown with minimal styling
    const dropdown = document.createElement('select');
    dropdown.style.cssText = `
        background-color: #041815;
        color: rgb(148, 158, 156);
        font-size: 12px;
        padding: 4px 8px;
        border: 1px solid rgb(55, 65, 81);
        border-radius: 4px;
        outline: none;
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(148, 158, 156)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 12px;
        padding-right: 24px;
        min-width: 80px;
    `;

    // Add timeframe options to dropdown
    timeRanges.forEach(range => {
        const option = document.createElement('option');
        option.value = range;
        option.text = range;
        option.selected = range === currentTimeRange;
        dropdown.appendChild(option);
    });

    // Add dropdown to its container
    dropdownContainer.appendChild(dropdown);

    // Add dropdown container directly to chart section
    chartSection.appendChild(dropdownContainer);

    // Create controls container with proper styling
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'flex justify-between items-center';
    controlsContainer.style.cssText = 'margin-bottom: 15px;';

    // Create dataset buttons container (left side)
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'flex gap-4';
    buttonsContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 15px;
        z-index: 1;
        margin-bottom: 15px;
    `;

    // Create chart container with proper centering
    const chartContainer = document.createElement('div');
    chartContainer.id = 'mobile-price-chart';
    chartContainer.style.cssText = `
        width: 100%;
        height: 220px;
        margin-top: 40px;
        margin-right: 15px;
        margin-left: -15px;
        margin-bottom: 0;
        padding-bottom: 0;
        position: relative;
        flex-shrink: 0;
    `;

    // Create and append dataset buttons with minimal text styling
    datasetLabels.forEach(([label, datasetId]) => {
        const button = document.createElement('button');
        button.style.cssText = `
            color: ${currentDataset === datasetId ? '#FFFFFF' : 'rgb(148, 158, 156)'};
            font-size: 12px;
            font-family: system-ui, -apple-system, sans-serif;
            background: none;
            border: none;
            padding: 4px 0;
            cursor: pointer;
            transition: color 0.2s ease;
            margin-right: 12px;
        `;
        button.textContent = label;
        button.onclick = async () => {
            currentDataset = datasetId;
            updateButtonStyles();
            await updateChart();
        };
        buttonsContainer.appendChild(button);
    });

    // Add elements to their containers
    dropdownContainer.appendChild(dropdown);
    controlsContainer.appendChild(buttonsContainer);
    controlsContainer.appendChild(dropdownContainer);

    // Add containers to chart section
    chartSection.appendChild(controlsContainer);
    chartSection.appendChild(chartContainer);

    // Find the info section and insert chart after it
    const infoSection = document.querySelector('.info-text#desc2');
    if (infoSection && infoSection.parentNode) {
        infoSection.parentNode.insertBefore(chartSection, infoSection.nextSibling);
    }

    // Format numbers for axis and tooltips
    const formatAxisNumber = (num) => {
        if (num === 0) return '0';
        if (num > 0 && num < 0.01) return num.toFixed(3);
        if (num > 0 && num < 1) return num.toFixed(2);
        
        num = Math.round(num);
        if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toString();
    };

    async function fetchData(timeRange) {
        try {
            const token = window.currentToken || 'HYPE';
            const cacheKey = `${timeRange}_${token}_${currentDataset}`;
            
            // Check localStorage cache first
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                if (Date.now() - parsed.timestamp < CACHE_EXPIRY) {
                    console.log('Using cached data for:', cacheKey);
                    return parsed.data;
                }
            }

            // Fetch data with proper error handling
            const response = await fetch(`/api/price-data?timeRange=${timeRange}&token=${token}&dataset=${currentDataset}`, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Received non-JSON response from server');
            }
            
            const data = await response.json();
            if (!data || !data.prices || !Array.isArray(data.prices)) {
                throw new Error('Invalid data format received');
            }
            
            let processedData;
            if (currentDataset === 'dataset3') {
                const airdropAmount = window.TOKENS[token].airdropAmount;
                processedData = data.prices.map(([timestamp, price]) => ({
                    time: timestamp / 1000,
                    value: parseFloat(price) * airdropAmount
                }));
            } else {
                processedData = data.prices.map(([timestamp, price]) => ({
                    time: timestamp / 1000,
                    value: parseFloat(price)
                }));
            }

            // Apply data point reduction
            const targetPoints = targetDataPoints[timeRange];
            if (processedData.length > targetPoints) {
                const step = Math.floor(processedData.length / targetPoints);
                processedData = processedData.filter((_, index) => index % step === 0);
            }

            // Cache in both memory and localStorage
            const cacheObject = {
                data: processedData,
                timestamp: Date.now()
            };
            
            dataCache[currentDataset][cacheKey] = cacheObject;
            localStorage.setItem(cacheKey, JSON.stringify(cacheObject));
            
            console.log('Fetched and cached new data for:', cacheKey);
            return processedData;
        } catch (error) {
            console.error('Error fetching data:', error);
            // Try to use memory cache as fallback even if expired
            const memoryCached = dataCache[currentDataset][cacheKey];
            if (memoryCached) {
                console.log('Using expired memory cache as fallback');
                return memoryCached.data;
            }
            return [];
        }
    }

    async function updateChart() {
        try {
            const data = await fetchData(currentTimeRange);
            if (!data || data.length === 0) return;

            const { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } = window.Recharts;
            const root = ReactDOM.createRoot(chartContainer);
            
            const chart = React.createElement(ResponsiveContainer, 
                { width: '100%', height: '100%' },
                React.createElement(AreaChart, 
                    { 
                        data: data,
                        margin: { top: 10, right: currentDataset === 'dataset3' ? 0 : 0, left: currentDataset === 'dataset3' ? 15 : -20, bottom: 0 }
                    },
                    React.createElement(XAxis, {
                        dataKey: 'time',
                        stroke: '#3E3E3E',
                        tick: false,
                        tickLine: false,
                        axisLine: true
                    }),
                    React.createElement(YAxis, {
                        stroke: '#3E3E3E',
                        fontSize: 12,
                        tickLine: true,
                        tickSize: 10,
                        tick: { fill: '#FFFFFF' },
                        axisLine: true,
                        tickFormatter: formatAxisNumber
                    }),
                    React.createElement(Tooltip, {
                        content: ({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const date = new Date(label * 1000);
                                const value = payload[0].value;
                                const formattedDate = `${date.getFullYear()} ${date.toLocaleString('en-US', { 
                                    month: 'short'
                                })} ${date.getDate()}: $${formatAxisNumber(value)}`;
                                return React.createElement('div', {
                                    style: {
                                        backgroundColor: '#041815',
                                        padding: '8px 12px',
                                        fontSize: '12px',
                                        whiteSpace: 'nowrap',
                                        border: 'none'
                                    }
                                }, formattedDate);
                            }
                            return null;
                        }
                    }),
                    React.createElement(Area, {
                        type: 'stepAfter',
                        dataKey: 'value',
                        stroke: '#FFFFFF',
                        strokeWidth: 2,
                        fill: 'none',
                        dot: false,
                        activeDot: false
                    })
                )
            );

            root.render(chart);
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }

    // Handle dropdown changes
    dropdown.addEventListener('change', (e) => {
        currentTimeRange = e.target.value;
        updateChart();
    });

    // Handle token selection
    document.addEventListener('click', async function(e) {
        if (e.target && e.target.classList.contains('airdrop-icon')) {
            const token = e.target.getAttribute('alt');
            if (token) {
                window.currentToken = token;
                
                // Get token data from TOKENS
                const tokenData = window.TOKENS[token];
                
                // Update descriptions
                document.getElementById('desc1').textContent = tokenData.desc1;
                document.getElementById('desc2').textContent = tokenData.desc2;
                
                // Update airdrop amount under "Average Airdrop in $"
                const airdropAmountElement = document.querySelector('.hover\\:underline.cursor-help');
                if (airdropAmountElement) {
                    airdropAmountElement.textContent = `${tokenData.airdropAmount.toLocaleString()} ${token}`;
                }
                
                // Clear cache and update chart
                Object.keys(dataCache).forEach(dataset => {
                    dataCache[dataset] = {};
                });
                
                updateButtonStyles();
                updateChart();
                
                // Update neighboring tokens with current prices
                await updateNeighboringTokens(token);
                
                // Dispatch token change event for other components
                const event = new CustomEvent('tokenChange', { 
                    detail: { token, timeRange: currentTimeRange } 
                });
                window.dispatchEvent(event);
            }
        }
    });

    // Initial render with default token
    const initialToken = window.currentToken || 'HYPE';
    updateChart();

    // Create neighboring tokens section
    const neighboringTokensSection = document.createElement('div');
    neighboringTokensSection.className = 'app-section';
    neighboringTokensSection.style.cssText = 'margin-top: 0; margin-bottom: 0;';

    // Create container for both boxes
    const boxesContainer = document.createElement('div');
    boxesContainer.style.cssText = `
        display: flex;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
    `;

    // Create green (previous) container
    const prevTokenContainer = document.createElement('div');
    prevTokenContainer.style.cssText = `
        flex: 1;
        padding: 12px;
        border: 1px solid #34d399;
        border-radius: 8px;
        display: flex;
        align-items: center;
        min-height: 60px;
        background-color: rgba(52, 211, 153, 0.1);
    `;

    // Create red (next) container
    const nextTokenContainer = document.createElement('div');
    nextTokenContainer.style.cssText = `
        flex: 1;
        padding: 12px;
        border: 1px solid #ef4444;
        border-radius: 8px;
        display: flex;
        align-items: center;
        min-height: 60px;
        background-color: rgba(239, 68, 68, 0.1);
    `;

    // Function to get sorted tokens by airdrop value
    async function getSortedTokens() {
        // Get current prices
        const prices = await fetchAllPrices();
        
        return Object.entries(window.TOKENS)
            .map(([symbol, data]) => ({
                symbol,
                value: data.airdropAmount * prices[symbol]
            }))
            .sort((a, b) => b.value - a.value); // Sort by value, highest first
    }

    // Function to update neighboring tokens
    async function updateNeighboringTokens(currentToken) {
        try {
            // Get sorted tokens with current prices
            const sortedTokens = await getSortedTokens();
            
            // Find current token index in sorted array
            const currentIndex = sortedTokens.findIndex(t => t.symbol === currentToken);
            
            // Clear existing content
            prevTokenContainer.innerHTML = '';
            nextTokenContainer.innerHTML = '';
            
            if (currentIndex !== -1) {
                const currentTokenValue = sortedTokens[currentIndex].value;
                const isLastToken = currentIndex === sortedTokens.length - 1;

                // Previous token (higher in ranking)
                if (currentIndex > 0) {
                    const prevTokenData = sortedTokens[currentIndex - 1];
                    const difference = prevTokenData.value - currentTokenValue;
                    const percentChange = ((prevTokenData.value - currentTokenValue) / currentTokenValue) * 100;

                    // Create container for icon
                    const iconContainer = document.createElement('div');
                    iconContainer.style.cssText = 'margin-right: 12px;';

                    const prevToken = document.querySelector(`.airdrop-icon[alt="${prevTokenData.symbol}"]`);
                    const prevTokenImg = prevToken.cloneNode(true);
                    prevTokenImg.style.cursor = 'pointer';
                    iconContainer.appendChild(prevTokenImg);

                    // Create container for text
                    const textContainer = document.createElement('div');
                    textContainer.style.cssText = 'display: flex; flex-direction: column;';

                    // Add dollar difference
                    const dollarDiff = document.createElement('div');
                    dollarDiff.style.cssText = 'font-size: 16px; color: #34d399; font-weight: 500;';
                    dollarDiff.textContent = `+$${Math.abs(difference).toLocaleString('en-US', {maximumFractionDigits: 0})}`;

                    // Add percentage
                    const percentDiff = document.createElement('div');
                    percentDiff.style.cssText = 'font-size: 12px; color: #34d399;';
                    percentDiff.textContent = `+${Math.abs(percentChange).toFixed(1)}%`;

                    textContainer.appendChild(dollarDiff);
                    textContainer.appendChild(percentDiff);

                    prevTokenContainer.appendChild(iconContainer);
                    prevTokenContainer.appendChild(textContainer);
                    
                    // Make container clickable
                    prevTokenContainer.style.cursor = 'pointer';
                    prevTokenContainer.onclick = () => {
                        const tokenIcon = document.querySelector(`.airdrop-icon[alt="${prevTokenData.symbol}"]`);
                        if (tokenIcon) tokenIcon.click();
                    };
                }
                
                // Next token (lower in ranking) or skull for FRIEND
                if (currentIndex < sortedTokens.length - 1 || isLastToken) {
                    // Special case for HYPE: show crown in green container
                    if (currentToken === 'HYPE') {
                        const specialImg = document.createElement('img');
                        specialImg.src = '/assets/Sticker/2.png';
                        specialImg.style.cssText = 'width: 80px; height: 80px; object-fit: contain; margin: -10px auto; position: relative;';
                        prevTokenContainer.style.cssText += 'justify-content: center; overflow: visible;';
                        prevTokenContainer.innerHTML = '';
                        prevTokenContainer.appendChild(specialImg);
                        prevTokenContainer.style.cursor = 'default';
                    }

                    // Create container for icon
                    const iconContainer = document.createElement('div');
                    iconContainer.style.cssText = 'margin-right: 12px;';

                    if (isLastToken) {
                        // Show skull in red container when viewing FRIEND
                        const specialImg = document.createElement('img');
                        specialImg.src = '/assets/skull.webp';
                        specialImg.style.cssText = 'width: 40px; height: 40px; object-fit: contain; margin: auto;';
                        nextTokenContainer.style.cssText += 'justify-content: center;';
                        nextTokenContainer.innerHTML = '';
                        nextTokenContainer.appendChild(specialImg);
                        nextTokenContainer.style.cursor = 'default';
                    } else {
                        const nextTokenData = sortedTokens[currentIndex + 1];
                        const difference = nextTokenData.value - currentTokenValue;
                        const percentChange = ((nextTokenData.value - currentTokenValue) / currentTokenValue) * 100;

                        // For all other tokens, show the next token
                        const nextToken = document.querySelector(`.airdrop-icon[alt="${nextTokenData.symbol}"]`);
                        const nextTokenImg = nextToken.cloneNode(true);
                        nextTokenImg.style.cursor = 'pointer';
                        iconContainer.appendChild(nextTokenImg);

                        // Create container for text
                        const textContainer = document.createElement('div');
                        textContainer.style.cssText = 'display: flex; flex-direction: column;';

                        // Add dollar difference
                        const dollarDiff = document.createElement('div');
                        dollarDiff.style.cssText = 'font-size: 16px; color: #ef4444; font-weight: 500;';
                        dollarDiff.textContent = `-$${Math.abs(difference).toLocaleString('en-US', {maximumFractionDigits: 0})}`;

                        // Add percentage
                        const percentDiff = document.createElement('div');
                        percentDiff.style.cssText = 'font-size: 12px; color: #ef4444;';
                        percentDiff.textContent = `-${Math.abs(percentChange).toFixed(1)}%`;

                        textContainer.appendChild(dollarDiff);
                        textContainer.appendChild(percentDiff);

                        nextTokenContainer.appendChild(iconContainer);
                        nextTokenContainer.appendChild(textContainer);
                        
                        // Make container clickable
                        nextTokenContainer.style.cursor = 'pointer';
                        nextTokenContainer.onclick = () => {
                            const tokenIcon = document.querySelector(`.airdrop-icon[alt="${nextTokenData.symbol}"]`);
                            if (tokenIcon) tokenIcon.click();
                        };
                    }
                }
            }
        } catch (error) {
            console.error('Error updating neighboring tokens:', error);
        }
    }

    // Add containers to the section
    boxesContainer.appendChild(prevTokenContainer);
    boxesContainer.appendChild(nextTokenContainer);
    neighboringTokensSection.appendChild(boxesContainer);

    // Find the last app section and insert after it
    const appSections = document.querySelectorAll('.app-section');
    const lastSection = appSections[appSections.length - 1];
    if (lastSection) {
        lastSection.parentNode.insertBefore(neighboringTokensSection, lastSection.nextSibling);
    }

    // Create bottom sticker section as a separate container
    const stickerSection = document.createElement('div');
    stickerSection.style.cssText = `
        position: relative;
        height: 100px;
        width: 100%;
        margin-top: 20px;
        margin-bottom: 20px;
        display: flex;
        justify-content: space-around;
        align-items: center;
        overflow: visible;
    `;

    // Array of available stickers
    const availableStickers = [1, 2, 3, 4, 5, 6, 7, 9, 10, 13, 14, 15, 16, 17, 22, 32, 42, 69, 70];
    
    // Randomly select 4 unique stickers
    const selectedStickers = [];
    while (selectedStickers.length < 4) {
        const randomIndex = Math.floor(Math.random() * availableStickers.length);
        const sticker = availableStickers[randomIndex];
        if (!selectedStickers.includes(sticker)) {
            selectedStickers.push(sticker);
        }
    }

    // Create keyframes for gentle floating animation
    const floatKeyframes = `
        @keyframes gentleFloat {
            0% { transform: translateY(0) rotate(var(--rotation)); }
            50% { transform: translateY(-10px) rotate(var(--rotation)); }
            100% { transform: translateY(0) rotate(var(--rotation)); }
        }
    `;

    // Add keyframes to document
    const style = document.createElement('style');
    style.textContent = floatKeyframes;
    document.head.appendChild(style);

    // Add stickers with animations
    selectedStickers.forEach((stickerNum, index) => {
        const sticker = document.createElement('img');
        sticker.src = `/assets/Sticker/${stickerNum}.png`;
        const randomSize = Math.floor(Math.random() * (70 - 50 + 1)) + 50; // Between 50px and 70px
        const randomRotation = Math.floor(Math.random() * (30 - (-30) + 1)) + (-30); // Between -30 and 30 degrees
        const animationDuration = 3 + Math.random() * 2; // Random duration between 3-5s
        const animationDelay = Math.random() * -5; // Random start time for out-of-sync floating

        sticker.style.cssText = `
            width: ${randomSize}px;
            height: ${randomSize}px;
            object-fit: contain;
            opacity: 1;
            --rotation: ${randomRotation}deg;
            animation: gentleFloat ${animationDuration}s ease-in-out infinite;
            animation-delay: ${animationDelay}s;
            transform-origin: center center;
        `;
        stickerSection.appendChild(sticker);
    });

    // Add sticker section after the neighboring tokens section
    if (neighboringTokensSection.parentNode) {
        neighboringTokensSection.parentNode.insertBefore(stickerSection, neighboringTokensSection.nextSibling);
    }

    // Update the token selection handler to also update neighboring tokens
    const originalClickHandler = document.onclick;
    document.onclick = function(e) {
        if (e.target && e.target.classList.contains('airdrop-icon')) {
            const token = e.target.getAttribute('alt');
            if (token) {
                // Call the original handler first
                originalClickHandler.call(this, e);
                // Update neighboring tokens
                updateNeighboringTokens(token);
            }
        }
    };

    // Initial update of neighboring tokens
    updateNeighboringTokens(initialToken);

    // Update button styles function
    function updateButtonStyles() {
        const buttons = buttonsContainer.getElementsByTagName('button');
        Array.from(buttons).forEach((btn, index) => {
            const [, datasetId] = datasetLabels[index];
            btn.style.color = currentDataset === datasetId ? '#FFFFFF' : 'rgb(148, 158, 156)';
        });
    }
}); 