// Import TOKENS from the JavaScript file
import { TOKENS } from '/app/types/tokens.js';

// Make TOKENS and currentToken available globally
window.TOKENS = TOKENS;
window.currentToken = 'HYPE';  // Default token

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Set initial descriptions for HYPE token
    const token = TOKENS[window.currentToken];
    document.getElementById('desc1').textContent = token.desc1;
    document.getElementById('desc2').textContent = token.desc2;

    // Show tab indicator under Airdrops by default
    const airdropsTab = document.querySelector('span.text-sm[onclick*="selectTab"][onclick*="airdrops"]');
    if (airdropsTab) {
        airdropsTab.classList.remove('text-[rgb(148,158,156)]');
        airdropsTab.classList.add('text-white');
        const indicator = airdropsTab.querySelector('.tab-indicator');
        if (indicator) {
            indicator.style.display = 'block';
        }
    }

    // Initialize About tab as selected
    const aboutTab = document.querySelector('span[onclick*="selectTab"][onclick*="about"]');
    if (aboutTab) {
        aboutTab.classList.remove('text-[rgb(148,158,156)]');
        aboutTab.classList.add('text-white');
        const indicator = aboutTab.querySelector('.tab-indicator');
        if (indicator) {
            indicator.style.display = 'block';
        }
    }

    // Start fetching price data
    updatePriceData();
});

// Format numbers with dots for thousands
function formatNumberWithDots(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Format numbers with appropriate suffixes
function formatNumber(num, useFullInteger = false) {
    if (useFullInteger) return formatNumberWithDots(Math.round(num));
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(1);
}

// Check if cache is valid (less than 5 minutes old)
function isCacheValid(timestamp) {
    return timestamp && (Date.now() - timestamp) < 5 * 60 * 1000;
}

// Fetch all token prices
async function fetchAllPrices() {
    try {
        const response = await fetch('https://api.hyperliquid.xyz/info');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        const prices = {};
        data.assetInfos.forEach(asset => {
            prices[asset.name] = parseFloat(asset.oraclePrice);
        });
        
        return prices;
    } catch (error) {
        console.error('Error fetching prices:', error);
        return null;
    }
}

// Update price data
async function updatePriceData() {
    const prices = await fetchAllPrices();
    if (!prices) return;

    // Calculate metrics for the current token
    const metrics = calculateMetrics(prices);
    
    // Update UI with new metrics
    updateUIWithMetrics(metrics);
    
    // Update performance ranking
    updatePerformanceRanking(prices);
    
    // Schedule next update
    setTimeout(updatePriceData, 5000);
}

// Calculate metrics for the current token
function calculateMetrics(prices) {
    const token = TOKENS[window.currentToken];
    if (!token || !prices[token.ticker]) return null;

    const currentPrice = prices[token.ticker];
    const marketCap = currentPrice * token.supply;
    const performanceSinceTGE = ((currentPrice - token.tgePrice) / token.tgePrice) * 100;
    const multiplier = Math.floor(currentPrice / token.tgePrice);

    return {
        marketCap,
        performanceSinceTGE,
        multiplier
    };
}

// Update UI with metrics
function updateUIWithMetrics(metrics) {
    if (!metrics) return;

    // Update market cap
    const marketCapElement = document.querySelector('.market-cap');
    if (marketCapElement) {
        marketCapElement.textContent = '$' + formatNumberWithDots(Math.round(metrics.marketCap));
    }

    // Update performance
    const performanceElement = document.querySelector('.performance');
    if (performanceElement) {
        performanceElement.textContent = metrics.performanceSinceTGE.toFixed(1) + '%';
    }

    // Update multiplier
    const multiplierElement = document.querySelector('.multiplier');
    if (multiplierElement) {
        multiplierElement.textContent = metrics.multiplier + 'x';
    }
}

// Update performance ranking
function updatePerformanceRanking(prices) {
    const rankingContainer = document.querySelector('.performance-ranking');
    if (!rankingContainer) return;

    // Clear existing content
    rankingContainer.innerHTML = '';

    // Create ranking items
    Object.entries(TOKENS)
        .filter(([_, token]) => token.type === 'airdrop' && prices[token.ticker])
        .sort((a, b) => {
            const aValue = prices[a[1].ticker] * a[1].supply;
            const bValue = prices[b[1].ticker] * b[1].supply;
            return bValue - aValue;
        })
        .forEach(([symbol, token]) => {
            const currentPrice = prices[token.ticker];
            const marketCap = currentPrice * token.supply;
            const performance = ((currentPrice - token.tgePrice) / token.tgePrice) * 100;

            const div = document.createElement('div');
            div.className = 'flex-shrink-0 w-32 p-2 bg-[#0a2622] rounded-lg cursor-pointer hover:bg-[#0f1a1f] transition-colors';
            div.innerHTML = `
                <div class="flex items-center gap-2 mb-2">
                    <img src="/assets/Logos/${symbol}.png" alt="${symbol}" class="w-6 h-6 rounded-full">
                    <span class="text-xs">${symbol}</span>
                </div>
                <div class="text-xs text-[rgb(148,158,156)]">Market Cap</div>
                <div class="text-sm">$${formatNumber(marketCap)}</div>
                <div class="text-xs text-[rgb(148,158,156)] mt-2">Performance</div>
                <div class="text-sm ${performance >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                    ${performance.toFixed(1)}%
                </div>
            `;
            rankingContainer.appendChild(div);
        });
}

// Select token icon
window.selectIcon = function(element) {
    // Remove selected class from all icons
    document.querySelectorAll('.airdrop-icon').forEach(icon => {
        icon.classList.remove('selected');
    });
    
    // Add selected class to clicked icon
    element.classList.add('selected');
    
    // Update current token
    window.currentToken = element.alt;
    
    // Update token info
    const token = TOKENS[window.currentToken];
    document.getElementById('desc1').textContent = token.desc1;
    document.getElementById('desc2').textContent = token.desc2;
    
    // Update price data
    updatePriceData();
};

// Select tab
window.selectTab = function(element, tabName) {
    // Get the parent container to determine which tab group we're in
    const isAirdropsContainer = element.closest('.flex').parentElement.parentElement.classList.contains('airdrops-box');
    
    if (isAirdropsContainer) {
        // Airdrops tab should always be active
        element.classList.remove('text-[rgb(148,158,156)]');
        element.classList.add('text-white');
        const indicator = element.querySelector('.tab-indicator');
        if (indicator) {
            indicator.style.display = 'block';
        }
        return; // Exit early for Airdrops tab
    }
    
    // Handle About/Bag Fumbled tabs
    const aboutBagGroup = element.closest('.flex');
    aboutBagGroup.querySelectorAll('span').forEach(tab => {
        tab.classList.remove('text-white');
        tab.classList.add('text-[rgb(148,158,156)]');
        const indicator = tab.querySelector('.tab-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    });
    
    // Add active state to selected tab
    element.classList.remove('text-[rgb(148,158,156)]');
    element.classList.add('text-white');
    const indicator = element.querySelector('.tab-indicator');
    if (indicator) {
        indicator.style.display = 'block';
    }
    
    // Only toggle About/Bag Fumbled content
    if (tabName === 'about' || tabName === 'bagFumbled') {
        const contents = {
            'about': document.getElementById('about-content'),
            'bagFumbled': document.getElementById('bagFumbled-content')
        };
        
        Object.entries(contents).forEach(([name, content]) => {
            if (content) {
                content.style.display = name === tabName ? 'block' : 'none';
            }
        });
    }
}; 