// Constants
const MAX_TRANSACTIONS = 300; // Increased to match blocks
const MAX_SEEN_HASHES = 1000;
const TRANSACTIONS_PER_PAGE = 15;

// Keep track of seen transaction hashes to prevent duplicates
const seenHashes = new Set();

// Global variables for state management
let transactions = [];
let txCurrentPage = 1;
let txIsPaused = false;
let queuedTransactions = [];

// Helper function to shorten hash
function txShortenHash(hash) {
    if (!hash) return '';
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
}

// Helper function to shorten address
function txShortenAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Helper function to format time since
function txFormatTimeSince(timestamp) {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);

    if (diff < 60) return `${diff} sec ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)} days ago`;
}

// Function to create transaction row HTML
function createTransactionRow(tx) {
    // Get action type and format it nicely
    const actionType = tx.action.type;
    let formattedAction = actionType
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .trim();

    // Shorten specific action names
    formattedAction = formattedAction
        .replace('Cancel By Cloid', 'Cancel Cloid')
        .replace('Set Global Action', 'Set Global')
        .replace('Validator Sign Withdrawal Action', 'Withdrawal')
        .replace('Vote Eth Deposit Action', 'Deposit');

    // Force truncate if still too long
    if (formattedAction.length > 12) {
        formattedAction = formattedAction.substring(0, 12) + '...';
    }

    return `
        <tr>
            <td style="width: 150px; min-width: 150px"><a class="hash-link">${txShortenHash(tx.hash)}</a></td>
            <td style="width: 100px; max-width: 100px; min-width: 100px">${formattedAction}</td>
            <td><a class="hash-link">${tx.block || 'Pending'}</a></td>
            <td class="text-gray-400 time" data-timestamp="${tx.time}">${txFormatTimeSince(tx.time)}</td>
            <td>${txShortenAddress(tx.user)}</td>
        </tr>
    `;
}

// Function to update pagination
function updateTransactionPagination() {
    const start = (txCurrentPage - 1) * TRANSACTIONS_PER_PAGE + 1;
    const end = Math.min(txCurrentPage * TRANSACTIONS_PER_PAGE, transactions.length);
    
    document.getElementById('transactions-pagination').textContent = `${start}-${end} of ${MAX_TRANSACTIONS}`;
    document.getElementById('transactions-prev').disabled = txCurrentPage === 1;
    document.getElementById('transactions-next').disabled = end >= transactions.length;
}

// Function to change page
function changeTransactionPage(direction) {
    const newPage = txCurrentPage + direction;
    const totalPages = Math.ceil(transactions.length / TRANSACTIONS_PER_PAGE);
    
    if (newPage >= 1 && newPage <= totalPages) {
        txCurrentPage = newPage;
        displayTransactions();
        updateTransactionPagination();
    }
}

// Function to display current page of transactions
function displayTransactions() {
    const tbody = document.getElementById('transactions');
    if (!tbody) return;

    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-8 text-gray-400">
                    No transactions found
                </td>
            </tr>
        `;
        return;
    }

    const start = (txCurrentPage - 1) * TRANSACTIONS_PER_PAGE;
    const end = start + TRANSACTIONS_PER_PAGE;
    const pageTransactions = transactions.slice(start, end);
    
    tbody.innerHTML = pageTransactions.map(tx => createTransactionRow(tx)).join('');
}

// Function to add new transaction
function addTransaction(tx) {
    // Skip if we've seen this hash before
    if (seenHashes.has(tx.hash)) {
        return;
    }

    if (txIsPaused) {
        queuedTransactions.push(tx);
        return;
    }

    // Add hash to seen set
    seenHashes.add(tx.hash);
    // Prevent set from growing too large
    if (seenHashes.size > MAX_SEEN_HASHES) {
        const firstHash = seenHashes.values().next().value;
        seenHashes.delete(firstHash);
    }

    // Add transaction to list
    transactions.unshift(tx);

    // Keep only the latest transactions
    if (transactions.length > MAX_TRANSACTIONS) {
        transactions = transactions.slice(0, MAX_TRANSACTIONS);
    }

    // Update the table if we're on the first page
    if (txCurrentPage === 1) {
        displayTransactions();
    }
    updateTransactionPagination();
}

// Function to process queued transactions
function processQueuedTransactions() {
    if (queuedTransactions.length > 0) {
        queuedTransactions.forEach(tx => {
            transactions.unshift(tx);
        });
        
        // Keep only the latest transactions
        if (transactions.length > MAX_TRANSACTIONS) {
            transactions = transactions.slice(0, MAX_TRANSACTIONS);
        }
        
        if (txCurrentPage === 1) {
            displayTransactions();
        }
        updateTransactionPagination();
        
        queuedTransactions = [];
    }
}

// Function to update timestamps
function updateTransactionTimestamps() {
    document.querySelectorAll('#transactions .time').forEach(el => {
        const timestamp = parseInt(el.dataset.timestamp);
        if (timestamp) {
            el.textContent = txFormatTimeSince(timestamp);
        }
    });
}

// Initialize transactions
async function initTransactions() {
    // Show loading state
    const tbody = document.getElementById('transactions');
    if (tbody) {
        // Update the table headers first
        const thead = tbody.parentElement.querySelector('thead tr');
        if (thead) {
            thead.innerHTML = `
                <th>Hash</th>
                <th style="width: 100px">Action</th>
                <th>Block</th>
                <th>Time</th>
                <th>User</th>
            `;
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <div class="flex items-center justify-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[rgba(72,255,225,0.9)]"></div>
                    </div>
                </td>
            </tr>
        `;

        // Add pagination controls
        const container = tbody.parentElement.parentElement;
        if (container) {
            container.insertAdjacentHTML('afterend', `
                <div class="view-all mt-4">
                    <a href="#" class="view-all-button">View All Transactions</a>
                    <div class="flex items-center gap-2">
                        <span class="pagination" id="transactions-pagination">0-0 of ${MAX_TRANSACTIONS}</span>
                        <div class="flex gap-1">
                            <button onclick="changeTransactionPage(-1)" class="text-[rgba(72,255,225,0.9)] hover:text-[rgba(72,255,225,1)] px-2 disabled:opacity-50" id="transactions-prev">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M15 18l-6-6 6-6"/>
                                </svg>
                            </button>
                            <button onclick="changeTransactionPage(1)" class="text-[rgba(72,255,225,0.9)] hover:text-[rgba(72,255,225,1)] px-2 disabled:opacity-50" id="transactions-next">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 18l6-6-6-6"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `);
        }
    }

    // Set up hover pause functionality
    const transactionsSection = document.querySelector('.section:nth-child(2)');
    transactionsSection.addEventListener('mouseenter', () => {
        txIsPaused = true;
    });
    
    transactionsSection.addEventListener('mouseleave', () => {
        txIsPaused = false;
        processQueuedTransactions();
    });

    // Connect to WebSocket
    connectTransactionWebSocket();

    // Start timestamp updates
    setInterval(updateTransactionTimestamps, 30000);
}

// WebSocket connection
function connectTransactionWebSocket() {
    const ws = new WebSocket('wss://api-ui.hyperliquid.xyz/ws');

    ws.onopen = function() {
        console.log('Connected to Hyperliquid WebSocket API');
        // Subscribe to transactions
        ws.send(JSON.stringify({
            method: "subscribe",
            subscription: {
                type: "explorerTxs"
            }
        }));
    };

    ws.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            
            // More detailed logging
            console.log('=== New WebSocket Message ===');
            console.log('Message type:', Array.isArray(data) ? 'Array of ' + data.length + ' items' : typeof data);
            if (Array.isArray(data) && data.length > 0) {
                console.log('First item sample:', JSON.stringify(data[0], null, 2));
            }

            // Handle transaction data
            if (Array.isArray(data)) {
                data.forEach(tx => {
                    if (tx && tx.hash) {
                        addTransaction(tx);
                    }
                });
            }
        } catch (error) {
            console.error('Error parsing transaction data:', error);
        }
    };

    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
    };

    ws.onclose = function() {
        console.log('WebSocket connection closed. Reconnecting...');
        setTimeout(connectTransactionWebSocket, 1000);
    };
}

// Start the application
initTransactions(); 