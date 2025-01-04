// Constants
window.TRANSACTIONS_PER_PAGE = 15;
const MAX_TRANSACTIONS = 300;
const MAX_SEEN_HASHES = 1000;

// Keep track of seen transaction hashes to prevent duplicates
const seenHashes = new Set();

// Global variables for state management
window.transactions = [];
window.txCurrentPage = 1;
let txIsPaused = false;
let queuedTransactions = [];

// Helper function to shorten hash
window.txShortenHash = function(hash) {
    if (!hash) return '';
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
}

// Helper function to shorten address
window.txShortenAddress = function(address) {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Helper function to format time since
window.txFormatTimeSince = function(timestamp) {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);

    if (diff < 60) return `${diff} sec ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)} days ago`;
}

// Function to create transaction row HTML
window.createTransactionRow = function(tx) {
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
            <td><a href="#" onclick="performSearch('${tx.hash}'); return false;" class="hash-link">${window.txShortenHash(tx.hash)}</a></td>
            <td>${formattedAction}</td>
            <td>
                <div class="flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" stroke="rgba(72, 255, 225, 0.9)" fill="none" stroke-width="2">
                        <path d="M4 7L12 3L20 7L12 11L4 7Z" />
                        <path d="M4 7V17L12 21V11" />
                        <path d="M20 7V17L12 21" />
                    </svg>
                    <a href="#" onclick="performSearch('${tx.block}'); return false;" class="text-[rgba(72,255,225,0.9)] hover:text-[rgba(72,255,225,1)]">${tx.block || 'Pending'}</a>
                </div>
            </td>
            <td class="time" data-timestamp="${tx.time}">${window.txFormatTimeSince(tx.time)}</td>
            <td><a href="#" onclick="performSearch('${tx.user}'); return false;" class="text-[rgba(72,255,225,0.9)] hover:text-[rgba(72,255,225,1)]">${window.txShortenAddress(tx.user)}</a></td>
        </tr>
    `;
}

// Function to update pagination
function updateTransactionPagination() {
    const start = (window.txCurrentPage - 1) * window.TRANSACTIONS_PER_PAGE + 1;
    const end = Math.min(window.txCurrentPage * window.TRANSACTIONS_PER_PAGE, window.transactions.length);
    
    document.getElementById('transactions-pagination').textContent = `${start}-${end} of ${MAX_TRANSACTIONS}`;
    document.getElementById('transactions-prev').disabled = window.txCurrentPage === 1;
    document.getElementById('transactions-next').disabled = end >= window.transactions.length;
}

// Function to change page
function changeTransactionPage(direction) {
    const newPage = window.txCurrentPage + direction;
    const totalPages = Math.ceil(window.transactions.length / window.TRANSACTIONS_PER_PAGE);
    
    if (newPage >= 1 && newPage <= totalPages) {
        window.txCurrentPage = newPage;
        displayTransactions();
        updateTransactionPagination();
    }
}

// Function to display current page of transactions
function displayTransactions() {
    const tbody = document.getElementById('transactions');
    if (!tbody) return;

    if (window.transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-8 text-gray-400">
                    No transactions found
                </td>
            </tr>
        `;
        return;
    }

    const start = (window.txCurrentPage - 1) * window.TRANSACTIONS_PER_PAGE;
    const end = start + window.TRANSACTIONS_PER_PAGE;
    const pageTransactions = window.transactions.slice(start, end);
    
    tbody.innerHTML = pageTransactions.map(tx => window.createTransactionRow(tx)).join('');
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
    window.transactions.unshift(tx);

    // Keep only the latest transactions
    if (window.transactions.length > MAX_TRANSACTIONS) {
        window.transactions = window.transactions.slice(0, MAX_TRANSACTIONS);
    }

    // Update the table if we're on the first page
    if (window.txCurrentPage === 1) {
        displayTransactions();
        
        // Also update modal if it's open and on first page
        const modal = document.getElementById('transactionsModal');
        if (modal && modal.classList.contains('active') && window.modalTxCurrentPage === 1) {
            window.displayModalTransactions();
            window.updateTransactionsModalPagination();
        }
    }
    updateTransactionPagination();
}

// Function to process queued transactions
function processQueuedTransactions() {
    if (queuedTransactions.length > 0) {
        queuedTransactions.forEach(tx => {
            window.transactions.unshift(tx);
        });
        
        // Keep only the latest transactions
        if (window.transactions.length > MAX_TRANSACTIONS) {
            window.transactions = window.transactions.slice(0, MAX_TRANSACTIONS);
        }
        
        if (window.txCurrentPage === 1) {
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
            el.textContent = window.txFormatTimeSince(timestamp);
        }
    });
}

// Add modal page tracking
window.modalTxCurrentPage = 1;

// Modal-specific functions
window.displayModalTransactions = function() {
    const tbody = document.getElementById('modalTransactions');
    if (!tbody) return;

    const start = (window.modalTxCurrentPage - 1) * TRANSACTIONS_PER_PAGE;
    const end = start + TRANSACTIONS_PER_PAGE;
    const pageTransactions = transactions.slice(start, end);
    
    tbody.innerHTML = pageTransactions.map(tx => createTransactionRow(tx)).join('');

    // Update timestamps in modal
    document.querySelectorAll('#modalTransactions .time').forEach(el => {
        const timestamp = parseInt(el.dataset.timestamp);
        if (timestamp) {
            el.textContent = window.txFormatTimeSince(timestamp);
        }
    });
}

window.changeTransactionsModalPage = function(direction) {
    const newPage = window.modalTxCurrentPage + direction;
    const totalPages = Math.ceil(transactions.length / TRANSACTIONS_PER_PAGE);
    
    if (newPage >= 1 && newPage <= totalPages) {
        window.modalTxCurrentPage = newPage;
        window.displayModalTransactions();
        window.updateTransactionsModalPagination();
    }
}

window.updateTransactionsModalPagination = function() {
    const start = (window.modalTxCurrentPage - 1) * TRANSACTIONS_PER_PAGE + 1;
    const end = Math.min(window.modalTxCurrentPage * TRANSACTIONS_PER_PAGE, transactions.length);
    
    document.getElementById('transactions-modal-pagination').textContent = `${start}-${end} of ${transactions.length}`;
    document.getElementById('transactions-modal-prev').disabled = window.modalTxCurrentPage === 1;
    document.getElementById('transactions-modal-next').disabled = end >= transactions.length;
}

// Update the modal open function to reset to first page
window.openTransactionsModal = function() {
    const modal = document.getElementById('transactionsModal');
    if (modal) {
        window.modalTxCurrentPage = 1;  // Reset to first page when opening
        modal.classList.add('active');
        window.displayModalTransactions();
        window.updateTransactionsModalPagination();
    }
}

// Update the modal close function to reset page
window.closeTransactionsModal = function() {
    const modal = document.getElementById('transactionsModal');
    if (modal) {
        modal.classList.remove('active');
        window.modalTxCurrentPage = 1;  // Reset to first page when closing
    }
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

            // Set up the View All Transactions button click handler
            const viewAllButton = container.nextElementSibling.querySelector('.view-all-button');
            if (viewAllButton) {
                viewAllButton.onclick = (e) => {
                    e.preventDefault();
                    const modal = document.getElementById('transactionsModal');
                    if (modal) {
                        modal.classList.add('active');
                        window.displayModalTransactions();
                        window.updateTransactionsModalPagination();
                    }
                };
            }
        }
    }

    // Set up hover pause functionality for main table only
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
    setInterval(() => {
        updateTransactionTimestamps();
        // Also update modal timestamps if modal is open
        const modal = document.getElementById('transactionsModal');
        if (modal && modal.classList.contains('active')) {
            document.querySelectorAll('#modalTransactions .time').forEach(el => {
                const timestamp = parseInt(el.dataset.timestamp);
                if (timestamp) {
                    el.textContent = window.txFormatTimeSince(timestamp);
                }
            });
        }
    }, 30000);
}

// WebSocket connection
function connectTransactionWebSocket() {
    const ws = new WebSocket('wss://api-ui.hyperliquid.xyz/ws');

    ws.onopen = function() {
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