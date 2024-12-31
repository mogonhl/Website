import { getChainMeta, getLatestBlocks } from '../../../utils/hyperliquid';

export default async function handler(req, res) {
    try {
        // Fetch chain metadata
        const chainMeta = await getChainMeta();
        console.log('Chain meta:', chainMeta);
        
        // Fetch latest blocks
        const blocksData = await getLatestBlocks(20);
        console.log('Blocks data:', blocksData);
        
        // Get transactions from the latest blocks
        const latestTransactions = [];
        if (blocksData.atoms) {
            for (const block of blocksData.atoms) {
                if (block.actions) {
                    const transactions = block.actions.map(action => ({
                        blockNumber: block.blockNumber,
                        timestamp: block.timestamp,
                        hash: action.hash || '0x0',
                        type: action.type,
                        coin: action.coin,
                        side: action.side,
                        size: action.size,
                        price: action.price,
                        user: action.user
                    }));
                    latestTransactions.push(...transactions);
                }
            }
        }
        
        // Format response
        res.status(200).json({
            meta: {
                blockNumber: chainMeta?.L1BlockNumber || chainMeta?.blockNumber || '-',
                totalMarkets: chainMeta?.universe?.length || 0,
                totalTransactions: latestTransactions.length
            },
            markets: chainMeta?.universe || [],
            latestTransactions: latestTransactions
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 50) // Keep only the 50 most recent transactions
        });
    } catch (error) {
        console.error('Detailed error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        res.status(500).json({ 
            error: 'Failed to fetch chain data', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
} 