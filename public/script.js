// Import TOKENS from the JavaScript file
import { TOKENS } from '/app/types/tokens.js';

// Make TOKENS and currentToken available globally
window.TOKENS = TOKENS;
window.currentToken = 'HYPE';  // Default token
let currentTimeRange = '7D';
let isLogoVisible = true;
let tweetRoot = null;
let isRefreshAnimating = false;

// Initialize descriptions when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Set initial descriptions for HYPE token
    const token = TOKENS[window.currentToken];
    document.getElementById('desc1').textContent = token.desc1;
    document.getElementById('desc2').textContent = token.desc2;

    // Initialize Size as selected
    const sizeSpan = document.querySelector('[data-sort="size"]');
    if (sizeSpan) {
        sizeSpan.classList.remove('text-[rgb(148,158,156)]');
        sizeSpan.classList.add('text-white');
    }

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

    const glasses = document.getElementById('glasses');
    const intro = document.getElementById('intro');
    const mainContent = document.getElementById('main-content');
    const dynamicText = document.getElementById('dynamic-text');
    const volumeControl = document.querySelector('.volume-control');
    const buttonContainer = document.querySelector('.button-container');
    const glassesBlur = document.querySelector('.glasses-blur');
    const centerLogo = document.querySelector('.center-logo');
    
    const RADIUS = 200;
    const MAX_MOVEMENT = 45;

    // Audio setup
    const audio = new Audio('assets/song.mp3');
    audio.loop = true;
    audio.volume = 0.1; // Start at 10%

    // Check if device is mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Single click handler for centerLogo
    if (centerLogo) {
        centerLogo.addEventListener('click', () => {
            createRandomFist(false);
        });
    }

    const fadeInAudio = () => {
        // Don't play audio on mobile
        if (isMobile) return;

        let currentVolume = 0.1;
        const targetVolume = 1.0;
        const steps = 50;
        const timeInterval = 3000 / steps;
        const volumeIncrease = (targetVolume - currentVolume) / steps;

        const fadeInterval = setInterval(() => {
            currentVolume = Math.min(targetVolume, currentVolume + volumeIncrease);
            audio.volume = currentVolume;

            if (currentVolume >= targetVolume) {
                clearInterval(fadeInterval);
            }
        }, timeInterval);
    };

    const words = [
        'Hyperliquid',
        'Outwork',
        'Outperform',
        'Flip',
        'Buy',
        'Mog',
        'Moon',
        'Degen',
        'Ape',
        'Pump',
        'Grind',
        'Wagmi',
        'Vibe'
    ];

    // Create initial typed instances with just the cursor for both desktop and mobile
    let typed = new Typed('#dynamic-text', {
        strings: [''],
        typeSpeed: 0,
        showCursor: true,
        cursorChar: '|',
        loop: false,
        autoInsertCss: true,
        contentType: 'text',
        position: 'relative'
    });

    let typedMobile = new Typed('#dynamic-text-mobile', {
        strings: [''],
        typeSpeed: 0,
        showCursor: true,
        cursorChar: '|',
        loop: false,
        autoInsertCss: true,
        contentType: 'text',
        position: 'relative'
    });

    const startAnimation = () => {
        typed.destroy();
        typedMobile.destroy();

        typed = new Typed('#dynamic-text', {
            strings: words,
            typeSpeed: 100,
            backSpeed: 50,
            startDelay: 0,
            backDelay: 1500,
            loop: true,
            showCursor: true,
            cursorChar: '|',
            autoInsertCss: true,
            contentType: 'text',
            position: 'relative'
        });

        typedMobile = new Typed('#dynamic-text-mobile', {
            strings: words,
            typeSpeed: 100,
            backSpeed: 50,
            startDelay: 0,
            backDelay: 1500,
            loop: true,
            showCursor: true,
            cursorChar: '|',
            autoInsertCss: true,
            contentType: 'text',
            position: 'relative'
        });
    };

    // Initially hide the blur
    glassesBlur.style.opacity = '0';

    // Handle mouse movement for glasses
    document.addEventListener('mousemove', (e) => {
        const glassesRect = glasses.getBoundingClientRect();
        const glassesCenter = {
            x: glassesRect.left + glassesRect.width / 2,
            y: glassesRect.top + glassesRect.height / 2
        };

        const distance = Math.hypot(
            e.clientX - glassesCenter.x,
            e.clientY - glassesCenter.y
        );

        if (distance < RADIUS) {
            const pull = (RADIUS - distance) / RADIUS;
            const moveX = (e.clientX - glassesCenter.x) * pull * (MAX_MOVEMENT / RADIUS);
            const moveY = (e.clientY - glassesCenter.y) * pull * (MAX_MOVEMENT / RADIUS);
            
            // Show and move both glasses and blur
            glassesBlur.style.opacity = '0.5';
            const transform = `translate(${moveX}px, ${moveY}px)`;
            glasses.style.transform = transform;
            glassesBlur.style.transform = transform;

            // Update blur intensity based on proximity
            const blurIntensity = Math.max(7.5, 22.5 - (distance / RADIUS) * 15);
            glassesBlur.style.filter = `blur(${blurIntensity}px)`;
        } else {
            glasses.style.transform = 'translate(0, 0)';
        }
    });

    // Handle click to transition
    glasses.addEventListener('click', () => {
        intro.classList.add('hidden');
        mainContent.classList.add('visible');
        startAnimation();
        
        // Show buttons after 1 second
        setTimeout(() => {
            buttonContainer.classList.add('visible');
        }, 1000);

        // Show volume control after 1.5 seconds, but only on desktop
        if (!isMobile) {
            setTimeout(() => {
                volumeControl.classList.add('visible');
            }, 1500);

            // Start audio with fade in (only on desktop)
            audio.play();
            fadeInAudio();
        }
    });

    // Volume control logic
    const volumeIcon = document.querySelector('.volume-icon');
    const updateVolumeIcon = (volume) => {
        const waves = volumeIcon.querySelectorAll('.wave');
        if (volume === 0) {
            // Hide both waves if muted
            waves.forEach((wave) => (wave.style.display = 'none'));
        } else {
            // Show both waves if volume > 0 (always "full" icon visually)
            waves.forEach((wave) => (wave.style.display = 'block'));
        }
    };

    // Initialize icon state
    updateVolumeIcon(audio.volume);

    // Toggle mute on icon click
    volumeIcon.addEventListener('click', () => {
        if (audio.volume > 0) {
            audio.volume = 0;
        } else {
            audio.volume = 0.5;
        }
        updateVolumeIcon(audio.volume);
    });

    // Add these new configurations
    const FIST_CONFIG = {
        fistSize: {
            min: 40,  // Original size for fist.png
            max: 100  // Original size for fist.png
        },
        stickerSize: {
            min: 78,    // Increased by 30% from 60
            max: 156    // Increased by 30% from 120
        },
        minRotation: -45,
        maxRotation: 45,
        fistProbability: 0.8,  // Keeping the updated probability
        safeZone: {
            width: 800,
            height: 600
        }
    };

    const stickers = [
        'assets/Sticker/1.png',
        'assets/Sticker/2.png',
        'assets/Sticker/3.png',
        'assets/Sticker/4.png',
        'assets/Sticker/5.png',
        'assets/Sticker/6.png'
    ];

    function getRandomNumber(min, max) {
        return Math.random() * (max - min) + min;
    }

    function getRandomSticker() {
        const randomIndex = Math.floor(Math.random() * stickers.length);
        return stickers[randomIndex];
    }

    let fistQueue = [];
    let cleanupTimeout;
    const CLEANUP_DELAY = 625; // Wait time after last fist placed
    const CLEANUP_DURATION = 2000; // Time window for all fists to disappear

    // Add these configurations after the FIST_CONFIG
    const SAFE_ZONES = {
        logo: {
            x: window.innerWidth / 2 - 90,
            y: window.innerHeight / 2 - 90,
            width: 180,
            height: 180
        },
        dynamicText: {
            x: window.innerWidth / 2 - 400,
            y: window.innerHeight / 2 - 50,
            width: 200,
            height: 100
        },
        staticText: {
            x: window.innerWidth / 2 + 200,
            y: window.innerHeight / 2 - 50,
            width: 200,
            height: 100
        },
        buttons: {
            x: window.innerWidth / 2 - 200,  // Wider area
            y: window.innerHeight / 2 + 100,  // Higher up
            width: 400,  // Increased width
            height: 100  // Increased height
        }
    };

    // Add this function to check if a position is safe
    function isPositionSafe(x, y, elementSize) {
        // Check each safe zone
        for (const zone of Object.values(SAFE_ZONES)) {
            // Check if the element overlaps with this zone
            const overlaps = !(
                x + elementSize < zone.x ||    // Element is left of zone
                x > zone.x + zone.width ||     // Element is right of zone
                y + elementSize < zone.y ||    // Element is above zone
                y > zone.y + zone.height       // Element is below zone
            );
            
            if (overlaps) return false;
        }
        return true;
    }

    // Add this function to get a safe random position
    function getSafeRandomPosition(size) {
        let x, y;
        let attempts = 0;
        const maxAttempts = 50;  // Prevent infinite loops

        do {
            x = getRandomNumber(0, window.innerWidth - size);
            y = getRandomNumber(0, window.innerHeight - size);
            attempts++;
        } while (!isPositionSafe(x, y, size) && attempts < maxAttempts);

        // If we couldn't find a safe spot after max attempts, use the last generated position
        return { x, y };
    }

    // Update the createRandomFist function to use safe positions
    function createRandomFist(skipLogoAnimation = false) {
        // Logo click animation only if not skipped
        if (!skipLogoAnimation) {
            centerLogo.style.transform = 'scale(0.95)';
            setTimeout(() => {
                centerLogo.style.transform = 'scale(1)';
            }, 150);
        }

        const element = document.createElement('img');
        
        const isFist = Math.random() < FIST_CONFIG.fistProbability;
        element.src = isFist ? 'assets/fist.png' : getRandomSticker();
        element.className = 'fist';
        
        const sizeRange = isFist ? FIST_CONFIG.fistSize : FIST_CONFIG.stickerSize;
        const size = getRandomNumber(sizeRange.min, sizeRange.max);
        
        // Use safe position instead of completely random
        const position = getSafeRandomPosition(size);
        
        element.style.width = `${size}px`;
        element.style.left = `${position.x}px`;
        element.style.top = `${position.y}px`;
        
        // Add error handling for images
        element.onerror = () => {
            console.error(`Failed to load image: ${element.src}`);
            element.remove();  // Remove the element if image fails to load
            fistQueue = fistQueue.filter(item => item !== element);
        };
        
        // Random rotation
        const rotation = getRandomNumber(FIST_CONFIG.minRotation, FIST_CONFIG.maxRotation);
        element.style.transform = `rotate(${rotation}deg)`;
        
        document.body.appendChild(element);
        setTimeout(() => {
            element.classList.add('visible');
        }, 50);

        // Rest of the function remains the same...
        fistQueue.push(element);

        if (cleanupTimeout) {
            clearTimeout(cleanupTimeout);
        }

        cleanupTimeout = setTimeout(() => {
            const totalElements = fistQueue.length;
            if (totalElements === 0) return;

            const intervalBetweenElements = CLEANUP_DURATION / totalElements;

            fistQueue.forEach((element, index) => {
                setTimeout(() => {
                    element.style.opacity = '0';
                    setTimeout(() => element.remove(), 300);
                }, intervalBetweenElements * index);
            });

            fistQueue = [];
        }, CLEANUP_DELAY);
    }

    // Add this event listener
    window.addEventListener('resize', () => {
        // Update safe zones based on new window size
        SAFE_ZONES.logo.x = window.innerWidth / 2 - 90;
        SAFE_ZONES.logo.y = window.innerHeight / 2 - 90;
        SAFE_ZONES.dynamicText.x = window.innerWidth / 2 - 400;
        SAFE_ZONES.dynamicText.y = window.innerHeight / 2 - 50;
        SAFE_ZONES.staticText.x = window.innerWidth / 2 + 200;
        SAFE_ZONES.staticText.y = window.innerHeight / 2 - 50;
        SAFE_ZONES.buttons.x = window.innerWidth / 2 - 200;  // Updated
        SAFE_ZONES.buttons.y = window.innerHeight / 2 + 100;  // Updated
    });

    // Add this new function
    function handleMogCounterClick(event) {
        const mogImage = event.currentTarget;
        
        if (mogImage.classList.contains('laughing')) return;
        
        mogImage.classList.add('laughing');
        
        let speechBubble = document.querySelector('.speech-bubble');
        if (!speechBubble) {
            speechBubble = document.createElement('div');
            speechBubble.className = 'speech-bubble';
            speechBubble.textContent = 'lol';
            document.body.appendChild(speechBubble);
        }
        
        const rect = mogImage.getBoundingClientRect();
        speechBubble.style.left = `${rect.left + (rect.width / 2) - 15}px`;
        speechBubble.style.top = `${rect.top + rect.height - 5}px`;
        
        speechBubble.classList.add('visible');
        
        setTimeout(() => {
            mogImage.classList.remove('laughing');
            speechBubble.classList.remove('visible');
        }, 400);
    }

    // Update the selector to match your HTML structure
    const mogCounterImage = document.getElementById('mogCounter');
    if (mogCounterImage) {
        mogCounterImage.style.cursor = 'pointer';
        mogCounterImage.addEventListener('click', handleMogCounterClick);
    }

    // Constants for price fetching
    const CACHE_KEY = 'bulk_price_data';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    // Helper function to format numbers with dots
    function formatNumberWithDots(num) {
        return num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    // Helper function to format large numbers
    function formatNumber(num, useFullInteger = false) {
        if (useFullInteger) {
            return formatNumberWithDots(num);
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
    }

    // Helper function to check if cache is valid
    function isCacheValid(timestamp) {
        return Date.now() - timestamp < CACHE_DURATION;
    }

    // Function to fetch all token prices at once
    async function fetchAllPrices() {
        try {
            // Check cache first
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { prices, timestamp } = JSON.parse(cached);
                if (isCacheValid(timestamp)) {
                    return prices;
                }
            }

            // Fetch all prices in one call
            const tokenIds = Object.values(TOKENS).map(token => token.coingeckoId);
            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds.join(',')}&vs_currencies=usd`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to fetch prices from CoinGecko');
            }
            
            const data = await response.json();
            
            // Transform data into our format
            const prices = {};
            Object.entries(TOKENS).forEach(([symbol, token]) => {
                const price = data[token.coingeckoId]?.usd;
                prices[symbol] = price || token.initialPrice;
            });

            // Cache the prices
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                prices,
                timestamp: Date.now()
            }));

            return prices;
        } catch (error) {
            console.error('Error fetching from CoinGecko:', error);
            
            try {
                // Try to fetch latest prices from Redis through our API
                const fallbackPrices = {};
                const tokens = Object.keys(TOKENS);
                
                for (const symbol of tokens) {
                    try {
                        // Fetch the most recent price data from Redis (24H timeframe)
                        const response = await fetch(`/api/price-data?timeRange=24H&token=${symbol}`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.prices && data.prices.length > 0) {
                                // Get the most recent price
                                const latestPrice = data.prices[data.prices.length - 1][1];
                                fallbackPrices[symbol] = latestPrice;
                                continue;
                            }
                        }
                    } catch (redisError) {
                        console.error(`Failed to fetch Redis price for ${symbol}:`, redisError);
                    }
                    
                    // If Redis fails or no data, use initial price
                    fallbackPrices[symbol] = TOKENS[symbol].initialPrice;
                }
                
                // Cache the fallback prices
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    prices: fallbackPrices,
                    timestamp: Date.now()
                }));
                
                return fallbackPrices;
            } catch (fallbackError) {
                console.error('Failed to fetch fallback prices:', fallbackError);
                // Last resort: return initial prices
                return Object.entries(TOKENS).reduce((acc, [symbol, token]) => {
                    acc[symbol] = token.initialPrice;
                    return acc;
                }, {});
            }
        }
    }

    // Update the UI update function to use bulk prices
    async function updatePriceData() {
        try {
            const prices = await fetchAllPrices();
            const currentPrice = prices[window.currentToken];
            if (!currentPrice) return;

            const token = TOKENS[window.currentToken];
            
            // Calculate values using token-specific data
            const metrics = {
                performancePercent: ((currentPrice - token.initialPrice) / token.initialPrice) * 100,
                multiplier: currentPrice / token.initialPrice,
                marketCap: currentPrice * token.supply,
                airdropValue: currentPrice * token.airdropAmount
            };

            // Update UI with the metrics
            updateUIWithMetrics(metrics);

        } catch (error) {
            console.error('Error in updatePriceData:', error);
        }
    }

    // Helper function to update UI elements
    function updateUIWithMetrics(metrics) {
        const elements = {
            marketCap: document.querySelector('.market-cap'),
            performance: document.querySelector('.performance'),
            multiplier: document.querySelector('.multiplier'),
            airdropValue: document.querySelector('.text-xl.airdrop-value'),
            mogCounter: document.querySelector('#mogCounter'),
            mogCounterValue: document.querySelector('#mogCounter + span')
        };

        if (elements.marketCap) elements.marketCap.textContent = `$${formatNumber(metrics.marketCap, true)}`;
        if (elements.performance) elements.performance.textContent = `${Math.round(metrics.performancePercent)}%`;
        if (elements.multiplier) elements.multiplier.textContent = `${metrics.multiplier.toFixed(1)}x`;
        if (elements.airdropValue) elements.airdropValue.textContent = `$${formatNumber(metrics.airdropValue, true)}`;

        // Calculate how many airdrops are worth less than the current one
        const currentAirdropValue = metrics.airdropValue;
        let moggedCount = 0;

        // Get all prices from the latest bulk fetch
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { prices } = JSON.parse(cached);
            
            // Compare current airdrop value with all other airdrops
            Object.entries(TOKENS).forEach(([symbol, token]) => {
                if (symbol !== window.currentToken) {
                    const otherPrice = prices[symbol];
                    const otherAirdropValue = otherPrice * token.airdropAmount;
                    if (otherAirdropValue < currentAirdropValue) {
                        moggedCount++;
                    }
                }
            });

            // Update performance ranking list
            updatePerformanceRanking(prices);
        }

        // Update the Mog Counter with the number of airdrops worth less
        if (elements.mogCounterValue) {
            elements.mogCounterValue.textContent = moggedCount;
        }

        // Update the Mog Counter image based on count
        if (elements.mogCounter) {
            elements.mogCounter.src = moggedCount === 0 ? 'assets/skull.webp' : 'assets/lol.png';
            // Scale down the skull image when it appears
            elements.mogCounter.style.transform = moggedCount === 0 ? 'scale(0.75)' : '';
        }
    }

    // Add current sort order state
    let currentSortOrder = 'size';

    // Function to update ranking order
    window.updateRankingOrder = function(sortType) {
        currentSortOrder = sortType;
        
        // Update text colors
        document.querySelectorAll('[data-sort]').forEach(span => {
            if (span.getAttribute('data-sort') === sortType) {
                span.classList.remove('text-[rgb(148,158,156)]');
                span.classList.add('text-white');
            } else {
                span.classList.add('text-[rgb(148,158,156)]');
                span.classList.remove('text-white');
            }
        });

        // Trigger ranking update
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { prices } = JSON.parse(cached);
            updatePerformanceRanking(prices);
        }
    };

    // Add CSS for styling - Move this outside the updatePerformanceRanking function
    const rankingStyle = document.createElement('style');
    rankingStyle.textContent = `
        .performance-ranking {
            position: relative;
            width: 100%;
            display: flex;
            align-items: center;
            gap: 16px;
            overflow-x: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
            scroll-behavior: smooth;
            padding: 0 12px;
        }
        .performance-ranking::-webkit-scrollbar {
            display: none;
        }
        .nav-arrow {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(16, 25, 31, 0.8);
            color: rgb(148, 158, 156);
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 12px;
            z-index: 10;
            font-size: 18px;
            transition: color 0.2s;
        }
        .nav-arrow:hover {
            color: #10B981;
        }
        .nav-arrow.prev {
            left: -12px;
        }
        .nav-arrow.next {
            right: -12px;
        }
        .icon-container {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin: 0 8px;
            position: relative;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
            border-radius: 50%;
            overflow: hidden;
        }
        .icon-container img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
            pointer-events: none;
            user-select: none;
            display: block;
        }
        .icon-container.selected {
            outline: 2px solid #10B981;
            outline-offset: 2px;
        }
        .separator-container {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin: 0 4px;
            height: 40px;
            pointer-events: none;
            user-select: none;
            color: rgb(148, 158, 156);
            opacity: 0.5;
            font-size: 14px;
        }
    `;
    document.head.appendChild(rankingStyle);

    function updatePerformanceRanking(prices) {
        // Calculate metrics for all tokens
        const tokenMetrics = Object.entries(TOKENS).map(([symbol, token]) => {
            const currentPrice = prices[symbol];
            const performancePercent = ((currentPrice - token.initialPrice) / token.initialPrice) * 100;
            const airdropValue = currentPrice * token.airdropAmount;
            return {
                symbol,
                performance: performancePercent,
                multiplier: currentPrice / token.initialPrice,
                size: airdropValue
            };
        });

        // Sort based on current sort order
        if (currentSortOrder === 'size') {
            tokenMetrics.sort((a, b) => b.size - a.size);
        } else {
            tokenMetrics.sort((a, b) => b.performance - a.performance);
        }

        // Get the ranking container
        const rankingContainer = document.querySelector('.performance-ranking');
        if (!rankingContainer) return;

        // Clear existing content
        rankingContainer.innerHTML = '';

        // Create and append tokens
        tokenMetrics.forEach((token, index) => {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'icon-container';
            if (token.symbol === window.currentToken) {
                iconDiv.className += ' selected';
            }
            iconDiv.title = `${token.performance.toFixed(1)}% (${token.multiplier.toFixed(1)}x)`;

            const img = document.createElement('img');
            img.alt = token.symbol;
            img.draggable = false;

            const specialCases = {
                'PENGU': 'assets/Logos/Pengu.jpeg',
                'HYPE': 'assets/Logos/Hype.png',
                'ARB': 'assets/Logos/Arbitrum.png',
                'FRIEND': 'assets/Logos/Friend.png',
                'JTO': 'assets/Logos/Jito.png',
                'ME': 'assets/Logos/MagicalEden.png',
                'UNI': 'assets/Logos/Uniswap.png',
                'TIA': 'assets/Logos/TIA.png',
                'ENS': 'assets/Logos/ENS.png',
                'JUP': 'assets/Logos/JUP.png',
                'WEN': 'assets/Logos/WEN.png',
                'AEVO': 'assets/Logos/AEVO.png',
                'ENA': 'assets/Logos/ENA.png',
                'W': 'assets/Logos/W.png',
                'ETHFI': 'assets/Logos/ETHFI.png',
                'ZRO': 'assets/Logos/ZRO.png',
                'STRK': 'assets/Logos/STRK.png',
                'EIGEN': 'assets/Logos/EIGEN.png',
                'DBR': 'assets/Logos/DBR.png'
            };

            img.src = specialCases[token.symbol] || `assets/Logos/${token.symbol}.png`;
            
            // Add click handler
            iconDiv.addEventListener('click', () => {
                // Update all airdrop icons
                document.querySelectorAll('.airdrop-icon').forEach(icon => {
                    icon.classList.remove('selected');
                    if (icon.alt === token.symbol) {
                        icon.classList.add('selected');
                    }
                });
                
                // Update all performance ranking icons
                document.querySelectorAll('.performance-ranking .icon-container').forEach(icon => {
                    icon.classList.remove('selected');
                });
                iconDiv.classList.add('selected');
                
                // Call the existing selectIcon function
                const airdropIcon = document.querySelector(`.airdrop-icon[alt="${token.symbol}"]`);
                if (airdropIcon) {
                    window.selectIcon(airdropIcon);
                }
            });

            iconDiv.appendChild(img);
            rankingContainer.appendChild(iconDiv);

            if (index < tokenMetrics.length - 1) {
                const separatorDiv = document.createElement('div');
                separatorDiv.className = 'separator-container';
                separatorDiv.textContent = '>';
                rankingContainer.appendChild(separatorDiv);
            }
        });

        // Create navigation arrows
        const prevArrow = document.createElement('div');
        prevArrow.className = 'nav-arrow prev';
        prevArrow.innerHTML = '‹';
        prevArrow.onclick = () => {
            rankingContainer.scrollTo({ left: 0, behavior: 'smooth' });
        };

        const nextArrow = document.createElement('div');
        nextArrow.className = 'nav-arrow next';
        nextArrow.innerHTML = '›';
        nextArrow.onclick = () => {
            rankingContainer.scrollTo({ 
                left: rankingContainer.scrollWidth - rankingContainer.clientWidth,
                behavior: 'smooth'
            });
        };

        // Add navigation arrows
        rankingContainer.parentNode.appendChild(prevArrow);
        rankingContainer.parentNode.appendChild(nextArrow);

        // Show/hide arrows based on scroll position
        const updateArrows = () => {
            prevArrow.style.display = rankingContainer.scrollLeft > 0 ? 'flex' : 'none';
            nextArrow.style.display = 
                rankingContainer.scrollLeft < (rankingContainer.scrollWidth - rankingContainer.clientWidth - 10) 
                ? 'flex' : 'none';
        };

        rankingContainer.addEventListener('scroll', updateArrows);
        window.addEventListener('resize', updateArrows);
        updateArrows(); // Initial check
    }

    // Function to clear all caches for a token
    window.clearTokenCache = function() {
        // Clear bulk price cache
        localStorage.removeItem(CACHE_KEY);
        
        // Clear graph data cache (this will be handled by chart.js)
        if (window.clearChartCache) {
            window.clearChartCache();
        }
    };

    // Make updatePriceData available globally
    window.updatePriceData = updatePriceData;

    // Update prices periodically
    setInterval(updatePriceData, 60000); // Update every minute
    updatePriceData(); // Initial update

    // Add this to your DOMContentLoaded event listener
    const moggedType = document.getElementById('mogged-type');
    if (moggedType) {
        const MOGGED_MARGIN = 16; // Easily adjust the margin size here
        
        // Function to calculate text width
        const getTextWidth = (text) => {
            const tempSpan = document.createElement('span');
            tempSpan.className = 'text-5xl';
            tempSpan.style.visibility = 'hidden';
            tempSpan.style.position = 'absolute';
            tempSpan.textContent = text;
            document.body.appendChild(tempSpan);
            const width = tempSpan.offsetWidth;
            document.body.removeChild(tempSpan);
            return width;
        };

        // Function to adjust width based on selected text
        const adjustSelectWidth = () => {
            const selectedOption = moggedType.options[moggedType.selectedIndex];
            const textWidth = getTextWidth(selectedOption.text);
            moggedType.style.width = `${textWidth + (MOGGED_MARGIN * 2)}px`; // Text width plus consistent margins
        };

        // Adjust width on load and change
        adjustSelectWidth();
        moggedType.addEventListener('change', adjustSelectWidth);
    }

    intro.addEventListener('click', () => {
        intro.classList.remove('active');
        mainContent.classList.add('visible');
    });

    function updateTokenInfo(token) {
        const tokenData = TOKENS[token];
        if (!tokenData) return;

        // Update descriptions
        document.getElementById('desc1').textContent = tokenData.desc1;
        document.getElementById('desc2').textContent = tokenData.desc2;

        // Update other token info
        document.querySelector('.market-cap').textContent = `$${formatNumber(tokenData.initialPrice * tokenData.supply, true)}`;
        document.querySelector('.airdrop-value').textContent = `$${formatNumber(currentPrice * tokenData.airdropAmount, true)}`;
    }

    // Add refresh button functionality
    const refreshButton = document.getElementById('refresh-category');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            if (!isTyping) {
                currentCategoryIndex = (currentCategoryIndex + 1) % CATEGORIES.length;
            }
        });
    }

    // Handle category selection
    const categorySelect = document.getElementById('category-select');
    if (categorySelect) {
        categorySelect.addEventListener('change', function() {
            // You can add any additional handling here when category changes
            console.log('Selected category:', this.value);
        });
    }

    // Add this function to handle tab switching
    window.selectTab = function(element, tabName) {
        // Get the About and Bags Fumbled tabs
        const aboutTab = document.querySelector('span[onclick*="selectTab"][onclick*="about"]');
        const bagsFumbledTab = document.querySelector('span[onclick*="selectTab"][onclick*="bagFumbled"]');
        
        // Reset both tabs
        [aboutTab, bagsFumbledTab].forEach(tab => {
            if (tab) {
                tab.classList.remove('text-white');
                tab.classList.add('text-[rgb(148,158,156)]');
                const indicator = tab.querySelector('.tab-indicator');
                if (indicator) {
                    indicator.style.display = 'none';
                }
            }
        });
        
        // Highlight the clicked tab
        element.classList.remove('text-[rgb(148,158,156)]');
        element.classList.add('text-white');
        const indicator = element.querySelector('.tab-indicator');
        if (indicator) {
            indicator.style.display = 'block';
        }
        
        // Handle content display
        const mainContentArea = element.closest('.border-b').nextElementSibling;
        if (!mainContentArea) return;
        
        mainContentArea.style.display = 'flex';
        const leftColumn = mainContentArea.querySelector('.content-left');
        const rightColumn = mainContentArea.querySelector('.content-right');
        const bagFumbledContent = mainContentArea.querySelector('.bag-fumbled-content');
        
        if (tabName === 'about') {
            // Show About content
            if (leftColumn) leftColumn.style.display = 'block';
            if (rightColumn) rightColumn.style.display = 'block';
            if (bagFumbledContent) bagFumbledContent.style.display = 'none';
            
            // Remove refresh button if it exists
            const refreshButton = document.querySelector('.refresh-button');
            if (refreshButton) refreshButton.remove();
        } else if (tabName === 'bagFumbled') {
            // Show Bags Fumbled content
            if (leftColumn) leftColumn.style.display = 'none';
            if (rightColumn) rightColumn.style.display = 'none';
            
            // Create or show bag fumbled content
            if (!bagFumbledContent) {
                const newContent = document.createElement('div');
                newContent.className = 'bag-fumbled-content w-full';
                newContent.id = 'tweet-list-container';
                mainContentArea.appendChild(newContent);
                tweetRoot = ReactDOM.createRoot(newContent);
            } else {
                bagFumbledContent.style.display = 'block';
            }
            
            // Add refresh button
            let refreshButton = document.querySelector('.refresh-button');
            if (!refreshButton) {
                refreshButton = document.createElement('div');
                refreshButton.className = 'refresh-button inline-flex items-center ml-2';
                refreshButton.innerHTML = `
                    <svg class="w-3 h-3 text-[rgb(148,158,156)] hover:text-emerald-400 cursor-pointer transition-all duration-200" 
                         viewBox="0 0 24 24" 
                         fill="none" 
                         stroke="currentColor" 
                         stroke-width="2" 
                         stroke-linecap="round" 
                         stroke-linejoin="round">
                        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                `;
                refreshButton.onclick = (e) => {
                    const target = e.target.closest('svg');
                    if (!target || isRefreshAnimating) return;
                    
                    isRefreshAnimating = true;
                    const svg = target;
                    svg.style.transform = 'rotate(360deg)';
                    svg.style.transition = 'transform 0.5s ease';
                    
                    // Call the refresh function
                    window.refreshTweet();
                    
                    setTimeout(() => {
                        svg.style.transform = 'rotate(0deg)';
                        setTimeout(() => {
                            svg.style.transition = 'none';
                            isRefreshAnimating = false;
                        }, 50);
                    }, 500);
                };
                element.appendChild(refreshButton);
            }
            
            // Render tweet list
            if (tweetRoot) {
                tweetRoot.render(React.createElement(TweetList, { token: window.currentToken.toLowerCase() }));
            }
        }
    };

    // Handle category switching
    document.getElementById('category-select').addEventListener('change', function(e) {
        const category = e.target.value;
        const mainContent = document.querySelector('.grid[style*="grid-template-columns: 1fr 3fr"]');
        const metricsBar = document.querySelector('.grid.grid-cols-3.gap-4');
        const performanceRanking = document.querySelector('.mt-4');
        const moggedText = document.querySelector('span.text-\\[3rem\\].font-bold');
        
        // Remove any existing coming soon text
        const existingComingSoon = document.querySelector('.coming-soon-text');
        if (existingComingSoon) {
            existingComingSoon.remove();
        }
        
        if (category === 'airdrops') {
            // For airdrops, remove blur and restore interactivity
            [mainContent, metricsBar, performanceRanking].forEach(element => {
                if (element) {
                    element.style.filter = '';
                    element.style.pointerEvents = '';
                }
            });
        } else {
            // For other categories, add blur and remove interactivity
            [mainContent, metricsBar, performanceRanking].forEach(element => {
                if (element) {
                    element.style.filter = 'blur(5px)';
                    element.style.pointerEvents = 'none';
                    // Add transition for smooth blur effect
                    element.style.transition = 'filter 0.3s ease';
                }
            });
            
            // Create and add the "Coming Soon" text next to "Mogged"
            const comingSoon = document.createElement('span');
            comingSoon.className = 'coming-soon-text text-sm bg-emerald-400/20 text-emerald-400 px-2 py-1 rounded ml-4';
            comingSoon.style.cssText = `
                display: inline-flex;
                align-items: center;
                font-weight: 500;
                height: 24px;
                margin-top: 5px;
            `;
            comingSoon.textContent = 'Coming Soon';
            
            if (moggedText) {
                // Make sure the parent container uses flexbox
                const parentContainer = moggedText.parentElement;
                parentContainer.style.display = 'inline-flex';
                parentContainer.style.alignItems = 'center';
                moggedText.insertAdjacentElement('afterend', comingSoon);
            }
        }
    });

    // After the buttons become visible
    document.querySelector('.button-container').addEventListener('transitionend', () => {
        setTimeout(() => {
            document.querySelector('.scroll-indicator').classList.add('visible');
        }, 350);
    });

    // Add wheel event listener for scrolling
    window.addEventListener('wheel', (e) => {
        if (e.deltaY > 0 && isLogoVisible) {  // Scrolling down
            document.getElementById('logo-section').classList.add('inactive');
            document.getElementById('ticker-section').classList.add('active');
            isLogoVisible = false;
            
            // Update chart when scrolling to ticker section
            if (window.updateChartAndPrefetch) {
                window.updateChartAndPrefetch();
            }
        } else if (e.deltaY < 0 && !isLogoVisible) {  // Scrolling up
            document.getElementById('logo-section').classList.remove('inactive');
            document.getElementById('ticker-section').classList.remove('active');
            isLogoVisible = true;
        }
    });

    // Also handle touch events for mobile
    let touchStartY;
    window.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    });

    window.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const deltaY = touchStartY - touchEndY;

        if (deltaY > 50 && isLogoVisible) {  // Scrolling down
            document.getElementById('logo-section').classList.add('inactive');
            document.getElementById('ticker-section').classList.add('active');
            isLogoVisible = false;
            
            // Update chart when scrolling to ticker section
            if (window.updateChartAndPrefetch) {
                window.updateChartAndPrefetch();
            }
        } else if (deltaY < -50 && !isLogoVisible) {  // Scrolling up
            document.getElementById('logo-section').classList.remove('inactive');
            document.getElementById('ticker-section').classList.remove('active');
            isLogoVisible = true;
        }
    });

    // Add this function to handle icon selection
    window.selectIcon = function(element) {
        // Remove selected class from all icons
        document.querySelectorAll('.airdrop-icon').forEach(icon => {
            icon.classList.remove('selected');
        });
        
        // Add selected class to clicked icon
        element.classList.add('selected');
        
        // Get the token symbol from the alt attribute
        const token = element.alt;
        
        // Update the current token
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
        
        // Update price data and metrics
        updatePriceData();
        
        // Update chart
        const timeRange = document.querySelector('.time-dropdown')?.value || '7D';
        if (window.chartUpdateAndPrefetch) {
            window.chartUpdateAndPrefetch(timeRange);
        }
        updateChart(token, timeRange);
        
        // Dispatch token change event for chart
        const event = new CustomEvent('tokenChange', { 
            detail: { token, timeRange } 
        });
        window.dispatchEvent(event);
        
        // Refresh tweets
        const bagsFumbledContent = document.querySelector('.bag-fumbled-content');
        if (bagsFumbledContent && window.TweetList) {
            // Clear existing content
            bagsFumbledContent.innerHTML = '';
            
            // Create new root and render
            window.tweetRoot = ReactDOM.createRoot(bagsFumbledContent);
            window.tweetRoot.render(React.createElement(window.TweetList, { 
                token: token.toLowerCase(),
                key: Date.now() // Force re-render
            }));
            
            // Trigger refresh animation
            const refreshButton = document.querySelector('.refresh-button svg');
            if (refreshButton) {
                refreshButton.style.transform = 'rotate(360deg)';
                refreshButton.style.transition = 'transform 0.5s ease';
                setTimeout(() => {
                    refreshButton.style.transform = 'rotate(0deg)';
                    setTimeout(() => {
                        refreshButton.style.transition = 'none';
                    }, 50);
                }, 500);
            }
        }
    };

    // Add this function to handle refresh button click
    window.refreshTweet = function() {
        const bagsFumbledContent = document.querySelector('.bag-fumbled-content');
        if (bagsFumbledContent && window.TweetList) {
            // Clear existing content
            bagsFumbledContent.innerHTML = '';
            
            // Create new root and render
            window.tweetRoot = ReactDOM.createRoot(bagsFumbledContent);
            window.tweetRoot.render(React.createElement(window.TweetList, { 
                token: window.currentToken.toLowerCase(),
                key: Date.now() // Force re-render
            }));
        }
    };
});

async function updateChart(token, timeRange) {
    console.log('Script: Updating chart for token:', token, 'timeRange:', timeRange);
    window.currentToken = token;
    
    // Dispatch token change event
    const event = new CustomEvent('tokenChange', { 
        detail: { token, timeRange } 
    });
    window.dispatchEvent(event);
    
    // Update chart
    if (window.chartUpdateAndPrefetch) {
        console.log('Script: Calling chartUpdateAndPrefetch with:', timeRange);
        await window.chartUpdateAndPrefetch(timeRange);
    } else {
        console.warn('Script: chartUpdateAndPrefetch not available');
    }
}

// Token button click handlers
document.querySelectorAll('.token-button').forEach(button => {
    button.addEventListener('click', async () => {
        const token = button.getAttribute('data-token');
        const timeRange = document.querySelector('.time-dropdown').value || '7D';
        console.log('Script: Token button clicked:', token, 'timeRange:', timeRange);
        await updateChart(token, timeRange);
    });
});

// Initial chart render
console.log('Script: Performing initial chart render');
const initialToken = 'HYPE';
const initialTimeRange = '7D';
updateChart(initialToken, initialTimeRange);
