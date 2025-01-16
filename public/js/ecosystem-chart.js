document.addEventListener('DOMContentLoaded', () => {
    const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
    const timeRanges = ['30D', 'All-time']; // Removed 7D
    let currentTimeRange = '30D';
    let currentDataset = 'dataset1';
    let currentIndexType = 'mcap'; // Changed default from 'snipe' to 'mcap'
    const TOTAL_ASSETS_AMOUNT = 1; // Base amount for Snipe index

    // Configure step sizes for each time range (in points)
    const targetDataPoints = {
        '30D': 60,     // One point per 12 hours
        'All-time': 90 // Larger steps for all-time view
    };

    // Index descriptions
    const INDEX_DESCRIPTIONS = {
        mcap: {
            desc1: 'Market cap weighted index of all tokens on Hyperliquid.',
            desc2: 'The bigger the market cap, the higher the weight in the index.'
        },
        'mcap-ex-hype': {
            desc1: 'Market cap weighted index excluding the HYPE token.',
            desc2: 'Same as the regular index but without the influence of HYPE.'
        },
        equal: {
            desc1: 'Equal weighted index of all tokens on Hyperliquid.',
            desc2: 'Every token has the same weight regardless of its market cap.'
        },
        snipe: {
            desc1: 'Snipe index tracks the performance of $1 investments in new tokens.',
            desc2: 'Performance shows profit/loss after subtracting the total invested amount ($1 per token).'
        },
        volume: {
            desc1: 'Volume weighted index of all tokens on Hyperliquid.',
            desc2: 'Higher trading volume means higher weight in the index.'
        }
    };

    // Function to reduce data points
    function reduceDataPoints(data, targetPoints) {
        if (!data || data.length <= targetPoints) return data;
        
        const step = Math.ceil(data.length / targetPoints);
        return data.filter((_, index) => index % step === 0);
    }

    // Format numbers with K/M/B for axis labels
    const formatAxisNumber = (num) => {
        if (num === 0) return '0';
        
        // For very small numbers (0.01 and below), show up to 3 decimal places
        if (num > 0 && num < 0.01) {
            return num.toFixed(3);
        }
        
        // For numbers between 0.01 and 1, show two decimal places
        if (num > 0 && num < 1) {
            return num.toFixed(2);
        }
        
        num = Math.round(num);
        if (num >= 1e9) {
            return (num / 1e9).toFixed(1) + 'B';
        } else if (num >= 1e6) {
            return (num / 1e6).toFixed(1) + 'M';
        } else if (num >= 1e3) {
            return (num / 1e3).toFixed(1) + 'K';
        }
        return num.toString();
    };

    // Format numbers with dots for tooltip
    const formatTooltipNumber = (num) => {
        if (typeof num !== 'number') return '0';
        
        // For very small numbers (0.01 and below), show up to 3 decimal places
        if (num > 0 && num < 0.01) {
            return num.toFixed(3);
        }
        
        // For numbers between 0.01 and 1, show two decimal places
        if (num > 0 && num < 1) {
            return num.toFixed(2);
        }
        
        // For numbers above 1, round to 2 decimal places
        num = Math.round(num * 100) / 100;
        
        const numStr = num.toString();
        const parts = [];
        const [whole, decimal] = numStr.split('.');
        
        // Format the whole number part with dots
        for (let i = whole.length; i > 0; i -= 3) {
            parts.unshift(whole.slice(Math.max(0, i - 3), i));
        }
        
        // Add the decimal part if it exists
        if (decimal) {
            return parts.join('.') + ',' + decimal;
        }
        
        return parts.join('.');
    };
    
    // Initialize data cache
    const dataCache = {};

    // Function to update button styles based on current index type
    function updateIndexButtonStyles() {
        const basicIndex = document.querySelector('[data-index-type="mcap"]');
        const snipeText = document.querySelector('[data-index-type="snipe"]');
        const fomoText = document.querySelector('[data-index-type="volume"]');
        const woHypeText = document.querySelector('[data-index-type="mcap-ex-hype"]');
        const equalText = document.querySelector('[data-index-type="equal"]');
        const separator = document.querySelector('.index-separator');

        // Show/hide w/o HYPE, Equal, and separator based on current type
        const isIndexMode = ['mcap', 'mcap-ex-hype', 'equal'].includes(currentIndexType);
        [woHypeText, equalText].forEach(el => {
            if (el) el.style.display = isIndexMode ? '' : 'none';
        });
        if (separator) separator.style.display = isIndexMode ? '' : 'none';

        // Reset all buttons to default style
        [basicIndex, snipeText, fomoText].forEach(btn => {
            if (btn) btn.className = 'text-[rgb(148,158,156)] text-xs cursor-pointer hover:text-white transition-colors';
        });
        [woHypeText, equalText].forEach(btn => {
            if (btn) btn.className = 'text-[rgb(148,158,156)] text-xs cursor-pointer hover:text-emerald-400 transition-colors';
        });

        // Highlight the active button
        const activeButton = document.querySelector(`[data-index-type="${currentIndexType}"]`);
        if (activeButton) {
            if (currentIndexType === 'mcap-ex-hype' || currentIndexType === 'equal') {
                activeButton.className = 'text-emerald-400 text-xs cursor-pointer hover:text-emerald-400 transition-colors';
            } else {
                activeButton.className = 'text-white text-xs cursor-pointer hover:text-white transition-colors';
            }
        }
    }

    // Function to update descriptions
    function updateDescriptions() {
        const desc1Element = document.getElementById('desc1');
        const desc2Element = document.getElementById('desc2');
        if (desc1Element && desc2Element) {
            const descriptions = INDEX_DESCRIPTIONS[currentIndexType];
            desc1Element.textContent = descriptions.desc1;
            desc2Element.textContent = descriptions.desc2;
        }
    }

    // Function to switch index type
    function switchIndex(type) {
        currentIndexType = type;
        updateIndexButtonStyles();
        updateDescriptions();
        updateChart(currentTimeRange);
    }

    // Get the container
    const container = document.getElementById('index-chart');
    if (!container) {
        console.error('Index chart container not found');
        return;
    }

    // Create controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'flex items-center justify-between mb-4';
    container.parentNode.insertBefore(controlsContainer, container);

    // Create title container on the left
    const titleContainer = document.createElement('div');
    titleContainer.className = 'flex items-center gap-4 ml-4';
    
    // Add "Index" text
    const basicIndex = document.createElement('span');
    basicIndex.className = 'text-white text-xs cursor-pointer hover:text-white transition-colors';
    basicIndex.textContent = 'Index';
    basicIndex.setAttribute('data-index-type', 'mcap');
    basicIndex.onclick = () => switchIndex('mcap');
    titleContainer.appendChild(basicIndex);

    // Add "w/o HYPE" text (smaller)
    const woHypeText = document.createElement('span');
    woHypeText.className = 'text-[rgb(148,158,156)] text-xs cursor-pointer hover:text-emerald-400 transition-colors';
    woHypeText.textContent = 'w/o HYPE';
    woHypeText.setAttribute('data-index-type', 'mcap-ex-hype');
    woHypeText.onclick = () => switchIndex('mcap-ex-hype');
    titleContainer.appendChild(woHypeText);

    // Add "Equal" text (smaller)
    const equalText = document.createElement('span');
    equalText.className = 'text-[rgb(148,158,156)] text-xs cursor-pointer hover:text-emerald-400 transition-colors';
    equalText.textContent = 'Equal';
    equalText.setAttribute('data-index-type', 'equal');
    equalText.onclick = () => switchIndex('equal');
    titleContainer.appendChild(equalText);

    // Add separator line
    const separator = document.createElement('div');
    separator.className = 'h-3 w-[1px] bg-gray-700 index-separator';
    titleContainer.appendChild(separator);

    // Add "Snipe" text
    const snipeText = document.createElement('span');
    snipeText.className = 'text-[rgb(148,158,156)] text-xs cursor-pointer hover:text-white transition-colors';
    snipeText.textContent = 'Snipe';
    snipeText.setAttribute('data-index-type', 'snipe');
    snipeText.onclick = () => switchIndex('snipe');
    titleContainer.appendChild(snipeText);

    // Add "FOMO" text
    const fomoText = document.createElement('span');
    fomoText.className = 'text-[rgb(148,158,156)] text-xs cursor-pointer hover:text-white transition-colors';
    fomoText.textContent = 'FOMO';
    fomoText.setAttribute('data-index-type', 'volume');
    fomoText.onclick = () => switchIndex('volume');
    titleContainer.appendChild(fomoText);

    controlsContainer.appendChild(titleContainer);

    // Create dropdown container on the right
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'flex items-center';
    controlsContainer.appendChild(dropdownContainer);

    // Create dropdown
    const dropdown = document.createElement('select');
    dropdown.className = 'bg-[#041815] text-xs text-[rgb(148,158,156)] border border-gray-700 rounded px-2 py-1 focus:outline-none hover:border-emerald-400 transition-colors';
    
    function updateDropdownOptions() {
        dropdown.innerHTML = '';
        timeRanges.forEach(range => {
            const option = document.createElement('option');
            option.value = range;
            option.text = range;
            option.selected = range === currentTimeRange;
            dropdown.appendChild(option);
        });
    }

    updateDropdownOptions();
    dropdownContainer.appendChild(dropdown);

    // Function to get cached data
    function getCachedData(timeRange) {
        try {
            const cacheKey = `index_chart_cache_${timeRange}_${currentIndexType}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                // Only use cache if it's fresh and data looks valid
                if (Date.now() - timestamp < CACHE_EXPIRY && 
                    Array.isArray(data) && 
                    data.length > 0 && 
                    data[0].value > 0) {
                    console.log('Serving from cache:', cacheKey, data);
                    return data;
                } else {
                    // Clear only this expired cache entry
                    localStorage.removeItem(cacheKey);
                }
            }
        } catch (error) {
            console.error('Error reading from cache:', error);
            // Only clear this specific cache entry on error
            try {
                const cacheKey = `index_chart_cache_${timeRange}_${currentIndexType}`;
                localStorage.removeItem(cacheKey);
            } catch (e) {
                console.error('Error clearing cache entry:', e);
            }
        }
        return null;
    }

    // Function to set cached data
    function setCachedData(timeRange, data) {
        try {
            // Validate data before caching
            if (!Array.isArray(data) || data.length === 0) {
                console.error('Invalid data format for caching:', data);
                return;
            }
            
            const cacheKey = `index_chart_cache_${timeRange}_${currentIndexType}`;
            localStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
            console.log('Saved to cache:', cacheKey, data);
        } catch (error) {
            console.error('Error writing to cache:', error);
        }
    }

    async function fetchData(timeRange, retries = 3, isAutoUpdate = false) {
        console.log('Fetching index data for:', { timeRange, indexType: currentIndexType, isAutoUpdate });
        
        // Try to get data from cache first
        const cachedData = getCachedData(timeRange);
        if (cachedData && !isAutoUpdate) {
            console.log('Using cached data for:', { timeRange, indexType: currentIndexType });
            return cachedData;
        }
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`Fetching data attempt ${attempt}/${retries}:`, { timeRange, indexType: currentIndexType });
                
                // Always use spot-data endpoint for indices and explicitly include the type parameter
                const endpoint = `/api/spot-data?timeRange=${timeRange}&type=${currentIndexType}`;
                
                const response = await fetch(endpoint);
                
                if (!response.ok) {
                    const text = await response.text();
                    console.error(`API Response (attempt ${attempt}):`, text);
                    
                    if (attempt === retries) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
                    continue;
                }
                
                const data = await response.json();
                console.log('Received data:', data);
                
                if (!data || !data.prices || !Array.isArray(data.prices)) {
                    console.error('Invalid data format:', data);
                    throw new Error('Invalid data format received');
                }

                // If this is an auto-update and we're not on the default index type,
                // we should ignore this update as it's likely for the default index
                if (isAutoUpdate && currentIndexType !== 'mcap') {
                    console.log('Ignoring auto-update for non-default index type');
                    return null;
                }

                // Process the data - use the actual portfolio value
                const processedData = data.prices.map(([timestamp, portfolioValue]) => ({
                    time: timestamp / 1000,
                    value: portfolioValue
                }));

                // Only cache if it's not an auto-update
                if (!isAutoUpdate) {
                    setCachedData(timeRange, processedData);
                }
                
                return processedData;
            } catch (error) {
                console.error(`Error fetching data (attempt ${attempt}):`, error);
                if (attempt === retries) {
                    return null;
                }
                await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
            }
        }
        return null;
    }

    // Handle dropdown changes
    dropdown.addEventListener('change', async (e) => {
        const newTimeRange = e.target.value;
        console.log('Time range changing from', currentTimeRange, 'to', newTimeRange);
        currentTimeRange = newTimeRange;
        await updateChart(currentTimeRange);
        console.log('Chart update completed for time range:', currentTimeRange);
    });

    // Update the chart with new data
    function updateChartData(chartData) {
        const { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } = window.Recharts;
        
        if (!container) {
            console.error('Chart container not found');
            return;
        }

        // Create root element if it doesn't exist
        if (!window.indexChartRoot) {
            window.indexChartRoot = ReactDOM.createRoot(container);
        }
        
        const chart = React.createElement(ResponsiveContainer, 
            { width: '100%', height: '95%' },
            React.createElement(AreaChart, 
                { 
                    data: chartData,
                    margin: { top: 10, right: 0, left: 0, bottom: 0 }
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
                    tickFormatter: (value) => formatAxisNumber(value)
                }),
                React.createElement(Tooltip, {
                    content: ({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                            const date = new Date(label * 1000);
                            const year = date.getFullYear();
                            const month = date.toLocaleString('en-US', { month: 'short' });
                            const day = date.getDate();
                            const value = payload[0].value;
                            return React.createElement('div', {
                                style: {
                                    backgroundColor: '#041815',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    whiteSpace: 'nowrap',
                                    border: 'none'
                                }
                            }, `${year} ${month} ${day}: $${formatTooltipNumber(value)}`);
                        }
                        return null;
                    },
                    cursor: {
                        stroke: '#3E3E3E'
                    },
                    wrapperStyle: { zIndex: 1000 }
                }),
                React.createElement(Area, {
                    type: 'step',
                    dataKey: 'value',
                    stroke: '#FFFFFF',
                    strokeWidth: 2,
                    fill: 'none',
                    dot: false,
                    activeDot: false,
                    step: true,
                    connectNulls: true
                })
            )
        );

        window.indexChartRoot.render(chart);
    }

    async function updateChart(timeRange = '7D', isAutoUpdate = false) {
        try {
            console.log('Updating chart with:', { timeRange, indexType: currentIndexType, isAutoUpdate });
            const data = await fetchData(timeRange, 3, isAutoUpdate);
            if (!data || data.length === 0) {
                console.log('No data available');
                return;
            }

            // If this is an auto-update and we're not on the default index,
            // don't update the chart
            if (isAutoUpdate && currentIndexType !== 'mcap') {
                console.log('Skipping chart update for auto-update on non-default index');
                return;
            }

            // Filter data based on time range
            const now = Date.now() / 1000;
            let filteredData = data;
            if (timeRange === '30D') {
                const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
                filteredData = data.filter(point => point.time >= thirtyDaysAgo);
            }

            // Update performance metrics
            if (filteredData.length > 0) {
                const currentPrice = filteredData[filteredData.length - 1].value;
                const initialPrice = filteredData[0].value;

                // Update token value in About tab
                const tokenValueElement = document.querySelector('.token-value');
                if (tokenValueElement) {
                    tokenValueElement.textContent = `$${formatTooltipNumber(currentPrice)}`;
                }

                // Calculate performance based on time range and current index type
                let performanceValue;
                if (timeRange === '30D') {
                    // For 30D, show actual change
                    performanceValue = currentPrice - initialPrice;
                } else {
                    // For All-time
                    if (currentIndexType === 'snipe') {
                        // For Snipe index, subtract total assets amount
                        performanceValue = currentPrice - TOTAL_ASSETS_AMOUNT;
                    } else {
                        // For other indices, show actual change from initial value
                        performanceValue = currentPrice - initialPrice;
                    }
                }

                // Update performance in top stats
                const performanceElement = document.querySelector('.performance');
                if (performanceElement) {
                    const isPositive = performanceValue >= 0;
                    const formattedValue = formatTooltipNumber(Math.abs(performanceValue));
                    performanceElement.textContent = `${isPositive ? '+' : '-'}$${formattedValue}`;
                    performanceElement.parentElement.classList.remove('text-emerald-400', 'text-red-400');
                    performanceElement.parentElement.classList.add(isPositive ? 'text-emerald-400' : 'text-red-400');
                }

                // Update multiplier in top stats
                const multiplierElement = document.querySelector('.multiplier');
                if (multiplierElement) {
                    const multiplier = currentPrice / initialPrice;
                    multiplierElement.textContent = `${multiplier.toFixed(1)}x`;
                    multiplierElement.classList.remove('bg-emerald-400/20', 'text-emerald-400', 'bg-red-400/20', 'text-red-400');
                    multiplierElement.classList.add(
                        multiplier >= 1 ? 'bg-emerald-400/20' : 'bg-red-400/20',
                        multiplier >= 1 ? 'text-emerald-400' : 'text-red-400'
                    );
                }
            }

            // Reduce data points based on time range
            const target = targetDataPoints[timeRange] || data.length;
            const reducedData = reduceDataPoints(filteredData, target);
            console.log('Rendering chart data:', reducedData);
            updateChartData(reducedData);
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }

    // Initial render
    console.log('Performing initial render with:', { timeRange: currentTimeRange });
    updateDescriptions();
    updateChart(currentTimeRange);
    switchIndex('mcap');

    // Initialize button styles
    updateIndexButtonStyles();
}); 