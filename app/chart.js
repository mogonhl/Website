document.addEventListener('DOMContentLoaded', () => {
    const timeRanges = ['All-time', '30D', '7D', '24H'];
    let currentDataset = 'dataset1';
    let currentTimeRange = '7D';
    let hasSwitchedToTVL = false;

    // Initialize currentToken if not already set
    if (!window.currentToken) {
        window.currentToken = 'HYPE';
    }

    // Cache object to store fetched data
    const dataCache = {
        dataset1: {}, // Price data cache for each timeRange
        dataset2: {}, // TVL data cache for each timeRange
        dataset3: {}  // Airdrop value data cache for each timeRange
    };

    // Cache expiry time (5 minutes)
    const CACHE_EXPIRY = 5 * 60 * 1000;

    // Configure step sizes for each time range (in minutes)
    const stepSizes = {
        '24H': 180,        // 3 hours for 24H
        '7D': 1440,        // 1 day for 7D
        '30D': 2880,       // 2 days for 30D
        'All-time': 10080  // 7 days for All-time
    };

    // Create buttons container
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'flex justify-between items-center mb-4';
    
    const chartContainer = document.getElementById('price-chart');
    if (!chartContainer) {
        console.error('Chart container not found');
        return;
    }
    
    chartContainer.parentNode.insertBefore(controlsContainer, chartContainer);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'flex gap-4';
    controlsContainer.appendChild(buttonsContainer);

    // Dataset labels and their corresponding IDs
    const datasetLabels = [
        ['Price', 'dataset1'],
        ['TVL', 'dataset2'],
        ['Airdrop', 'dataset3']
    ];

    // Create buttons for each dataset
    datasetLabels.forEach(([label, datasetId]) => {
        const button = document.createElement('button');
        button.textContent = label;
        button.className = `text-xs px-2 py-1 ${currentDataset === datasetId ? 'text-white' : 'text-[rgb(148,158,156)]'} hover:text-white transition-colors`;
        button.onclick = () => {
            if (datasetId === 'dataset2' && window.currentToken !== 'HYPE') {
                return; // Don't switch to TVL for non-HYPE tokens
            }
            currentDataset = datasetId;
            updateChart();
            updateButtonStyles();
            updateDropdownOptions();
        };

        // Hide TVL button if not HYPE token
        if (label === 'TVL' && window.currentToken !== 'HYPE') {
            button.style.display = 'none';
        }

        buttonsContainer.appendChild(button);
    });

    // Create dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'flex items-center';
    controlsContainer.appendChild(dropdownContainer);

    // Create dropdown
    const dropdown = document.createElement('select');
    dropdown.className = 'bg-[#041815] text-xs text-[rgb(148,158,156)] border border-gray-700 rounded px-2 py-1 focus:outline-none hover:border-emerald-400 transition-colors';
    
    function updateDropdownOptions() {
        dropdown.innerHTML = '';
        const availableRanges = currentDataset === 'dataset2' 
            ? timeRanges.filter(range => range !== '24H')
            : timeRanges;
        
        availableRanges.forEach(range => {
            const option = document.createElement('option');
            option.value = range;
            option.text = range;
            option.selected = range === currentTimeRange;
            dropdown.appendChild(option);
        });

        if (currentDataset === 'dataset2' && currentTimeRange === '24H') {
            currentTimeRange = '7D';
            dropdown.value = '7D';
            updateChart();
        }
    }

    dropdownContainer.appendChild(dropdown);

    // Initialize the dropdown with options
    updateDropdownOptions();

    function updateButtonStyles() {
        const buttons = buttonsContainer.getElementsByTagName('button');
        Array.from(buttons).forEach((btn, index) => {
            const [label, datasetId] = datasetLabels[index];
            
            // Update TVL button visibility when token changes
            if (label === 'TVL') {
                btn.style.display = window.currentToken === 'HYPE' ? 'block' : 'none';
            }
            
            btn.className = `text-xs ${currentDataset === datasetId ? 'text-white' : 'text-[rgb(148,158,156)]'} hover:text-white transition-colors`;
        });
    }

    // Make sure the chart container is empty before initializing
    const container = document.getElementById('price-chart');
    if (container) {
        container.innerHTML = '';
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
        }
        if (num >= 1e6) {
            return (num / 1e6).toFixed(1) + 'M';
        }
        if (num >= 1e3) {
            return (num / 1e3).toFixed(1) + 'K';
        }
        return num.toString();
    };

    const formatTooltipNumber = (num) => {
        if (currentDataset === 'dataset3') {
            // For airdrop value, always show with 2 decimal places
            return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
        if (num === 0) return '0';
        
        if (num > 0 && num < 0.01) {
            return num.toFixed(4);
        }
        
        if (num > 0 && num < 1) {
            return num.toFixed(3);
        }
        
        if (num >= 1e9) {
            return (num / 1e9).toFixed(2) + 'B';
        }
        if (num >= 1e6) {
            return (num / 1e6).toFixed(2) + 'M';
        }
        if (num >= 1e3) {
            return (num / 1e3).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    };

    async function fetchData(timeRange) {
        try {
            const token = window.currentToken || 'HYPE';
            
            // If trying to fetch TVL data for non-HYPE token, return empty array
            if (currentDataset === 'dataset2' && token !== 'HYPE') {
                return [];
            }
            
            // Check localStorage cache first
            const cacheKey = currentDataset === 'dataset2' 
                ? `tvl_data_${timeRange}_${token.toLowerCase()}`
                : `price_data_${timeRange}_${token.toLowerCase()}`;
            
            const memCache = dataCache[currentDataset][cacheKey];
            if (memCache && (Date.now() - memCache.timestamp) < CACHE_EXPIRY) {
                return memCache.data;
            }

            // Skip 24H for TVL data
            if (currentDataset === 'dataset2' && timeRange === '24H') {
                throw new Error('TVL data not available for 24H timeframe');
            }

            console.log('Fetching fresh data for token:', token, 'timeRange:', timeRange, 'dataset:', currentDataset);
            const url = `${getApiUrl()}?timeRange=${timeRange}&token=${token}&dataset=${currentDataset}`;
            console.log('Request URL:', url);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const rawData = await response.json();
            
            // Handle both price and TVL data formats
            let processedData;
            if (currentDataset === 'dataset2') {
                // For TVL data
                if (!rawData || !rawData.tvl || !Array.isArray(rawData.tvl)) {
                    throw new Error('Invalid TVL data format');
                }
                processedData = rawData.tvl.map(([timestamp, value]) => ({
                    time: timestamp,
                    value: parseFloat(value)
                }));
            } else if (currentDataset === 'dataset3') {
                // For airdrop value data
                if (!rawData || !Array.isArray(rawData.prices)) {
                    throw new Error('Invalid price data format');
                }
                const airdropAmount = window.TOKENS[token].airdropAmount;
                processedData = rawData.prices.map(([timestamp, price]) => ({
                    time: timestamp,
                    value: parseFloat(price) * airdropAmount
                }));
            } else {
                // For price data
                if (!rawData || !Array.isArray(rawData.prices)) {
                    throw new Error('Invalid price data format');
                }
                processedData = rawData.prices.map(([timestamp, price]) => ({
                    time: timestamp,
                    value: parseFloat(price)
                }));
            }

            // Cache the processed data
            dataCache[currentDataset][cacheKey] = {
                timestamp: Date.now(),
                data: processedData
            };

            return processedData;
        } catch (error) {
            console.error('Error fetching data:', error);
            return [];
        }
    }

    async function updateChart() {
        try {
            const container = document.getElementById('price-chart');
            if (!container) return;

            const data = await fetchData(currentTimeRange);
            if (!data || data.length === 0) {
                console.error('No data available');
                return;
            }

            // Create root using createRoot instead of render
            const root = ReactDOM.createRoot(container);
            
            const chart = React.createElement(ResponsiveContainer, 
                { 
                    width: '100%',
                    height: '95%'
                },
                React.createElement(AreaChart, 
                    { 
                        data: data,
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
                                
                                let tooltipText;
                                if (currentDataset === 'dataset3') {
                                    tooltipText = `${year} ${month} ${day}: $${formatTooltipNumber(value)}`;
                                } else {
                                    tooltipText = `${year} ${month} ${day}: $${formatTooltipNumber(value)}`;
                                }
                                
                                return React.createElement('div', {
                                    style: {
                                        backgroundColor: '#041815',
                                        padding: '8px 12px',
                                        fontSize: '12px',
                                        whiteSpace: 'nowrap',
                                        border: 'none'
                                    }
                                }, tooltipText);
                            }
                            return null;
                        },
                        cursor: {
                            stroke: '#3E3E3E'
                        },
                        wrapperStyle: { zIndex: 1000 }
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

    // Handle token changes
    window.addEventListener('tokenChange', () => {
        updateButtonStyles();
        updateDropdownOptions();
    });

    // Initial render
    updateButtonStyles();
    updateDropdownOptions();
    updateChart();
}); 