const API_BASE = 'https://api.hyperliquid.xyz';

// Fetch chain metadata
export const getChainMeta = async () => {
  try {
    const response = await fetch(`${API_BASE}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: "meta" })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching chain meta:', error);
    throw error;
  }
};

// Fetch latest blocks
export const getLatestBlocks = async (limit = 20) => {
  try {
    const response = await fetch(`${API_BASE}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        type: "metaAndL2BlockAtoms",
        req: { limit }
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching blocks:', error);
    throw error;
  }
};

// Fetch block details
export const getBlockDetails = async (blockNumber) => {
  try {
    const response = await fetch(`${API_BASE}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: "l2BlockAtoms",
        req: { blockNumber }
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching block details:', error);
    throw error;
  }
};

// Utility functions
export const formatTimeAgo = (timestamp) => {
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);
  
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const shortenAddress = (address) => {
  if (!address) return '-';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const shortenHash = (hash) => {
  if (!hash) return '-';
  if (hash === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return "0x0000...0000";
  }
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

export const formatNumber = (number, decimals = 2) => {
  if (number === undefined || number === null) return '-';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(number);
}; 