document.addEventListener('DOMContentLoaded', () => {
    const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
    const timeRanges = ['7D', '14D', '30D'];
    let currentTimeRange = '7D';
    let currentDataset = 'dataset1';
    
    // Initialize data cache for each dataset
    const dataCache = {
        dataset1: {},
        dataset3: {}
    };

    // Get the container
    const container = document.getElementById('price-chart');
    if (!container) {
        console.error('Price chart container not found');
        return;
    }

    // Create controls container
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
    
    // Create and append dataset buttons
    datasetLabels.forEach(([label, datasetId]) => {
        const button = document.createElement('button');
        button.className = `text-xs ${currentDataset === datasetId ? 'text-white' : 'text-[rgb(148,158,156)]'} hover:text-white transition-colors`;
        button.textContent = label;
        button.onclick = async () => {
            console.log('Dataset button clicked:', datasetId, 'Previous dataset:', currentDataset);
            currentDataset = datasetId;
            console.log('Dataset updated to:', currentDataset);
            updateButtonStyles();
            await updateChart(currentTimeRange);
            console.log('Chart update completed for dataset:', currentDataset);
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
        const token = window.currentToken || 'HYPE';
        console.log('Fetching data for:', { timeRange, token, dataset: currentDataset });
        
        // Check local cache first
        const cacheKey = `${timeRange}_${token}_${currentDataset}`;
        const cached = dataCache[currentDataset][cacheKey];
        if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
            console.log('Serving from local cache:', cacheKey);
            return cached.data;
        }

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`Fetching data attempt ${attempt}/${retries}:`, { timeRange, token, dataset: currentDataset });
                const response = await fetch(`/api/price-data?timeRange=${timeRange}&token=${token}&dataset=${currentDataset}`);
                
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
                console.log('Received data for dataset:', currentDataset, data);
                
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

    // Handle token changes
    window.addEventListener('tokenChange', async () => {
        const token = window.currentToken || 'HYPE';
        console.log('Token changed to:', token, 'Current dataset:', currentDataset, 'Current time range:', currentTimeRange);
        updateButtonStyles();
        await updateChart(currentTimeRange);
        console.log('Chart update completed for token change');
    });

    // Initial render
    console.log('Performing initial render with:', { 
        timeRange: currentTimeRange, 
        dataset: currentDataset, 
        token: window.currentToken || 'HYPE' 
    });
    updateChart(currentTimeRange);

    // Make updateChart available globally
    window.chartUpdateAndPrefetch = async function(timeRange) {
        console.log('chartUpdateAndPrefetch called with:', timeRange, 'Current dataset:', currentDataset);
        if (timeRange) {
            currentTimeRange = timeRange;
            dropdown.value = timeRange;
        }
        await updateChart(currentTimeRange);
        console.log('Chart update completed for prefetch');
    };

    // Make clearCache available globally
    window.clearChartCache = function() {
        Object.keys(dataCache).forEach(dataset => {
            dataCache[dataset] = {};
        });
    };

    // Update the chart with new data
    function updateChartData(chartData) {
        const { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } = window.Recharts;
        const container = document.getElementById('price-chart');
        
        if (!container) {
            console.error('Chart container not found');
            return;
        }

        // Create root element if it doesn't exist
        if (!window.chartRoot) {
            window.chartRoot = ReactDOM.createRoot(container);
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

        window.chartRoot.render(chart);
    }

    async function updateChart(timeRange = '7D') {
        try {
            console.log('Updating chart with:', { timeRange, token: window.currentToken, dataset: currentDataset });
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
            updateChartData(chartData);
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }
});
