/**
 * STOCKS MANAGEMENT SYSTEM
 * Main orchestrator for stock management functionality
 */

import { fetchStocks, createStock, updateStock, deleteStock } from './stockApi.js';
import { renderStocksTable, renderStockCards, renderStockModal } from './stockRenderer.js';
import { showToast } from '../sls/toast.js';

export function initStocksSystem() {
    console.log('Stocks: Initializing Stock Management System...');

    // Load XLSX library if not already loaded
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = '/public/cdns/xlsx.full.min.js';
        script.onload = () => {
            console.log('XLSX library loaded successfully');
        };
        script.onerror = () => {
            console.error('Failed to load XLSX library');
        };
        document.head.appendChild(script);
    }

    const container = document.getElementById('stocks-system');
    if (!container) return;

    const state = {
        stocks: [],
        loading: false,
        searchQuery: '',
        filters: {
            category: '',
            lowStock: false
        },
        currentView: 'table', // 'table' or 'cards'
        selectedStock: null,
        // Sorting and pagination
        sortField: 'item',
        sortDirection: 'asc',
        currentPage: 1,
        itemsPerPage: 10
    };

    // Initialize the system
    renderMainLayout();
    loadStocksData();

    async function loadStocksData() {
        state.loading = true;
        updateDisplay(); // Show loading state immediately
        
        try {
            state.stocks = await fetchStocks();
            updateDisplay();
        } catch (error) {
            showToast('Failed to load stocks: ' + error.message, 'error');
            
            // Show error state
            const contentContainer = document.getElementById('stocks-content');
            if (contentContainer) {
                contentContainer.innerHTML = `
                    <div class="text-center py-12 bg-white rounded-lg border border-red-200">
                        <i class="fas fa-exclamation-triangle text-6xl text-red-300 mb-4"></i>
                        <h3 class="text-xl font-semibold text-red-700 mb-2">Failed to Load Stocks</h3>
                        <p class="text-red-600 mb-4">${error.message}</p>
                        <button id="stocks-retry-button" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                            <i class="fas fa-redo mr-2"></i>Try Again
                        </button>
                    </div>
                `;
                
                // Attach event listener to retry button
                document.getElementById('stocks-retry-button')?.addEventListener('click', () => {
                    loadStocksData();
                });
            }
        } finally {
            state.loading = false;
            updateDisplay();
        }
    }

    function renderMainLayout() {
        container.innerHTML = `
            <div class="stocks-management p-6">
                <!-- Header -->
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-900">Stock Management</h1>
                        <p class="text-gray-600 mt-1">Manage your inventory and stock levels</p>
                    </div>
                    <div class="flex gap-3">
                        <button id="toggle-view-btn" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                            <i class="fas fa-th-large mr-2"></i>Toggle View
                        </button>
                        <button id="add-stock-btn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            <i class="fas fa-plus mr-2"></i>Add Stock
                        </button>
                        <button id="export-excel-btn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            <i class="fas fa-file-excel mr-2"></i>Export to Excel
                        </button>
                    </div>
                </div>

                <!-- Stats Cards -->
                <div id="stock-stats" class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <!-- Stats will be rendered here -->
                </div>

                <!-- Controls -->
                <div class="flex flex-wrap gap-4 mb-6">
                    <div class="flex-1 min-w-[300px]">
                        <div class="relative">
                            <input type="text" id="search-input" placeholder="Search stocks..." 
                                class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                        </div>
                    </div>
                    
                    <select id="category-filter" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">All Categories</option>
                        <option value="low">Low Stock</option>
                        <option value="high">High Value</option>
                    </select>
                    
                    <!-- Sort Controls -->
                    <select id="sort-field" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="item">Sort by Item</option>
                        <option value="batch">Sort by Batch</option>
                        <option value="qty">Sort by Quantity</option>
                        <option value="rate">Sort by Rate</option>
                        <option value="total">Sort by Total Value</option>
                    </select>
                    
                    <select id="sort-direction" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="asc">A-Z / Low-High</option>
                        <option value="desc">Z-A / High-Low</option>
                    </select>
                    
                    <!-- Items per page -->
                    <select id="items-per-page" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="5">5 per page</option>
                        <option value="10" selected>10 per page</option>
                        <option value="25">25 per page</option>
                        <option value="50">50 per page</option>
                    </select>
                    
                    <button id="refresh-btn" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                        <i class="fas fa-sync-alt mr-2"></i>Refresh
                    </button>
                </div>

                <!-- Loading State -->
                <div id="loading-state" class="hidden text-center py-12">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p class="mt-2 text-gray-600">Loading stocks...</p>
                </div>

                <!-- Content Area -->
                <div id="stocks-content">
                    <!-- Stocks will be rendered here -->
                </div>
                
                <!-- Pagination -->
                <div id="pagination-controls" class="flex justify-between items-center mt-6">
                    <div class="text-sm text-gray-600">
                        Showing <span id="showing-from">1</span> to <span id="showing-to">10</span> of <span id="total-items">0</span> items
                    </div>
                    <div class="flex gap-2">
                        <button id="prev-page" class="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50">
                            <i class="fas fa-chevron-left"></i> Previous
                        </button>
                        <button id="next-page" class="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50">
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners
        attachEventListeners();
        updateDisplay();
    }

    function attachEventListeners() {
        // Add stock button
        document.getElementById('add-stock-btn')?.addEventListener('click', () => {
            openStockModal();
        });

        // Toggle view button
        document.getElementById('toggle-view-btn')?.addEventListener('click', () => {
            state.currentView = state.currentView === 'table' ? 'cards' : 'table';
            updateDisplay();
        });

        // Export to Excel button
        document.getElementById('export-excel-btn')?.addEventListener('click', () => {
            exportToExcel();
        });

        // Search input
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            state.currentPage = 1; // Reset to first page
            updateDisplay();
        });

        // Category filter
        document.getElementById('category-filter')?.addEventListener('change', (e) => {
            state.filters.category = e.target.value;
            state.currentPage = 1; // Reset to first page
            updateDisplay();
        });

        // Sort controls
        document.getElementById('sort-field')?.addEventListener('change', (e) => {
            state.sortField = e.target.value;
            updateDisplay();
        });

        document.getElementById('sort-direction')?.addEventListener('change', (e) => {
            state.sortDirection = e.target.value;
            updateDisplay();
        });

        // Items per page
        document.getElementById('items-per-page')?.addEventListener('change', (e) => {
            state.itemsPerPage = parseInt(e.target.value);
            state.currentPage = 1; // Reset to first page
            updateDisplay();
        });

        // Pagination buttons
        document.getElementById('prev-page')?.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                updateDisplay();
            }
        });

        document.getElementById('next-page')?.addEventListener('click', () => {
            const totalPages = Math.ceil(getFilteredAndSortedStocks().length / state.itemsPerPage);
            if (state.currentPage < totalPages) {
                state.currentPage++;
                updateDisplay();
            }
        });

        // Refresh button
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            loadStocksData();
        });
    }

    function updateDisplay() {
        if (state.loading) {
            document.getElementById('loading-state')?.classList.remove('hidden');
            document.getElementById('stocks-content')?.classList.add('hidden');
            return;
        }

        document.getElementById('loading-state')?.classList.add('hidden');
        document.getElementById('stocks-content')?.classList.remove('hidden');

        // Update stats
        updateStats();

        // Filter and sort stocks
        const filteredAndSortedStocks = getFilteredAndSortedStocks();
        
        // Update pagination info
        updatePaginationInfo(filteredAndSortedStocks);

        // Render based on current view
        if (state.currentView === 'table') {
            renderStocksTable(filteredAndSortedStocks, container, state);
        } else {
            renderStockCards(filteredAndSortedStocks, container, state);
        }
    }

    function filterStocks() {
        return state.stocks.filter(stock => {
            // Search filter
            if (state.searchQuery) {
                const searchMatch = 
                    stock.item.toLowerCase().includes(state.searchQuery) ||
                    (stock.batch && stock.batch.toLowerCase().includes(state.searchQuery)) ||
                    (stock.hsn && stock.hsn.toLowerCase().includes(state.searchQuery)) ||
                    (stock.oem && stock.oem.toLowerCase().includes(state.searchQuery));
                if (!searchMatch) return false;
            }

            // Category filter
            if (state.filters.category === 'low' && stock.qty > 10) return false;
            if (state.filters.category === 'high' && stock.total < 10000) return false;

            return true;
        });
    }

    function getFilteredAndSortedStocks() {
        // First filter
        let stocks = filterStocks();
        
        // Then sort
        stocks.sort((a, b) => {
            let aValue = a[state.sortField];
            let bValue = b[state.sortField];
            
            // Handle null/undefined values
            if (aValue === null || aValue === undefined) aValue = '';
            if (bValue === null || bValue === undefined) bValue = '';
            
            // For numeric values, convert to numbers
            if (state.sortField === 'qty' || state.sortField === 'rate' || state.sortField === 'total') {
                aValue = parseFloat(aValue) || 0;
                bValue = parseFloat(bValue) || 0;
            } else {
                // For string values, convert to lowercase for case-insensitive sort
                aValue = String(aValue).toLowerCase();
                bValue = String(bValue).toLowerCase();
            }
            
            if (state.sortDirection === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
        
        // Then paginate
        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = startIndex + state.itemsPerPage;
        return stocks.slice(startIndex, endIndex);
    }

    function updatePaginationInfo(allStocks) {
        const totalItems = allStocks.length;
        const totalPages = Math.ceil(totalItems / state.itemsPerPage);
        const startIndex = (state.currentPage - 1) * state.itemsPerPage + 1;
        const endIndex = Math.min(startIndex + state.itemsPerPage - 1, totalItems);
        
        // Update pagination display
        document.getElementById('showing-from').textContent = totalItems > 0 ? startIndex : 0;
        document.getElementById('showing-to').textContent = endIndex;
        document.getElementById('total-items').textContent = totalItems;
        
        // Update button states
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (prevBtn) {
            prevBtn.disabled = state.currentPage === 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = state.currentPage >= totalPages;
        }
        
        // Show/hide pagination controls
        const paginationControls = document.getElementById('pagination-controls');
        if (paginationControls) {
            paginationControls.style.display = totalItems > state.itemsPerPage ? 'flex' : 'none';
        }
    }

    function updateStats() {
        const statsContainer = document.getElementById('stock-stats');
        if (!statsContainer) return;

        const totalItems = state.stocks.length;
        const totalValue = state.stocks.reduce((sum, stock) => sum + (stock.total || 0), 0);
        const lowStockItems = state.stocks.filter(stock => stock.qty <= 10).length;
        const totalQuantity = state.stocks.reduce((sum, stock) => sum + (stock.qty || 0), 0);

        statsContainer.innerHTML = `
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-center">
                    <div class="p-3 bg-blue-100 rounded-lg">
                        <i class="fas fa-boxes text-blue-600"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm text-gray-600">Total Items</p>
                        <p class="text-2xl font-bold text-gray-900">${totalItems}</p>
                    </div>
                </div>
            </div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-center">
                    <div class="p-3 bg-green-100 rounded-lg">
                        <i class="fas fa-rupee-sign text-green-600"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm text-gray-600">Total Value</p>
                        <p class="text-2xl font-bold text-gray-900">₹${totalValue.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
                    </div>
                </div>
            </div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-center">
                    <div class="p-3 bg-yellow-100 rounded-lg">
                        <i class="fas fa-exclamation-triangle text-yellow-600"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm text-gray-600">Low Stock</p>
                        <p class="text-2xl font-bold text-gray-900">${lowStockItems}</p>
                    </div>
                </div>
            </div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-center">
                    <div class="p-3 bg-purple-100 rounded-lg">
                        <i class="fas fa-weight text-purple-600"></i>
                    </div>
                    <div class="ml-4">
                        <p class="text-sm text-gray-600">Total Quantity</p>
                        <p class="text-2xl font-bold text-gray-900">${totalQuantity.toLocaleString('en-IN')}</p>
                    </div>
                </div>
            </div>
        `;
    }

    function openStockModal(stock = null) {
        renderStockModal(stock, state, async (stockData) => {
            try {
                if (stock) {
                    await updateStock(stock.id, stockData);
                    showToast('Stock updated successfully', 'success');
                } else {
                    await createStock(stockData);
                    showToast('Stock created successfully', 'success');
                }
                await loadStocksData(); // Reload data
            } catch (error) {
                showToast('Failed to save stock: ' + error.message, 'error');
            }
        });
    }

    function exportToExcel() {
        if (typeof XLSX === 'undefined') {
            showToast('XLSX library not loaded yet. Please try again.', 'error');
            return;
        }

        const stocks = getFilteredAndSortedStocks();
        if (stocks.length === 0) {
            showToast('No data to export', 'warning');
            return;
        }

        // Prepare data for export
        const data = stocks.map(stock => ({
            'Item': stock.item || '',
            'Batch': stock.batch || '',
            'HSN': stock.hsn || '',
            'OEM': stock.oem || '',
            'Quantity': stock.qty || 0,
            'UOM': stock.uom || 'PCS',
            'Rate': stock.rate || 0,
            'Total Value': stock.total || 0,
            'GST %': stock.grate || 0,
            'MRP': stock.mrp || ''
        }));

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(data);

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Stocks');

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `stocks_export_${timestamp}.xlsx`;

        // Download the file
        XLSX.writeFile(wb, filename);
        showToast('Excel file exported successfully', 'success');
    }

    // Expose functions to global scope - initialize once
    if (!window.stocksSystem) {
        window.stocksSystem = {};
    }
    
    window.stocksSystem.openStockModal = (stock) => {
        renderStockModal(stock, state, async (stockData) => {
            try {
                if (stock && stock.id) {
                    await updateStock(stock.id, stockData);
                    showToast('Stock updated successfully', 'success');
                } else {
                    await createStock(stockData);
                    showToast('Stock created successfully', 'success');
                }
                await loadStocksData(); // Refresh data
            } catch (error) {
                console.error('Failed to save stock:', error);
                showToast('Failed to save stock: ' + error.message, 'error');
            }
        });
    };
    
    window.stocksSystem.loadStocksData = loadStocksData;
    window.stocksSystem.refresh = () => {
        loadStocksData();
    };
    window.stocksSystem.state = state;
}
