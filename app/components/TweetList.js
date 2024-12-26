// Organize tweets by token
const TWEETS_BY_TOKEN = {
    'hype': [
        { id: '1862296160687595528', sold: true },
        { id: '1866855346284998996', sold: true },  // buy/hold
        { id: '1864387021126382043', sold: true },
        { id: '1870996246237700418', sold: true },  // buy/hold
        { id: '1868104484351779188', sold: true },
        { id: '1853783644126466410', sold: true },
        { id: '1865073437284392994', sold: true },  // buy/hold
        { id: '1867805748434284793', sold: true },
        { id: '1867839698032636040', sold: true },  // buy/hold
        { id: '1868169228706365886', sold: true },
        { id: '1871303939536380397', sold: true },  // buy/hold
        { id: '1871475922974753252', sold: true },
        { id: '1871221424872186234', sold: true },  // buy/hold
        { id: '1870867292491563159', sold: true }
    ],
    'arb': [
        { id: '1638906224174579713', sold: false },
        { id: '1639051213504233475', sold: true },  // buy/hold
        { id: '1638705246699667457', sold: false },
        { id: '1638912602330783745', sold: true },  // buy/hold
        { id: '1640396769484849164', sold: false },
        { id: '1642556521912610818', sold: true },  // buy/hold
        { id: '1638995060959371267', sold: false },   // buy/hold
        { id: '1702461516333686878', sold: false },   // buy/hold
        { id: '1689006650114355200', sold: false } 
    ],
    'friend': [
        { id: '1803182813316895008', sold: false },
        { id: '1775917635307294851', sold: false },  // buy/hold
        { id: '1787122341282992607', sold: false },
        { id: '1795085531618918445', sold: false },  // buy/hold
        { id: '1787025012630737204', sold: false },
        { id: '1701672116616151185', sold: false },
        { id: '1786327472537051184', sold: false },  // buy/hold
        { id: '1783805629523530063', sold: false },
        { id: '1785016430699929845', sold: false }
    ],
    'jto': [
        { id: '1774716417558155380', sold: true },
        { id: '1732806029316886928', sold: true },  // buy/hold
        { id: '1732820188779913360', sold: true },
        { id: '1865464452507668844', sold: true },  // buy/hold
        { id: '1868874872929370119', sold: false },
        { id: '1732810421768429600', sold: true }
    ],
    'me': [
        { id: '1868117524732067978', sold: false },
        { id: '1866514569746895276', sold: true },  // buy/hold
        { id: '1863257777940099296', sold: false },
        { id: '1866495773820555700', sold: true },  // buy/hold
        { id: '1866652406202733042', sold: true },
        { id: '1866521410006655402', sold: false },
        { id: '1833484280715993306', sold: false }
    ],
    'pengu': [
        { id: '1871517121454501929', sold: false },
        { id: '1871283020537205059', sold: false },  // buy/hold
        { id: '1871574826865066424', sold: true },
        { id: '1869090393138364776', sold: false },  // buy/hold
        { id: '1869029684492829091', sold: false },
        { id: '1870919858084512039', sold: true },
        { id: '1869077257278706091', sold: false }
    ],
    'uni': [
        { id: '1306432490656145408', sold: false },
        { id: '1307016112006193154', sold: false },  // buy/hold
        { id: '1344672417818542080', sold: false },
        { id: '1306975257950130176', sold: true },  // buy/hold
        { id: '1306634567068123136', sold: false },
        { id: '1344745817970790400', sold: false },
        { id: '1344772431290970112', sold: false }
    ],
    'tia': [
        { id: '1723227359631835642', sold: false },
        { id: '1730966061409857775', sold: false },  // buy/hold
        { id: '1720007167145820518', sold: true },
        { id: '1724883099304042667', sold: false },  // buy/hold
        { id: '1752352806177014269', sold: true },
        { id: '1746462328713850925', sold: false },
        { id: '1731081224725123164', sold: true }
    ],
    'ens': [
        { id: '1457874263734693888', sold: false },
        { id: '1864255011875590607', sold: false },  // buy/hold
        { id: '1870402541143445962', sold: true },
        { id: '1458063181394464772', sold: false },  // buy/hold
        { id: '1681976172920406016', sold: true },
        { id: '1458471061062922249', sold: false }
    ],
    'jup': [
        { id: '1766260084387049634', sold: false },
        { id: '1829035303283065097', sold: false },  // buy/hold
        { id: '1765961716842586289', sold: false },
        { id: '1768955871550185899', sold: false },  // buy/hold
        { id: '1765743860917977333', sold: false }
    ],
    'wen': [
        { id: '1751855477015847002', sold: false },
        { id: '1766343914934415681', sold: false },  // buy/hold
        { id: '1750916523613618389', sold: true },
        { id: '1751590939091456055', sold: false },  // buy/hold
        { id: '1776104677697900823', sold: true },
        { id: '1768934933014163854', sold: false },
        { id: '1764275029183692897', sold: false },
        { id: '1772982403356586484', sold: false }
    ],
    'aevo': [
        { id: '1767858428230369723', sold: true },
        { id: '1772976064467218449', sold: false },  // buy/hold
        { id: '1767870332101341440', sold: true },
        { id: '1871155964403237361', sold: false },  // buy/hold
        { id: '1767953971203711089', sold: true },
        { id: '1767864902159405212', sold: false },
        { id: '1764275029183692897', sold: false },
        { id: '1772982403356586484', sold: false }
    ]
};

const STICKERS = [
    'assets/Sticker/1.png',
    'assets/Sticker/2.png',
    'assets/Sticker/2 2.png',
    'assets/Sticker/3.png',
    'assets/Sticker/3 2.png',
    'assets/Sticker/4.png',
    'assets/Sticker/4 2.png',
    'assets/Sticker/5.png',
    'assets/Sticker/6.png',
    'assets/Sticker/7.png',
    'assets/Sticker/9.png',
    'assets/Sticker/10.png',
    'assets/Sticker/13.png',
    'assets/Sticker/14.png',
    'assets/Sticker/15.png',
    'assets/Sticker/16.png',
    'assets/Sticker/17.png'
];

const STICKER_CONFIG = {
    size: {
        min: 94,    // Increased min size by 20% (from 78)
        max: 125    // Decreased max size by 20% (from 156)
    },
    minRotation: -45,
    maxRotation: 45
};

const GRID_SIZE = {
    COLS: 12,
    ROWS: 10
};

// Define the tweet safe zone (center area to avoid)
const TWEET_AREA = {
    startCol: Math.floor(GRID_SIZE.COLS * 0.2),  // 20% from left
    endCol: Math.floor(GRID_SIZE.COLS * 0.8),    // 80% from left
    startRow: Math.floor(GRID_SIZE.ROWS * 0.1),   // 10% from top
    endRow: Math.floor(GRID_SIZE.ROWS * 0.9)      // 90% from top
};

// Keep track of occupied cells
let occupiedCells = new Set();

// Define regions for sticker placement
const REGIONS = {
    TOP_LEFT: 'top-left',
    TOP_RIGHT: 'top-right',
    BOTTOM_LEFT: 'bottom-left',
    BOTTOM_RIGHT: 'bottom-right'
};

// Total number of stickers to place
const TOTAL_STICKERS = 24;  // Doubled from 12

// Keep track of stickers per region
let stickersPerRegion = new Map();

const getRandomSticker = () => {
    const randomIndex = Math.floor(Math.random() * STICKERS.length);
    return STICKERS[randomIndex];
};

const getRandomRotation = () => {
    return STICKER_CONFIG.minRotation + Math.floor(Math.random() * (STICKER_CONFIG.maxRotation - STICKER_CONFIG.minRotation));
};

const getRandomSize = () => {
    return STICKER_CONFIG.size.min + Math.floor(Math.random() * (STICKER_CONFIG.size.max - STICKER_CONFIG.size.min));
};

const getRegionForPosition = (x, y) => {
    const midX = GRID_SIZE.COLS / 2;
    const midY = GRID_SIZE.ROWS / 2;
    
    if (x < midX) {
        return y < midY ? REGIONS.TOP_LEFT : REGIONS.BOTTOM_LEFT;
    } else {
        return y < midY ? REGIONS.TOP_RIGHT : REGIONS.BOTTOM_RIGHT;
    }
};

const getPosition = (index) => {
    const totalStickers = TOTAL_STICKERS;
    const stickersPerSide = Math.floor(totalStickers / 4);  // 6 per side with 24 total
    const sideIndex = Math.floor(index / stickersPerSide);
    const positionInSide = index % stickersPerSide;
    
    let x, y;
    
    switch(sideIndex) {
        case 0: // Top
            x = 5 + (90 * positionInSide / (stickersPerSide - 1));  // Spread across 90% width, starting at 5%
            y = 2 + (positionInSide % 2) * 8;  // Alternate between 2% and 10% from top
            break;
            
        case 1: // Right
            x = 98 - (positionInSide % 2) * 8;  // Alternate between 98% and 90% from left
            y = 15 + (70 * positionInSide / (stickersPerSide - 1));  // Spread across 70% height
            break;
            
        case 2: // Bottom
            x = 95 - (90 * positionInSide / (stickersPerSide - 1));  // Spread across 90% width, ending at 5%
            y = 98 - (positionInSide % 2) * 8;  // Alternate between 98% and 90% from top
            break;
            
        case 3: // Left
            x = 2 + (positionInSide % 2) * 8;  // Alternate between 2% and 10% from left
            y = 85 - (70 * positionInSide / (stickersPerSide - 1));  // Spread across 70% height
            break;
            
        default: // Extra stickers (if any) go in corners
            const corner = index % 4;
            x = corner % 2 ? 98 : 2;  // Far left or right
            y = corner < 2 ? 2 : 98;  // Far top or bottom
    }
    
    // Add very slight variation to prevent perfect alignment
    const microJitter = 1;  // Reduced jitter for more precise edge placement
    x += (Math.random() - 0.5) * microJitter;
    y += (Math.random() - 0.5) * microJitter;
    
    return {
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) rotate(${getRandomRotation()}deg)`
    };
};

const Sticker = ({ style, index }) => {
    const [sticker, setSticker] = React.useState(() => {
        const rotation = getRandomRotation();
        return {
            src: getRandomSticker(),
            size: getRandomSize(),
            rotation,
            ...getPosition(index)
        };
    });

    React.useEffect(() => {
        const updateSticker = () => {
            const rotation = getRandomRotation();
            setSticker({
                src: getRandomSticker(),
                size: getRandomSize(),
                rotation,
                ...getPosition(index)
            });
        };

        window.addEventListener('tweetRefresh', updateSticker);
        return () => window.removeEventListener('tweetRefresh', updateSticker);
    }, [index]);

    return React.createElement('img', {
        src: sticker.src,
        className: 'absolute transition-all duration-500',
        style: {
            width: `${sticker.size}px`,
            height: `${sticker.size}px`,
            left: sticker.left,
            top: sticker.top,
            '--rotation': `${sticker.rotation}deg`,
            animation: 'float 3s ease-in-out infinite',
            opacity: 0.95,
            ...style
        }
    });
};

// Add falling sticker configuration
const FALLING_STICKER_CONFIG = {
    size: {
        min: 40,    // Smaller sizes for falling stickers
        max: 70
    },
    spawnRate: 2000,  // New sticker every 2 seconds
    fallDuration: {
        min: 4000,  // Fall duration between 4-7 seconds
        max: 7000
    },
    maxStickers: 5  // Maximum number of falling stickers at once
};

// Falling sticker component
const FallingSticker = ({ onAnimationEnd }) => {
    const [sticker, setSticker] = React.useState(() => {
        const size = FALLING_STICKER_CONFIG.size.min + 
            Math.floor(Math.random() * (FALLING_STICKER_CONFIG.size.max - FALLING_STICKER_CONFIG.size.min));
        
        const startX = 5 + Math.random() * 90;
        const startY = -10;
        const rotation = Math.random() * 360;
        const rotationEnd = rotation + (Math.random() * 360 - 180);
        const duration = FALLING_STICKER_CONFIG.fallDuration.min +
            Math.random() * (FALLING_STICKER_CONFIG.fallDuration.max - FALLING_STICKER_CONFIG.fallDuration.min);
        
        return {
            src: getRandomSticker(),
            size,
            startX,
            startY,
            rotation,
            rotationEnd,
            duration
        };
    });

    return React.createElement('img', {
        src: sticker.src,
        className: 'sticker',
        onAnimationEnd: onAnimationEnd,
        style: {
            width: `${sticker.size}px`,
            height: `${sticker.size}px`,
            left: `${sticker.startX}%`,
            top: `${sticker.startY}%`,
            opacity: 0.95,
            animation: `fall ${sticker.duration}ms linear forwards`,
            '--start-rotation': `${sticker.rotation}deg`,
            '--end-rotation': `${sticker.rotationEnd}deg`
        }
    });
};

const formatDate = (date) => {
    const options = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    };
    return new Date(date).toLocaleDateString('en-US', options);
};

const calculatePerformance = async (date, token, sold) => {
    try {
        console.log('Fetching token data for:', token);
        const response = await fetch(`/api/redis/get-token-data?token=${token}`);
        console.log('Response status:', response.status);
        
        // Log the raw response text for debugging
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`);
        }
        
        // Parse the response text
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse response:', parseError);
            throw new Error(`Failed to parse response: ${parseError.message}`);
        }
        
        if (!data || !data.prices || !Array.isArray(data.prices)) {
            console.error('Invalid data format:', data);
            throw new Error('Invalid data format received from API');
        }
        
        const tweetTimestamp = new Date(date).getTime();
        const prices = data.prices;
        const currentPrice = prices[prices.length - 1][1];
        
        // Find the closest price to the tweet timestamp
        let closestPrice = null;
        let minDiff = Infinity;
        let closestTimestamp = null;
        
        for (const [timestamp, price] of prices) {
            const diff = Math.abs(timestamp - tweetTimestamp);
            if (diff < minDiff) {
                minDiff = diff;
                closestPrice = price;
                closestTimestamp = timestamp;
            }
        }
        
        // Use initialPrice if tweet is before our data OR if closest price is the first price point
        if (tweetTimestamp < prices[0][0] || closestTimestamp === prices[0][0]) {
            console.log('Window.TOKENS:', window.TOKENS);
            console.log('Token uppercase:', token.toUpperCase());
            console.log('Token data:', window.TOKENS && window.TOKENS[token.toUpperCase()]);
            
            const tokenData = window.TOKENS && window.TOKENS[token.toUpperCase()];
            if (!tokenData || !tokenData.initialPrice) {
                console.log('No initial price found for token:', token.toUpperCase());
                console.log('Token data object:', tokenData);
                // If we don't have an initial price, use the first price from our data
                const firstPrice = prices[0][1];
                console.log('Using first price from data:', firstPrice);
                const percentageChange = ((currentPrice - firstPrice) / firstPrice * 100).toFixed(0);
                const isSuccess = sold ? currentPrice < firstPrice : currentPrice > firstPrice;
                return { value: percentageChange, success: isSuccess };
            }
            
            console.log('Using initialPrice calculation:', {
                reason: tweetTimestamp < prices[0][0] ? 'tweet before data' : 'closest to first price point',
                initialPrice: tokenData.initialPrice,
                currentPrice
            });
            const percentageChange = ((currentPrice - tokenData.initialPrice) / tokenData.initialPrice * 100).toFixed(0);
            const isSuccess = sold ? currentPrice < tokenData.initialPrice : currentPrice > tokenData.initialPrice;
            return { value: percentageChange, success: isSuccess };
        }
        
        console.log('Using price data calculation:', {
            closestPrice,
            currentPrice,
            sold
        });
        
        // Calculate percentage change from historical price to current price
        const percentageChange = ((currentPrice - closestPrice) / closestPrice * 100).toFixed(0);
        
        // For sell tweets: success is when you sold before price went down (current price is lower)
        // For buy tweets: success is when price went up after buying
        const isSuccess = sold ? currentPrice < closestPrice : currentPrice > closestPrice;
        
        return { 
            value: percentageChange, 
            success: isSuccess
        };
        
    } catch (error) {
        console.error('Failed to fetch token data:', error);
        return { value: '?', success: false };
    }
};

// Update Tweet component to handle performance success/failure
const Tweet = ({ tweet, token }) => {
    const [performance, setPerformance] = React.useState({ value: '...', success: false });
    const [refreshKey, setRefreshKey] = React.useState(0);
    const [fallingStickers, setFallingStickers] = React.useState([]);
    const nextStickerId = React.useRef(0);

    // Fetch performance data when tweet changes
    React.useEffect(() => {
        console.log('Calculating performance for:', { date: tweet.date, token, sold: tweet.sold });
        if (tweet.date && token) {
            calculatePerformance(tweet.date, token, tweet.sold)
                .then(result => {
                    console.log('Performance calculation result:', result);
                    setPerformance(result);
                })
                .catch(error => {
                    console.error('Performance calculation error:', error);
                    setPerformance({ value: '?', success: false });
                });
        }
    }, [tweet.date, token, tweet.sold]);

    // Handle falling sticker spawning
    React.useEffect(() => {
        const spawnSticker = () => {
            if (fallingStickers.length < FALLING_STICKER_CONFIG.maxStickers) {
                setFallingStickers(prev => [...prev, nextStickerId.current++]);
            }
        };

        const interval = setInterval(spawnSticker, FALLING_STICKER_CONFIG.spawnRate);
        return () => clearInterval(interval);
    }, [fallingStickers.length]);

    // Handle sticker removal when animation ends
    const handleStickerAnimationEnd = (stickerId) => {
        setFallingStickers(prev => prev.filter(id => id !== stickerId));
    };

    const stickers = Array(TOTAL_STICKERS).fill(null);

    return React.createElement('div', {
        className: 'relative mx-auto w-full max-w-4xl'
    },
        // Add both keyframe styles
        React.createElement('style', null, `
            @keyframes fall {
                from {
                    transform: translate(-50%, -50%) rotate(var(--start-rotation));
                }
                to {
                    transform: translate(-50%, 1000%) rotate(var(--end-rotation));
                }
            }
            @keyframes float {
                0%, 100% {
                    transform: translate(-50%, -50%) rotate(var(--rotation)) translateY(0);
                }
                50% {
                    transform: translate(-50%, -50%) rotate(var(--rotation)) translateY(-3px);
                }
            }
        `),
        // Background container with radial stripes and stickers
        React.createElement('div', {
            className: 'absolute inset-0 rounded-lg overflow-hidden',
            style: {
                minHeight: '300px',
                background: `
                    repeating-conic-gradient(
                        from 0deg,
                        transparent 0deg,
                        transparent 10deg,
                        rgba(16, 185, 129, 0.03) 10deg,
                        rgba(16, 185, 129, 0.03) 11deg
                    ),
                    repeating-conic-gradient(
                        from 180deg,
                        transparent 0deg,
                        transparent 10deg,
                        rgba(16, 185, 129, 0.03) 10deg,
                        rgba(16, 185, 129, 0.03) 11deg
                    )
                `,
                backgroundPosition: 'center, center',
                backgroundSize: '100% 100%'
            }
        },
            // Static stickers
            stickers.map((_, index) => 
                React.createElement(Sticker, { 
                    key: `${refreshKey}-${index}`,
                    index: index,
                    style: { zIndex: 1 }
                })
            ),
            // Falling stickers
            fallingStickers.map(id => 
                React.createElement(FallingSticker, {
                    key: id,
                    onAnimationEnd: () => handleStickerAnimationEnd(id)
                })
            )
        ),
        // Tweet content container with outline and enhanced shadow
        React.createElement('div', {
            className: 'relative mx-auto w-full max-w-xl z-10 flex items-center justify-center min-h-[300px]'
        },
            React.createElement('a', {
                href: `https://twitter.com/x/status/${tweet.id}`,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'block w-full bg-[#1a2a30] rounded-lg p-3 hover:bg-[#1f3238] transition-colors cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.1)] outline outline-1 outline-[rgba(16,185,129,0.2)]'
            },
                // Header container with author and performance
                React.createElement('div', {
                    className: 'flex items-center justify-between mb-3'
                },
                    // Author info
                    React.createElement('div', {
                        className: 'flex items-center gap-2'
                    },
                        React.createElement('img', {
                            src: tweet.author.avatar,
                            alt: tweet.author.name,
                            className: 'w-10 h-10 rounded-full'
                        }),
                        React.createElement('div', {
                            className: 'flex flex-col'
                        },
                            React.createElement('span', {
                                className: 'font-semibold text-white text-sm'
                            }, tweet.author.name),
                            React.createElement('span', {
                                className: 'text-[rgb(148,158,156)] text-xs'
                            }, '@' + tweet.author.handle)
                        )
                    ),
                    // Performance indicator
                    React.createElement('div', {
                        className: 'flex items-center gap-2'
                    },
                        React.createElement('div', {
                            className: 'relative flex items-center'
                        },
                            React.createElement('span', {
                                className: `text-[rgb(148,158,156)] text-sm ${
                                    performance.value !== '?' && performance.success ? 'line-through' : ''
                                }`
                            }, 'Fumbled'),
                            // Show loss indicator image only for successful predictions
                            performance.value !== '?' && performance.success && 
                            React.createElement('img', {
                                src: 'assets/Sticker/7.png',
                                className: 'absolute w-10 h-10',
                                style: {
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)'
                                }
                            })
                        ),
                        React.createElement('div', {
                            className: `px-2 py-1 rounded-md ${
                                performance.value !== '?' && performance.success
                                    ? 'bg-[rgba(16,185,129,0.1)]' 
                                    : 'bg-[rgba(239,68,68,0.1)]'
                            }`
                        },
                            React.createElement('span', {
                                className: `font-semibold ${
                                    performance.value !== '?' && performance.success
                                        ? 'text-emerald-400' 
                                        : 'text-red-400'
                                }`
                            }, `${performance.value !== '?' ? Math.abs(Number(performance.value)) : '?'}%`)
                        )
                    )
                ),
                // Separator line
                React.createElement('div', {
                    className: 'border-t border-[#2a3a40] mb-3'
                }),
                // Tweet content
                React.createElement('div', {
                    className: 'text-white text-sm whitespace-pre-wrap'
                }, tweet.content),
                // Date if available
                tweet.date && React.createElement('div', {
                    className: 'mt-2 text-xs text-[rgb(148,158,156)]'
                }, formatDate(tweet.date))
            )
        )
    );
};

const TweetList = ({ token }) => {
    const tweetData = TWEETS_BY_TOKEN[token] || [];
    const [currentTweetData, setCurrentTweetData] = React.useState(null);
    const [tweet, setTweet] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [remainingTweets, setRemainingTweets] = React.useState([]);
    
    // Reset and shuffle tweets when token changes
    React.useEffect(() => {
        console.log('Token changed to:', token);
        if (tweetData.length > 0) {
            const shuffled = [...tweetData].sort(() => Math.random() - 0.5);
            setRemainingTweets(shuffled.slice(1));  // All except first
            setCurrentTweetData(shuffled[0]);       // Set first as current
            window.dispatchEvent(new Event('tweetRefresh'));
        } else {
            setCurrentTweetData(null);
            setRemainingTweets([]);
        }
    }, [token]);  // Only depend on token changes

    const handleRefresh = React.useCallback(() => {
        if (tweetData.length <= 1) {
            console.log('Not enough tweets to refresh');
            return;
        }

        const updatedRemaining = remainingTweets.filter(t => t.id !== currentTweetData.id);
        
        if (updatedRemaining.length === 0) {
            const newShuffled = [...tweetData]
                .filter(t => t.id !== currentTweetData.id)
                .sort(() => Math.random() - 0.5);
            setRemainingTweets(newShuffled);
            setCurrentTweetData(newShuffled[0]);
        } else {
            setRemainingTweets(updatedRemaining);
            setCurrentTweetData(updatedRemaining[0]);
        }
        
        window.dispatchEvent(new Event('tweetRefresh'));
    }, [tweetData, currentTweetData, remainingTweets, token]);

    React.useEffect(() => {
        const fetchTweet = async () => {
            if (!currentTweetData) {
                setError('No tweets available for this token');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/tweet-proxy?tweetId=${currentTweetData.id}`);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.details || data.error || 'Failed to fetch tweet');
                }
                
                setTweet({
                    ...data,
                    id: currentTweetData.id,
                    sold: currentTweetData.sold
                });
            } catch (error) {
                console.error('Error fetching tweet:', error);
                setError(error.message || 'Failed to load tweet');
            } finally {
                setLoading(false);
            }
        };

        fetchTweet();
    }, [currentTweetData]);

    // Make refresh function available globally for the tab system
    React.useEffect(() => {
        console.log('Setting up refresh function');
        window.refreshTweet = handleRefresh;
        return () => {
            console.log('Cleaning up refresh function');
            window.refreshTweet = null;
        };
    }, [handleRefresh]);

    return React.createElement('div', { 
        className: "w-full flex justify-center items-center min-h-[300px]"
    },
        loading ? 
            React.createElement('div', { className: "text-[rgb(148,158,156)]" }, "Loading tweet...") :
            error ? 
                React.createElement('div', { className: "text-red-400" }, error) :
                tweet && React.createElement(Tweet, { 
                    tweet: tweet,
                    token: token
                })
    );
};

if (typeof window !== 'undefined') {
    window.TweetList = TweetList;
} 