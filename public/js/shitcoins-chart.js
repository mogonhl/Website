document.addEventListener('DOMContentLoaded', () => {
    const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
    const timeRanges = ['30D', 'All-time']; // Removed 7D
    let currentTimeRange = '30D';
    let currentDataset = 'dataset1';
    
    // Configure step sizes for each time range (in points)
    const targetDataPoints = {
        '30D': 60,     // One point per 12 hours
        'All-time': 90 // Larger steps for all-time view
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
        if (typeof num !== 'number') return '0';
        num = Math.round(num);
        if (num === 0) return '0';
        
        const numStr = num.toString();
        const parts = [];
        for (let i = numStr.length; i > 0; i -= 3) {
            parts.unshift(numStr.slice(Math.max(0, i - 3), i));
        }
        
        return parts.join('.');
    };
    
    // Initialize data cache
    const dataCache = {};

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
    const indexText = document.createElement('span');
    indexText.className = 'text-white text-xs';
    indexText.textContent = 'Snipe Index';
    titleContainer.appendChild(indexText);

    // Add "Index" text
    const basicIndex = document.createElement('span');
    basicIndex.className = 'text-[rgb(148,158,156)] text-xs line-through';
    basicIndex.textContent = 'Index';
    titleContainer.appendChild(basicIndex);

    // Add "w/o HYPE" text
    const woHypeText = document.createElement('span');
    woHypeText.className = 'text-[rgb(148,158,156)] text-xs line-through';
    woHypeText.textContent = 'w/o HYPE';
    titleContainer.appendChild(woHypeText);

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
            const cacheKey = `index_chart_cache_${timeRange}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_EXPIRY) {
                    console.log('Serving from localStorage cache:', cacheKey);
                    return data;
                }
            }
        } catch (error) {
            console.error('Error reading from cache:', error);
        }
        return null;
    }

    // Function to set cached data
    function setCachedData(timeRange, data) {
        try {
            const cacheKey = `index_chart_cache_${timeRange}`;
            localStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
            console.log('Saved to localStorage cache:', cacheKey);
        } catch (error) {
            console.error('Error writing to cache:', error);
        }
    }

    async function fetchData(timeRange, retries = 3) {
        console.log('Fetching index data for:', { timeRange });
        
        // Check localStorage cache first
        const cached = getCachedData(timeRange);
        if (cached) {
            return cached;
        }

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`Fetching data attempt ${attempt}/${retries}:`, { timeRange });
                
                // Use spot-data endpoint for 7D view, price-data for others
                const endpoint = timeRange === '7D' 
                    ? '/api/spot-data?timeRange=7D'
                    : `/api/price-data?timeRange=${timeRange}&token=INDEX&dataset=dataset1`;
                
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
                
                if (!data || !data.prices) {
                    console.error('Invalid data format:', data);
                    throw new Error('Invalid data format received');
                }

                // Process the data
                const processedData = data.prices.map(([timestamp, price]) => ({
                    time: timestamp / 1000,
                    value: parseFloat(price)
                }));

                // Save to localStorage cache
                setCachedData(timeRange, processedData);
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

    async function updateChart(timeRange = '7D') {
        try {
            console.log('Updating chart with:', { timeRange });
            const data = await fetchData(timeRange);
            if (!data || data.length === 0) {
                console.log('No data available');
                return;
            }

            // Reduce data points based on time range
            const target = targetDataPoints[timeRange] || data.length;
            const reducedData = reduceDataPoints(data, target);
            console.log('Rendering chart data:', reducedData);
            updateChartData(reducedData);
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }

    // Initial render
    console.log('Performing initial render with:', { timeRange: currentTimeRange });
    updateChart(currentTimeRange);
}); 