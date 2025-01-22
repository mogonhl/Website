import { TOKENS } from '/app/types/tokens.js';

// Make TOKENS and currentToken available globally
window.TOKENS = TOKENS;
window.currentToken = 'INDEX';  // Default token

// Helper functions
window.formatNumberWithDots = function(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

window.formatNumber = function(num, useFullInteger = false) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    
    if (useFullInteger) {
        return window.formatNumberWithDots(num);
    }
    
    // Format with German locale for dot separator
    if (num >= 1e9) {
        return (num / 1e9).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'B';
    }
    if (num >= 1e6) {
        return (num / 1e6).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'M';
    }
    if (num >= 1e3) {
        return (num / 1e3).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'K';
    }
    return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

window.formatPrice = function(price) {
    if (typeof price !== 'number' || isNaN(price)) return '0';
    
    // Always use 8 decimal places for small numbers
    if (price < 0.001) {
        return price.toLocaleString('de-DE', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
    }
    return price.toLocaleString('de-DE', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
}

window.formatChange = function(change) {
    if (typeof change !== 'number' || isNaN(change)) return '+0,00000';
    
    const isPositive = change >= 0;
    const absChange = Math.abs(change);
    
    // Always use 5 decimal places for small changes
    const formattedChange = absChange.toLocaleString('de-DE', {
        minimumFractionDigits: 5,
        maximumFractionDigits: 5
    });
    
    return (isPositive ? '+' : '-') + formattedChange;
}

let marketData = null;
let snapshotData = {};
let graphCache = new Map(); // Cache for storing loaded graph data
let currentDisplayCount = 10; // Number of tokens currently displayed
const tokensPerLoad = 10; // Number of tokens to load each time
let isLoading = false; // Track loading state
let currentSortColumn = null; // Track which column we're sorting by
let isAscending = true; // Track sort direction
let searchQuery = ''; // Track search query

// Add search functionality
function setupSearch() {
    const searchInput = document.getElementById('tokenSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        currentDisplayCount = 10; // Reset display count when searching
        if (marketData) {
            updateTokenList(marketData);
        }
    });
}

// Add sort icons HTML
const sortIcons = {
    none: `<svg class="w-4 h-4 ml-1 opacity-0 group-hover:opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
           </svg>`,
    asc: `<svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
          </svg>`,
    desc: `<svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>`
};

function getSortIcon(column) {
    if (currentSortColumn !== column) return sortIcons.none;
    return isAscending ? sortIcons.asc : sortIcons.desc;
}

async function fetchMarketData() {
    if (isLoading) return null;
    isLoading = true;

    try {
        const response = await fetch('/api/market-data');
        if (!response.ok) throw new Error('Failed to fetch market data');
        marketData = await response.json();
        graphCache.clear(); // Clear graph cache when market data is refreshed

        // Fetch token names mapping
        const tokenNamesResponse = await fetch('/api/token-names');
        if (tokenNamesResponse.ok) {
            const tokenNames = await tokenNamesResponse.json();
            // Add token names to market data
            marketData.tokens = marketData.tokens.map(token => ({
                ...token,
                displayName: tokenNames[token.coin] || token.name
            }));
        }

        // Calculate and assign tags once when fetching market data
        let highestPerformance = -Infinity;
        let lowestPerformance = Infinity;
        let highestPerformerCoin = null;
        let lowestPerformerCoin = null;
        
        marketData.tokens.forEach(token => {
            if (token.priceChange > highestPerformance) {
                highestPerformance = token.priceChange;
                highestPerformerCoin = token.coin;
            }
            if (token.priceChange < lowestPerformance) {
                lowestPerformance = token.priceChange;
                lowestPerformerCoin = token.coin;
            }
        });

        // Get the newest launch
        const newestLaunch = launches[0]?.fullName;

        // Assign tags to tokens
        marketData.tokens = marketData.tokens.map(token => ({
            ...token,
            isHighestPerformer: token.coin === highestPerformerCoin,
            isLowestPerformer: token.coin === lowestPerformerCoin,
            isNewLaunch: token.coin === newestLaunch,
            isFake: token.displayName === 'MOG'
        }));

        return marketData;
    } catch (error) {
        console.error('Error fetching market data:', error);
        return null;
    } finally {
        isLoading = false;
    }
}

async function fetchBatchedSnapshotData(tokenIds) {
    const batchSize = 5;
    const tokenDataMap = {};
    
    // Handle PURR data first if requested
    if (tokenIds.includes('purr')) {
        const purrResponse = await fetch(`/api/redis/get?key=spot_data_7d_purr`);
        const purrData = await purrResponse.json();
        console.log('PURR data from Redis:', purrData);
        
        if (purrData && purrData.prices && purrData.timestamps && purrData.total_volumes) {
            // Create arrays of [timestamp, value] pairs
            const prices = [];
            const volumes = [];
            
            for (let i = 0; i < purrData.timestamps.length; i++) {
                prices.push([purrData.timestamps[i], parseFloat(purrData.prices[i])]);
                volumes.push([purrData.timestamps[i], parseFloat(purrData.total_volumes[i])]);
            }
            
            tokenDataMap['purr'] = {
                tokenId: 'purr',
                coin: 'purr',
                prices: prices,
                total_volumes: volumes,
                market_caps: prices.map(([timestamp]) => [timestamp, 0])
            };
            console.log('Processed PURR data:', tokenDataMap['purr']);
        } else {
            console.error('PURR data missing required fields:', purrData);
        }
    }
    
    // Handle other tokens in batches
    const nonPurrTokens = tokenIds.filter(id => id !== 'purr');
    const uniqueBatches = new Set(nonPurrTokens.map(id => Math.floor(parseInt(id) / batchSize)));
    
    try {
        const batchPromises = Array.from(uniqueBatches).map(batchNum => 
            fetch(`/api/redis/get?key=spot_data_7d_${batchNum}`).then(r => r.json())
        );
        
        const batchResults = await Promise.all(batchPromises);
        const allData = batchResults.flat();
        
        console.log('Received data:', allData);
        
        allData.forEach(data => {
            if (!data) {
                console.log('Skipping null/undefined data entry');
                return;
            }
            
            console.log('Processing data entry:', data);
            try {
                // Handle both string and number tokenIds
                const tokenId = data.tokenId?.toString() || 
                              data.coin?.toString() || 
                              data.id?.toString();
                
                if (!tokenId) {
                    console.log('Could not determine token ID from data:', data);
                    return;
                }

                // Remove '@' prefix if it exists
                const id = tokenId.startsWith('@') ? tokenId.substring(1) : tokenId;
                tokenDataMap[id] = data;
            } catch (error) {
                console.error('Error processing data entry:', error);
            }
        });

        return tokenDataMap;
    } catch (error) {
        console.error('Error fetching batched snapshot data:', error);
        return tokenDataMap; // Return what we have
    }
}

// Add shimmer animation style at the top
const style = document.createElement('style');
style.textContent = `
    @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }
    .shimmer-effect {
        position: relative;
        overflow: hidden;
        background: #2a2a2a;
    }
    .shimmer-effect::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(90deg, 
            transparent,
            rgba(255, 255, 255, 0.1),
            transparent
        );
        animation: shimmer 2s infinite;
    }
    .snapshot-placeholder svg {
        overflow: visible;
    }
    .snapshot-placeholder path {
        stroke-dasharray: 200;
        stroke-dashoffset: 200;
        animation: dash 2s infinite linear;
    }
    @keyframes dash {
        to {
            stroke-dashoffset: -200;
        }
    }
`;
document.head.appendChild(style);

function updateTokenList(data) {
    const container = document.querySelector('.token-list');
    
    // Add click handlers to the existing header above token-list
    const headerRow = document.querySelector('.grid.grid-cols-7.gap-4.px-6.py-3');
    if (headerRow) {
        // First, clear any existing click handlers and classes
        Array.from(headerRow.children).forEach(cell => {
            cell.className = 'text-[rgb(148,158,156)]';
            cell.onclick = null;
        });

        // Define the sortable columns with their display text and sort property
        const columnDefinitions = [
            { text: 'Pair', property: 'coin', span: 2 },
            { text: 'Price', property: 'price', span: 1 },
            { text: '24h Change', property: 'priceChange', span: 1 },
            { text: '24h Volume', property: 'volume24h', span: 1 },
            { text: 'Market Cap', property: 'marketCap', span: 1 },
            { text: 'Snapshot', property: null, span: 1 } // Not sortable
        ];

        // Clear the header row
        headerRow.innerHTML = '';

        // Create header cells with proper layout and sorting
        columnDefinitions.forEach(column => {
            const cell = document.createElement('div');
            cell.textContent = column.text;
            
            if (column.span > 1) {
                cell.className = `col-span-${column.span}`;
            }

            if (column.property) {
                cell.className += ' cursor-pointer group flex items-center text-[rgb(148,158,156)]';
                cell.dataset.sortProperty = column.property;
                cell.onclick = () => window.sortTokens(column.property);
                cell.innerHTML = column.text + ' ' + getSortIcon(column.property);
            } else {
                cell.className += ' text-[rgb(148,158,156)]';
            }

            headerRow.appendChild(cell);
        });
    }

    // Clear existing content
    container.innerHTML = '';

    // Filter out excluded tokens and tokens with no volume
    const excludedTokens = ['@71', '@98', '@131'];
    let filteredTokens = data.tokens.filter(token => {
        // Always include PURR/USDC regardless of volume
        if (token.coin === 'PURR/USDC') return true;
        
        // For other tokens, apply normal filtering
        return !excludedTokens.includes(token.coin) && token.volume24h > 0;
    });

    // Apply search filter if there's a search query
    if (searchQuery) {
        filteredTokens = filteredTokens.filter(token => {
            const searchableText = `${token.displayName} ${token.coin}`.toLowerCase();
            return searchableText.includes(searchQuery);
        });
    }

    // Get list of starred tokens from localStorage
    const starredTokens = new Set(JSON.parse(localStorage.getItem('starredTokens') || '[]'));

    // Sort tokens if a sort column is selected
    if (currentSortColumn) {
        filteredTokens.sort((a, b) => {
            // First, check if either token is starred
            const aIsStarred = starredTokens.has(a.coin);
            const bIsStarred = starredTokens.has(b.coin);

            // If star status is different, starred tokens go first
            if (aIsStarred !== bIsStarred) {
                return aIsStarred ? -1 : 1;
            }

            // If both have same star status, sort by the selected column
            if (currentSortColumn === 'coin') {
                return isAscending 
                    ? a.displayName.localeCompare(b.displayName)
                    : b.displayName.localeCompare(a.displayName);
            }

            // For numerical values
            let aValue = a[currentSortColumn];
            let bValue = b[currentSortColumn];

            // Handle potential undefined/null values
            if (aValue === undefined || aValue === null) return isAscending ? -1 : 1;
            if (bValue === undefined || bValue === null) return isAscending ? 1 : -1;

            // Ensure we're working with numbers
            aValue = parseFloat(aValue);
            bValue = parseFloat(bValue);

            // Handle NaN values
            if (isNaN(aValue)) return isAscending ? -1 : 1;
            if (isNaN(bValue)) return isAscending ? 1 : -1;

            return isAscending ? aValue - bValue : bValue - aValue;
        });
    } else {
        // If no sort column is selected, just put starred items at the top
        filteredTokens.sort((a, b) => {
            const aIsStarred = starredTokens.has(a.coin);
            const bIsStarred = starredTokens.has(b.coin);
            return aIsStarred === bIsStarred ? 0 : aIsStarred ? -1 : 1;
        });
    }

    // Only show the first currentDisplayCount tokens
    const tokensToShow = filteredTokens.slice(0, currentDisplayCount);
    
    // Update total assets count in the header
    const totalAssetsElement = document.querySelector('.grid.grid-cols-7.mb-12 .col-span-1 .flex.items-center.gap-2 span');
    if (totalAssetsElement) {
        totalAssetsElement.textContent = filteredTokens.length;
    }
    
    // First, render all rows immediately without waiting for snapshot data
    tokensToShow.forEach(token => {
        const row = document.createElement('div');
        row.className = 'grid grid-cols-7 gap-4 px-6 py-4 border-b border-[#0a2622]';
        
        // Special handling for PURR tokenId
        const tokenId = token.coin === 'PURR/USDC' ? 'purr' : token.coin.replace('@', '');
        
        // Try to find existing snapshot chart
        const existingChart = container.querySelector(`[data-token-id="${tokenId}"]`)?.innerHTML;
        const snapshotHtml = existingChart || `
            <div class="w-full h-10 snapshot-placeholder">
                <svg class="w-full h-10" viewBox="0 0 200 40" preserveAspectRatio="none">
                    <path d="M0 20 C 50 10, 100 30, 150 15, 200 25" 
                          stroke="#2a2a2a" 
                          stroke-width="1.5"
                          fill="none"/>
                </svg>
            </div>
        `;
        
        row.innerHTML = `
            <div class="col-span-2 flex items-center">
                <svg class="star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2.5l2.84 5.75l6.34.92l-4.59 4.47l1.08 6.31L12 17.25l-5.67 2.7l1.08-6.31l-4.59-4.47l6.34-.92L12 2.5z" />
                </svg>
                <div class="asset-info">
                    <div class="relative w-8 h-8">
                        <div class="absolute inset-0 rounded-full shimmer-effect"></div>
                        <img src="${token.displayName === 'HYPE' ? '/assets/icons/Hype.png' : `/assets/icons/spot/${token.displayName}.svg`}" 
                             alt="${token.displayName}" 
                             class="absolute inset-0 w-full h-full rounded-full opacity-0 transition-opacity duration-300" 
                             onload="this.classList.add('opacity-100'); this.previousElementSibling.style.display = 'none';"
                             onerror="this.src='/assets/icons/default.svg'; this.previousElementSibling.style.display = 'none';"
                             loading="lazy">
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-white text-sm">${token.displayName}/USDC</span>
                        <div class="flex gap-1.5">
                            ${token.isHighestPerformer ? '<span class="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-400/10 text-emerald-400/80 rounded-full">PURRG\'EM</span>' : ''}
                            ${token.isLowestPerformer ? '<span class="px-1.5 py-0.5 text-[10px] font-medium bg-red-400/10 text-red-400/80 rounded-full">PURRGED</span>' : ''}
                            ${token.isNewLaunch ? '<span class="px-1.5 py-0.5 text-[10px] font-medium bg-amber-400/10 text-amber-400/80 rounded-full">NEW</span>' : ''}
                            ${token.isFake ? '<span class="px-1.5 py-0.5 text-[10px] font-medium bg-white/5 text-white/60 rounded-full">FAKE</span>' : ''}
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex items-center text-[rgb(148,158,156)] text-sm">$${token.price.toFixed(6)}</div>
            <div class="flex items-center ${token.priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'} text-sm">
                ${token.priceChange >= 0 ? '+' : ''}${token.priceChange.toFixed(2)}%
            </div>
            <div class="flex items-center text-[rgb(148,158,156)] text-sm">$${token.volume24h.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
            <div class="flex items-center text-[rgb(148,158,156)] text-sm">$${token.marketCap.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
            <div class="flex items-center snapshot-container" data-token-id="${tokenId}">
                ${snapshotHtml}
            </div>
        `;

        container.appendChild(row);

        // Add click handler for star icon
        const starIcon = row.querySelector('.star-icon');
        let pendingStarChange = false;

        // Check if this token is starred and update UI accordingly
        if (starredTokens.has(token.coin)) {
            starIcon.classList.add('active');
            row.classList.add('starred');
        }

        starIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            const icon = e.target.closest('.star-icon');
            const tokenCoin = token.coin;
            const rowElement = icon.closest('.token-list > div');
            
            // Remove animation class first
            icon.classList.remove('animate');
            
            // Force reflow to ensure animation plays again
            void icon.offsetWidth;
            
            // Toggle active state and add animation
            icon.classList.toggle('active');
            icon.classList.add('animate');
            
            // Toggle starred class on the row
            rowElement.classList.toggle('starred');
            
            // Update localStorage
            const starredTokens = new Set(JSON.parse(localStorage.getItem('starredTokens') || '[]'));
            if (icon.classList.contains('active')) {
                starredTokens.add(tokenCoin);
            } else {
                starredTokens.delete(tokenCoin);
            }
            localStorage.setItem('starredTokens', JSON.stringify([...starredTokens]));
            
            // Mark that we have a pending change
            pendingStarChange = true;
            
            // Remove animation class after it completes
            setTimeout(() => {
                icon.classList.remove('animate');
            }, 300);

            // Add mouseleave handler to the row
            row.addEventListener('mouseleave', () => {
                if (pendingStarChange) {
                    pendingStarChange = false;
                    
                    // Quick swap: store current charts HTML
                    const currentCharts = {};
                    container.querySelectorAll('.snapshot-container').forEach(chart => {
                        const tokenId = chart.getAttribute('data-token-id');
                        if (tokenId) {
                            currentCharts[tokenId] = chart.innerHTML;
                        }
                    });
                    
                    // Update the list
                    updateTokenList(marketData);
                    
                    // Restore charts
                    Object.entries(currentCharts).forEach(([tokenId, chartHtml]) => {
                        const chart = container.querySelector(`[data-token-id="${tokenId}"]`);
                        if (chart) {
                            chart.innerHTML = chartHtml;
                        }
                    });
                }
            }, { once: true });
        });
    });

    // Update total market cap immediately
    document.querySelector('.market-cap').textContent = 
        `$${data.totalMarketCap.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

    // Show/Hide "Show More" button based on remaining tokens
    const showMoreContainer = document.querySelector('.show-more-container') || document.createElement('div');
    showMoreContainer.className = 'show-more-container flex justify-center mb-32 pb-16';
    
    if (currentDisplayCount < filteredTokens.length && !searchQuery) {
        showMoreContainer.innerHTML = `
            <button class="show-more-btn px-8 py-3 mt-8 bg-[#0f1a1f] hover:bg-[#131f27] text-[#949e9c]
                         border border-[#162630] rounded-lg transition-all duration-200 ease-in-out 
                         flex items-center gap-2 text-sm font-medium">
                <span>Show More</span>
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
            </button>
        `;
        
        const showMoreBtn = showMoreContainer.querySelector('.show-more-btn');
        showMoreBtn.addEventListener('click', () => {
            currentDisplayCount += tokensPerLoad;
            
            // Store current graph cache to avoid reloading existing graphs
            const currentCache = new Map(graphCache);
            
            updateTokenList(marketData);
            
            // Restore cached graphs
            graphCache = new Map([...currentCache, ...graphCache]);
        });

        // Move the button outside the table container
        const tableContainer = container.closest('.table-container') || container.parentElement;
        if (!document.querySelector('.show-more-container')) {
            tableContainer.after(showMoreContainer);
        }
    } else {
        showMoreContainer.remove();
    }

    // Since we preloaded all data, we just need to update the graphs from cache
    const visibleTokenIds = tokensToShow
        .map(token => token.coin === 'PURR/USDC' ? 'purr' : token.coin.replace('@', ''));
    
    // Update all visible graphs from cache
    visibleTokenIds.forEach(tokenId => {
        const cachedData = graphCache.get(tokenId);
        if (cachedData) {
            updateSnapshotChart(tokenId, cachedData);
        }
    });
}

function updateSnapshotChart(tokenId, priceData) {
    const container = document.querySelector(`[data-token-id="${tokenId}"]`);
    if (!container) return;

    // Find the current token's price from marketData
    const currentToken = marketData.tokens.find(token => {
        if (tokenId === 'purr') return token.coin === 'PURR/USDC';
        return token.coin === `@${tokenId}`;
    });

    if (!currentToken) return;

    // Get min and max prices for scaling
    let prices = priceData.map(p => p[1]);
    
    // Add the current price as the last data point
    const lastTimestamp = priceData[priceData.length - 1][0];
    const currentTimestamp = Date.now();
    const extendedPriceData = [
        ...priceData,
        [currentTimestamp, currentToken.price]
    ];
    prices = [...prices, currentToken.price];

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // Calculate points with padding
    const padding = 5; // Padding from top and bottom
    const points = extendedPriceData.map((p, i) => ({
        x: (i / (extendedPriceData.length - 1)) * 200,
        y: padding + ((maxPrice - p[1]) / priceRange) * (40 - 2 * padding)
    }));

    // Create path with minimal smoothing - just connect the points
    let pathD = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    // Calculate if price went up or down using the first and current price
    const priceChange = currentToken.price - prices[0];
    const isPositive = priceChange >= 0;

    // Create gradient for the path
    const gradientId = `gradient-${tokenId}`;

    // Replace the placeholder with the actual chart
    container.innerHTML = `
        <svg class="w-full h-10" viewBox="0 0 200 40" preserveAspectRatio="none">
            <defs>
                <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${isPositive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}"/>
                    <stop offset="100%" stop-color="${isPositive ? 'rgba(16, 185, 129, 0)' : 'rgba(239, 68, 68, 0)'}"/>
                </linearGradient>
            </defs>
            <path 
                d="${pathD} L ${points[points.length - 1].x},40 L ${points[0].x},40 Z" 
                fill="url(#${gradientId})"
                stroke="none"
                opacity="0.3"
            />
            <path 
                d="${pathD}" 
                fill="none" 
                stroke="${isPositive ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'}" 
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
}

function showPlaceholderTable() {
    const container = document.querySelector('.token-list');
    if (!container) return;

    container.innerHTML = '';
    
    // Create 10 placeholder rows
    for (let i = 0; i < 10; i++) {
        const row = document.createElement('div');
        row.className = 'grid grid-cols-7 gap-4 px-6 py-4 border-b border-[#0a2622]';
        
        row.innerHTML = `
            <div class="col-span-2 flex items-center">
                <svg class="star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2.5l2.84 5.75l6.34.92l-4.59 4.47l1.08 6.31L12 17.25l-5.67 2.7l1.08-6.31l-4.59-4.47l6.34-.92L12 2.5z" />
                </svg>
                <div class="asset-info">
                    <div class="relative w-8 h-8">
                        <div class="absolute inset-0 rounded-full shimmer-effect"></div>
                    </div>
                    <div class="w-24 h-5 shimmer-effect rounded"></div>
                </div>
            </div>
            <div class="flex items-center">
                <div class="w-20 h-5 shimmer-effect rounded"></div>
            </div>
            <div class="flex items-center">
                <div class="w-16 h-5 shimmer-effect rounded"></div>
            </div>
            <div class="flex items-center">
                <div class="w-24 h-5 shimmer-effect rounded"></div>
            </div>
            <div class="flex items-center">
                <div class="w-28 h-5 shimmer-effect rounded"></div>
            </div>
            <div class="flex items-center snapshot-container">
                <div class="w-full h-10 snapshot-placeholder">
                    <svg class="w-full h-10" viewBox="0 0 200 40" preserveAspectRatio="none">
                        <path d="M0 20 C 50 10, 100 30, 150 15, 200 25" 
                              stroke="#2a2a2a" 
                              stroke-width="1.5"
                              fill="none"/>
                    </svg>
                </div>
            </div>
        `;

        container.appendChild(row);

        // Add click handler for star icon
        const starIcon = row.querySelector('.star-icon');
        starIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            const icon = e.target.closest('.star-icon');
            
            // Remove animation class first
            icon.classList.remove('animate');
            
            // Force reflow to ensure animation plays again
            void icon.offsetWidth;
            
            // Toggle active state and add animation
            icon.classList.toggle('active');
            icon.classList.add('animate');
            
            // Remove animation class after it completes
            setTimeout(() => {
                icon.classList.remove('animate');
            }, 300);
        });
    }
}

// Initial load
window.addEventListener('DOMContentLoaded', async () => {
    // Show placeholder table immediately
    showPlaceholderTable();
    
    // Setup search functionality
    setupSearch();
    
    // Then load the real data
    const data = await fetchMarketData();
    if (data) {
        // Preload ALL graph data immediately
        const allTokenIds = data.tokens
            .filter(token => token.volume24h > 0 && !['@71', '@98', '@131'].includes(token.coin))
            .map(token => token.coin === 'PURR/USDC' ? 'purr' : token.coin.replace('@', ''));

        // Fetch all graph data at once
        try {
            const allSnapshotData = await fetchBatchedSnapshotData(allTokenIds);
            // Store all data in cache
            Object.entries(allSnapshotData).forEach(([tokenId, data]) => {
                if (data && data.prices) {
                    graphCache.set(tokenId, data.prices);
                }
            });
        } catch (error) {
            console.error('Error preloading graph data:', error);
        }

        // Now update the display with initial count
        updateTokenList(data);
    }
});

// Remove the automatic refresh interval
// The refresh is now manual only via the refresh button 

// Add global sort function
window.sortTokens = function(column) {
    if (currentSortColumn === column) {
        if (isAscending) {
            // If currently ascending, switch to descending
            isAscending = false;
        } else {
            // If currently descending, clear sort
            currentSortColumn = null;
            isAscending = true;
        }
    } else {
        // If clicking a new column, set it as current and default to ascending
        currentSortColumn = column;
        isAscending = true;
    }
    
    // Re-render the table with new sort
    if (marketData) {
        updateTokenList(marketData);
    }
}; 

async function preloadLaunchData() {
    try {
        // Get launches from Redis
        const response = await fetch('/api/redis/get?key=latest_launches');
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            console.error('Invalid or empty launches data');
            return false;
        }
        
        // Reverse the array so newest launches come first
        launches = data.reverse();
        currentLaunchIndex = 0;
        console.log('Latest launches:', launches);

        // Fetch all token data at once
        const currentData = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: "spotMetaAndAssetCtxs" })
        }).then(r => r.json());

        // Cache all token data
        const now = Date.now();
        launches.forEach(launch => {
            const tokenData = currentData[1].find(t => t.coin === launch.fullName);
            if (tokenData) {
                tokenDataCache.set(launch.fullName, tokenData);
                tokenDataCache.set(launch.fullName + '_time', now);
            }
        });

        // Update UI with initial launch
        await updateLatestLaunch(launches[currentLaunchIndex]);
        updateNavigationState(); // Add this line to update navigation state right after loading
        return true;
    } catch (error) {
        console.error('Error preloading launch data:', error);
        return false;
    }
} 