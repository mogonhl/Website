import React, { useState, useEffect } from 'react';
import MainLayout from '../../components/MainLayout';
import Head from 'next/head';
import { TOKENS } from '../../app/types/tokens.js';
import '../../styles/navbar.css';
import '../../styles/airdrops.css';

export default function AirdropsPage() {
    const [currentToken, setCurrentToken] = useState('HYPE');
    const [metrics, setMetrics] = useState({
        marketCap: 8850584777,
        performanceSinceTGE: 598.2,
        multiplier: 6
    });
    const [activeTab, setActiveTab] = useState('about');
    const [rankingOrder, setRankingOrder] = useState('size');
    const [prices, setPrices] = useState({});

    // Format numbers with dots for thousands
    const formatNumberWithDots = (num) => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    // Format numbers with appropriate suffixes
    const formatNumber = (num, useFullInteger = false) => {
        if (useFullInteger) return formatNumberWithDots(Math.round(num));
        if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toFixed(1);
    };

    // Fetch token prices
    const fetchPrices = async () => {
        try {
            const response = await fetch('https://api.hyperliquid.xyz/info');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            
            const newPrices = {};
            data.assetInfos.forEach(asset => {
                newPrices[asset.name] = parseFloat(asset.oraclePrice);
            });
            
            setPrices(newPrices);
            updateMetrics(newPrices);
        } catch (error) {
            console.error('Error fetching prices:', error);
        }
    };

    // Calculate and update metrics
    const updateMetrics = (currentPrices) => {
        const token = TOKENS[currentToken];
        if (!token || !currentPrices[token.ticker]) return;

        const currentPrice = currentPrices[token.ticker];
        const marketCap = currentPrice * token.supply;
        const performanceSinceTGE = ((currentPrice - token.tgePrice) / token.tgePrice) * 100;
        const multiplier = Math.floor(currentPrice / token.tgePrice);

        setMetrics({
            marketCap,
            performanceSinceTGE,
            multiplier
        });
    };

    // Handle token selection
    const handleTokenSelect = (symbol) => {
        setCurrentToken(symbol);
    };

    // Handle tab selection
    const handleTabSelect = (tabName) => {
        setActiveTab(tabName);
    };

    // Update prices periodically
    useEffect(() => {
        fetchPrices();
        const interval = setInterval(fetchPrices, 5000);
        return () => clearInterval(interval);
    }, []);

    // Update metrics when current token changes
    useEffect(() => {
        if (Object.keys(prices).length > 0) {
            updateMetrics(prices);
        }
    }, [currentToken, prices]);

    return (
        <MainLayout>
            <Head>
                <title>Airdrops Purrged</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
            </Head>
            <div className="section" id="ticker-section">
                <div className="max-w-7xl mx-auto px-8">
                    <h1 className="text-5xl mb-2">
                        <div className="inline-flex items-center gap-1">
                            <div className="category-select-wrapper">
                                <select className="category-select" id="category-select">
                                    <option value="airdrops">Airdrops</option>
                                    <option value="layer1s">Layer 1s</option>
                                    <option value="shitcoins">Shitcoins</option>
                                </select>
                            </div>
                            <span className="text-[3rem] font-bold">Purrged</span>
                        </div>
                    </h1>
                    <p className="text-gray-400 mb-8 text-lg">HYPE is the special one. Nice try.</p>
                    
                    <div className="grid grid-cols-3 gap-4 mb-12">
                        <div>
                            <p className="text-gray-400 mb-1">Market Cap</p>
                            <p className="text-3xl market-cap">${formatNumberWithDots(Math.round(metrics.marketCap))}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 mb-1">Performance since TGE</p>
                            <p className="text-3xl text-emerald-400 flex items-center">
                                <span className="performance">{metrics.performanceSinceTGE.toFixed(1)}%</span>
                                <span className="text-sm bg-emerald-400/20 text-emerald-400 px-2 py-1 rounded ml-2 multiplier">{metrics.multiplier}x</span>
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-400 mb-1">Mog Counter</p>
                            <div className="flex items-center gap-2 mb-4">
                                <img src="/assets/lol.png" alt="Mog Counter Icon" className="w-12 h-12 object-contain mog-counter" id="mogCounter" />
                                <span className="text-2xl">5</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid" style={{ gridTemplateColumns: '1fr 3fr', gap: '0.5rem' }}>
                        {/* Airdrops Box */}
                        <div className="bg-[#0f1a1f] border border-[#0a2622] rounded-lg px-6 pt-3 pb-6">
                            <div className="border-b border-gray-700 mb-4 relative">
                                <div className="flex">
                                    <span 
                                        className={`text-sm cursor-pointer hover:text-white transition-colors relative pb-2 ${
                                            activeTab === 'airdrops' ? 'text-white' : 'text-[rgb(148,158,156)]'
                                        }`}
                                        onClick={() => handleTabSelect('airdrops')}
                                    >
                                        Airdrops
                                        <div className="absolute tab-indicator left-0 w-full bg-emerald-400" 
                                             style={{ display: activeTab === 'airdrops' ? 'block' : 'none' }} />
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                {Object.entries(TOKENS)
                                    .filter(([_, token]) => token.type === 'airdrop')
                                    .map(([symbol, _]) => (
                                        <img 
                                            key={symbol}
                                            src={`/assets/Logos/${symbol}.png`}
                                            alt={symbol}
                                            className={`airdrop-icon w-10 h-10 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${
                                                currentToken === symbol ? 'selected' : ''
                                            }`}
                                            onClick={() => handleTokenSelect(symbol)}
                                        />
                                    ))
                                }
                            </div>
                        </div>
                        
                        {/* About Box */}
                        <div className="bg-[#0f1a1f] border border-[#0a2622] rounded-lg px-6 pt-3 pb-6">
                            <div className="border-b border-gray-700 mb-4 relative">
                                <div className="flex gap-4">
                                    <span 
                                        className={`text-sm cursor-pointer transition-colors relative pb-2 ${activeTab === 'about' ? 'text-white' : 'text-[rgb(148,158,156)]'}`}
                                        onClick={() => handleTabSelect('about')}
                                    >
                                        About
                                        <div className="absolute tab-indicator left-0 w-full bg-emerald-400"
                                             style={{ display: activeTab === 'about' ? 'block' : 'none' }} />
                                    </span>
                                    <span 
                                        className={`text-sm cursor-pointer transition-colors relative pb-2 ${activeTab === 'bagFumbled' ? 'text-white' : 'text-[rgb(148,158,156)]'}`}
                                        onClick={() => handleTabSelect('bagFumbled')}
                                    >
                                        Bag Fumbled
                                        <div className="absolute tab-indicator left-0 w-full bg-emerald-400"
                                             style={{ display: activeTab === 'bagFumbled' ? 'block' : 'none' }} />
                                    </span>
                                </div>
                            </div>
                            <div className="content-right">
                                {activeTab === 'about' && (
                                    <div id="about-content">
                                        <p className="text-gray-400 mb-4">{TOKENS[currentToken]?.desc1}</p>
                                        <p className="text-gray-400">{TOKENS[currentToken]?.desc2}</p>
                                    </div>
                                )}
                                {activeTab === 'bagFumbled' && (
                                    <div id="bagFumbled-content">
                                        <div className="performance-ranking flex gap-4 overflow-x-auto pb-4">
                                            {Object.entries(TOKENS)
                                                .filter(([_, token]) => token.type === 'airdrop' && prices[token.ticker])
                                                .sort((a, b) => {
                                                    const aValue = prices[a[1].ticker] * a[1].supply;
                                                    const bValue = prices[b[1].ticker] * b[1].supply;
                                                    return bValue - aValue;
                                                })
                                                .map(([symbol, token]) => {
                                                    const currentPrice = prices[token.ticker];
                                                    const marketCap = currentPrice * token.supply;
                                                    const performance = ((currentPrice - token.tgePrice) / token.tgePrice) * 100;
                                                    
                                                    return (
                                                        <div key={symbol} className="flex-shrink-0 w-32 p-2 bg-[#0a2622] rounded-lg cursor-pointer hover:bg-[#0f1a1f] transition-colors">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <img src={`/assets/Logos/${symbol}.png`} alt={symbol} className="w-6 h-6 rounded-full" />
                                                                <span className="text-xs">{symbol}</span>
                                                            </div>
                                                            <div className="text-xs text-[rgb(148,158,156)]">Market Cap</div>
                                                            <div className="text-sm">${formatNumber(marketCap)}</div>
                                                            <div className="text-xs text-[rgb(148,158,156)] mt-2">Performance</div>
                                                            <div className={`text-sm ${performance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {performance.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Performance Ranking Section */}
                    <div className="mt-4">
                        <div className="flex gap-4 mb-2 px-6">
                            <span 
                                className={`text-xs hover:text-white transition-colors cursor-pointer ${rankingOrder === 'size' ? 'text-white' : 'text-[rgb(148,158,156)]'}`}
                                onClick={() => setRankingOrder('size')}
                            >
                                Size
                            </span>
                            <span 
                                className={`text-xs hover:text-white transition-colors cursor-pointer ${rankingOrder === 'performance' ? 'text-white' : 'text-[rgb(148,158,156)]'}`}
                                onClick={() => setRankingOrder('performance')}
                            >
                                Performance
                            </span>
                        </div>
                        <div className="bg-[#0f1a1f] border border-[#0a2622] rounded-lg px-6 py-4 relative">
                            <div className="performance-ranking">
                                <div className="flex items-center gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#10B981 transparent' }}>
                                    {Object.entries(TOKENS)
                                        .filter(([_, token]) => token.type === 'airdrop' && prices[token.ticker])
                                        .sort((a, b) => {
                                            if (rankingOrder === 'size') {
                                                const aValue = prices[a[1].ticker] * a[1].supply;
                                                const bValue = prices[b[1].ticker] * b[1].supply;
                                                return bValue - aValue;
                                            } else {
                                                const aPerf = ((prices[a[1].ticker] - a[1].tgePrice) / a[1].tgePrice) * 100;
                                                const bPerf = ((prices[b[1].ticker] - b[1].tgePrice) / b[1].tgePrice) * 100;
                                                return bPerf - aPerf;
                                            }
                                        })
                                        .map(([symbol, token]) => {
                                            const currentPrice = prices[token.ticker];
                                            const marketCap = currentPrice * token.supply;
                                            const performance = ((currentPrice - token.tgePrice) / token.tgePrice) * 100;
                                            
                                            return (
                                                <div key={symbol} className="flex-shrink-0 w-32 p-2 bg-[#0a2622] rounded-lg cursor-pointer hover:bg-[#0f1a1f] transition-colors">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <img src={`/assets/Logos/${symbol}.png`} alt={symbol} className="w-6 h-6 rounded-full" />
                                                        <span className="text-xs">{symbol}</span>
                                                    </div>
                                                    <div className="text-xs text-[rgb(148,158,156)]">Market Cap</div>
                                                    <div className="text-sm">${formatNumber(marketCap)}</div>
                                                    <div className="text-xs text-[rgb(148,158,156)] mt-2">Performance</div>
                                                    <div className={`text-sm ${performance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {performance.toFixed(1)}%
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            </div>
                            <img src="/assets/small.png" alt="Small" className="absolute -bottom-6 -right-6 w-12 h-12 object-contain transform rotate-12" />
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
} 