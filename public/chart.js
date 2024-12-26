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
            return Math.round(num / 1e9) + 'B';
        } else if (num >= 1e6) {
            return Math.round(num / 1e6) + 'M';
        } else if (num >= 1e5) {
            return Math.round(num / 1e3) + 'K';
        }
        return num.toString();
    };

    // Format numbers with dots for tooltip
    const formatTooltipNumber = (num) => {
        num = Math.round(num);
        if (num === 0) return '0';
        
        const numStr = num.toString();
        const parts = [];
        for (let i = numStr.length; i > 0; i -= 3) {
            parts.unshift(numStr.slice(Math.max(0, i - 3), i));
        }
        
        return parts.join('.');
    };

    // Get the base URL for API calls
    const getApiUrl = () => {
        if (window.location.hostname.includes('vercel.app')) {
            return `${window.location.origin}/api/price-data`;
        }
        return '/api/price-data';  // For local development, just use relative path
    };

    // Create the controls container
    const container = document.getElementById('price-chart');
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'flex items-center justify-between mb-4';
    container.parentNode.insertBefore(controlsContainer, container);

    // Create dataset buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'flex gap-4';
    const datasetLabels = [
        ['Price', 'dataset1'],
        ['Airdrop', 'dataset3']
    ];
    datasetLabels.forEach(([label, datasetId]) => {
        const button = document.createElement('button');
        button.className = `text-xs ${currentDataset === datasetId ? 'text-white' : 'text-[rgb(148,158,156)]'} hover:text-white transition-colors`;
        button.textContent = label;
        button.onclick = () => {
            currentDataset = datasetId;
            updateChart();
            updateButtonStyles();
            updateDropdownOptions();
        };
        buttonsContainer.appendChild(button);
    });

    // Create dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'flex items-center';

    controlsContainer.appendChild(buttonsContainer);
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

    function updateButtonStyles() {
        const buttons = buttonsContainer.getElementsByTagName('button');
        Array.from(buttons).forEach((btn, index) => {
            const [label, datasetId] = datasetLabels[index];
            btn.className = `text-xs ${currentDataset === datasetId ? 'text-white' : 'text-[rgb(148,158,156)]'} hover:text-white transition-colors`;
        });
    }

    async function fetchData(timeRange, retries = 3) {
        // Check local cache first
        const cacheKey = `${timeRange}_${window.currentToken}_${currentDataset}`;
        const cached = dataCache[currentDataset][cacheKey];
        if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
            console.log('Serving from local cache:', cacheKey);
            return cached.data;
        }

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`Fetching data attempt ${attempt}/${retries} for:`, timeRange, 'token:', window.currentToken);
                const response = await fetch(`/api/price-data?timeRange=${timeRange}&token=${window.currentToken}&dataset=${currentDataset}`);
                
                if (!response.ok) {
                    const text = await response.text();
                    console.error(`API Response (attempt ${attempt}):`, text);
                    
                    if (attempt === retries) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
                    continue;
                }
                
                const data = await response.json();
                console.log('Received data:', data);
                
                if (!data || !data.prices) {
                    console.error('Invalid data format:', data);
                    throw new Error('Invalid data format received');
                }

                // Update local cache
                dataCache[currentDataset][cacheKey] = {
                    data,
                    timestamp: Date.now()
                };
                
                return data;
            } catch (error) {
                if (attempt === retries) {
                    console.error('Error fetching data (all retries failed):', error);
                    return null;
                }
                console.warn(`Attempt ${attempt} failed:`, error);
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
            }
        }
        return null;
    }

    async function updateChart(timeRange = '7D') {
        try {
            const data = await fetchData(timeRange);
            if (!data || !data.prices || data.prices.length === 0) {
                console.log('No data available');
                return;
            }

            // Process the data
            const chartData = data.prices.map(([timestamp, price]) => ({
                time: timestamp / 1000,
                value: price
            }));

            console.log('Processed chart data:', chartData);

            // Update the chart
            if (window.chart) {
                window.chart.update(chartData);
            } else {
                initializeChart(chartData);
            }
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
    updateChartAndPrefetch(currentTimeRange);

    // Make updateChart available globally
    window.chartUpdateAndPrefetch = async function(timeRange) {
        if (timeRange) {
            currentTimeRange = timeRange;
            dropdown.value = timeRange;
        }
        await updateChart();
    };

    // Make clearCache available globally
    window.clearChartCache = function() {
        Object.keys(dataCache).forEach(dataset => {
            dataCache[dataset] = {};
        });
    };

    function initializeChart(data) {
        const { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } = window.Recharts;
        const container = document.getElementById('price-chart');
        
        if (!container) {
            console.error('Chart container not found');
            return;
        }

        // Create root element
        const root = ReactDOM.createRoot(container);
        
        const chart = React.createElement(ResponsiveContainer, 
            { width: '100%', height: '95%' },
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
        window.chart = { update: (newData) => root.render(chart) };
    }
});
