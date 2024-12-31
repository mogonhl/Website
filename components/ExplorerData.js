import { useEffect, useState } from 'react';
import { formatTimeAgo, shortenAddress, shortenHash, formatNumber } from '../utils/hyperliquid';

export default function ExplorerData() {
    const [chainData, setChainData] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/api/hyperliquid/markets');
                if (!response.ok) throw new Error('Failed to fetch data');
                const data = await response.json();
                
                setChainData(data.meta);
                setTransactions(data.latestTransactions || []);
                setIsLoading(false);
            } catch (err) {
                setError(err.message);
                setIsLoading(false);
            }
        };

        fetchData();
        // Refresh data every 10 seconds
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[rgba(72,255,225,0.9)]"></div>
        </div>
    );
    
    if (error) return (
        <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-500">
            Error: {error}
        </div>
    );

    return (
        <div className="p-4 space-y-6">
            {/* Chain Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0f1a1e] p-4 rounded-lg">
                    <h3 className="text-gray-400 text-sm">Latest Block</h3>
                    <p className="text-2xl font-bold text-[rgba(72,255,225,0.9)]">
                        {chainData.blockNumber}
                    </p>
                </div>
                <div className="bg-[#0f1a1e] p-4 rounded-lg">
                    <h3 className="text-gray-400 text-sm">Total Markets</h3>
                    <p className="text-2xl font-bold text-[rgba(72,255,225,0.9)]">
                        {chainData.totalMarkets}
                    </p>
                </div>
                <div className="bg-[#0f1a1e] p-4 rounded-lg">
                    <h3 className="text-gray-400 text-sm">Recent Transactions</h3>
                    <p className="text-2xl font-bold text-[rgba(72,255,225,0.9)]">
                        {chainData.totalTransactions}
                    </p>
                </div>
            </div>

            {/* Latest Transactions */}
            <div className="bg-[#0f1a1e] rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-800">
                    <h2 className="text-xl font-bold">Latest Transactions</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-[#1a2327]">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm text-gray-400">Block</th>
                                <th className="px-4 py-3 text-left text-sm text-gray-400">Hash</th>
                                <th className="px-4 py-3 text-left text-sm text-gray-400">Type</th>
                                <th className="px-4 py-3 text-left text-sm text-gray-400">Asset</th>
                                <th className="px-4 py-3 text-left text-sm text-gray-400">Size</th>
                                <th className="px-4 py-3 text-left text-sm text-gray-400">Price</th>
                                <th className="px-4 py-3 text-left text-sm text-gray-400">User</th>
                                <th className="px-4 py-3 text-left text-sm text-gray-400">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx, index) => (
                                <tr key={tx.hash + index} className="border-t border-gray-800 hover:bg-[#1a2327] transition-colors">
                                    <td className="px-4 py-3">
                                        {tx.blockNumber}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-mono text-sm">
                                            {shortenHash(tx.hash)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={tx.type === 'order' ? 'text-blue-500' : 'text-purple-500'}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={tx.side === 'B' ? 'text-green-500' : 'text-red-500'}>
                                            {tx.side === 'B' ? 'Buy' : 'Sell'} {tx.coin}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {formatNumber(tx.size)}
                                    </td>
                                    <td className="px-4 py-3">
                                        ${formatNumber(tx.price)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-mono text-sm">
                                            {shortenAddress(tx.user)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-400">
                                        {formatTimeAgo(tx.timestamp)}
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="px-4 py-8 text-center text-gray-400">
                                        No transactions found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
} 