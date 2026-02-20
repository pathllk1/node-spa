import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export async function renderStockMovement(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
  <div class="max-w-7xl mx-auto px-4 py-16 space-y-8">

    <!-- Header -->
    <div class="text-center space-y-4">
      <div class="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-10 h-10 text-white">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 6v2.25m0 0v2.25m0-2.25h2.25m-2.25 0h-2.25m6.75-3v6.75m-6.75 0v6.75m0-6.75l2.25-2.25m-2.25 2.25l-2.25-2.25m6.75-3l2.25 2.25m-2.25-2.25l-2.25 2.25" />
        </svg>
      </div>
      <h1 class="text-4xl font-bold text-gray-900">Stock Movement</h1>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto">
        View and analyze all stock movements and inventory transactions.
      </p>
    </div>

    <!-- Controls -->
    <div class="bg-white rounded-xl shadow-lg p-6">
      <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div class="flex flex-col sm:flex-row gap-4 items-center">
          <div class="relative">
            <input type="text" id="search-movements" placeholder="Search movements..." class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 absolute left-3 top-2.5 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <select id="filter-type" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500">
            <option value="">All Types</option>
            <option value="SALE">Sale</option>
            <option value="PURCHASE">Purchase</option>
            <option value="RECEIPT">Receipt</option>
            <option value="TRANSFER">Transfer</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="OPENING">Opening</option>
          </select>
          <input type="date" id="filter-date-from" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500">
          <input type="date" id="filter-date-to" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500">
        </div>
        <div class="flex gap-2">
          <button id="refresh-movements" class="px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
          <button id="export-movements" class="px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export Excel
          </button>
        </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-green-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-green-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total In</p>
            <p class="text-2xl font-bold text-gray-900" id="total-in">0</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-red-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-red-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Out</p>
            <p class="text-2xl font-bold text-gray-900" id="total-out">0</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-blue-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-blue-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 6v2.25m0 0v2.25m0-2.25h2.25m-2.25 0h-2.25m6.75-3v6.75m-6.75 0v6.75m0-6.75l2.25-2.25m-2.25 2.25l-2.25-2.25m6.75-3l2.25 2.25m-2.25-2.25l-2.25 2.25" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Net Movement</p>
            <p class="text-2xl font-bold text-gray-900" id="net-movement">0</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-purple-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-purple-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Records</p>
            <p class="text-2xl font-bold text-gray-900" id="total-records">0</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Movements Table -->
    <div class="bg-white rounded-xl shadow-lg overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">Stock Movements</h3>
        <p class="text-sm text-gray-600">Showing <span id="movements-count">0</span> movements</p>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gradient-to-r from-red-500 via-blue-500 to-yellow-500 text-white">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="bdate">
                <div class="flex items-center">
                  Date
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="type">
                <div class="flex items-center">
                  Type
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="bno">
                <div class="flex items-center">
                  Bill No
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="item">
                <div class="flex items-center">
                  Item
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Batch</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="qty">
                <div class="flex items-center justify-end">
                  Quantity
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">UOM</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="rate">
                <div class="flex items-center justify-end">
                  Rate
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600" data-sort="total">
                <div class="flex items-center justify-end">
                  Total
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Party</th>
            </tr>
          </thead>
          <tbody id="movements-table-body" class="bg-white divide-y divide-gray-200">
            <tr>
              <td colspan="10" class="px-6 py-4 text-center text-gray-500">
                <div class="flex items-center justify-center">
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading movements...
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-700">
            <span id="pagination-info">Showing 0 to 0 of 0 movements</span>
          </div>
          <div class="flex items-center space-x-2">
            <button id="prev-page" class="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              Previous
            </button>
            <div class="flex space-x-1">
              <span id="page-numbers" class="flex space-x-1"></span>
            </div>
            <button id="next-page" class="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <div class="flex justify-center">
      <a href="/inventory/dashboard" data-navigo class="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Dashboard
      </a>
    </div>

  </div>
  `;

  // FIX 1: content was defined but renderLayout was never called with it.
  renderLayout(content, router);

  // FIX 2: initializeMovementsPage was defined but never called.
  initializeMovementsPage(router);
}

// FIX 3: Moved outside renderStockMovement and removed the shadowing `router`
// parameter — the function never used it, and it shadowed the outer parameter.
function initializeMovementsPage(router) {
  let allMovements = [];
  let filteredMovements = [];
  let sortedMovements = [];
  let currentPage = 1;
  let itemsPerPage = 10;
  let sortColumn = '';
  let sortDirection = 'asc'; // 'asc' or 'desc'

  // DOM elements
  const searchInput = document.getElementById('search-movements');
  const typeFilter = document.getElementById('filter-type');
  const dateFromFilter = document.getElementById('filter-date-from');
  const dateToFilter = document.getElementById('filter-date-to');
  const refreshBtn = document.getElementById('refresh-movements');
  const exportBtn = document.getElementById('export-movements');
  const tableBody = document.getElementById('movements-table-body');
  const movementsCount = document.getElementById('movements-count');
  const totalInEl = document.getElementById('total-in');
  const totalOutEl = document.getElementById('total-out');
  const netMovementEl = document.getElementById('net-movement');
  const totalRecordsEl = document.getElementById('total-records');
  const paginationInfo = document.getElementById('pagination-info');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const pageNumbers = document.getElementById('page-numbers');
  const itemsPerPageSelect = document.createElement('select');
  itemsPerPageSelect.id = 'items-per-page';
  itemsPerPageSelect.className = 'px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500';
  itemsPerPageSelect.innerHTML = `
    <option value="10">10 per page</option>
    <option value="25">25 per page</option>
    <option value="50">50 per page</option>
    <option value="100">100 per page</option>
  `;
  itemsPerPageSelect.value = itemsPerPage;

  // Insert items per page selector
  const controlsDiv = document.querySelector('.flex.flex-col.sm\\:flex-row.gap-4.items-center.justify-between');
  if (controlsDiv) {
    const leftControls = controlsDiv.querySelector('.flex.flex-col.sm\\:flex-row.gap-4.items-center');
    if (leftControls) {
      leftControls.appendChild(itemsPerPageSelect);
    }
  }

  // Load movements data
  async function loadMovements() {
    try {
      console.log('Loading movements from API...');
      // FIX 4: Corrected API path from /api/inventory/stock-movements
      // to /api/inventory/sales/stock-movements (matches sls.js route).
      // FIX 5: Removed Authorization: Bearer header — this app uses
      // httpOnly cookie auth (set by authMiddleware), not localStorage tokens.
      const response = await fetch('/api/inventory/sales/stock-movements', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to load movements: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Movements data received:', data);
      allMovements = data.data.rows || [];
      filteredMovements = [...allMovements];
      sortedMovements = [...filteredMovements];

      // Apply current sorting
      if (sortColumn) {
        sortMovements(sortColumn, sortDirection);
      }

      currentPage = 1; // Reset to first page
      renderMovements();
      updateSummary();
      updatePagination();
    } catch (error) {
      console.error('Error loading movements:', error);
      tableBody.innerHTML = `
        <tr>
          <td colspan="10" class="px-6 py-4 text-center text-red-500">
            <div class="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Error loading movements. Please check console for details.
            </div>
          </td>
        </tr>
      `;
    }
  }

  // Sort movements function
  function sortMovements(column, direction) {
    sortColumn = column;
    sortDirection = direction;

    sortedMovements.sort((a, b) => {
      let valueA, valueB;

      switch (column) {
        case 'bno':
          valueA = a.bno || '';
          valueB = b.bno || '';
          break;
        case 'bdate':
          valueA = new Date(a.bdate || 0);
          valueB = new Date(b.bdate || 0);
          break;
        case 'type':
          valueA = a.type || '';
          valueB = b.type || '';
          break;
        case 'item':
          valueA = a.item || '';
          valueB = b.item || '';
          break;
        case 'qty':
          valueA = parseFloat(a.qty || 0);
          valueB = parseFloat(b.qty || 0);
          break;
        case 'rate':
          valueA = parseFloat(a.rate || 0);
          valueB = parseFloat(b.rate || 0);
          break;
        case 'total':
          valueA = parseFloat(a.total || 0);
          valueB = parseFloat(b.total || 0);
          break;
        default:
          return 0;
      }

      if (direction === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });

    // Update sort icons
    updateSortIcons();

    currentPage = 1; // Reset to first page when sorting
    renderMovements();
    updatePagination();
  }

  // Update sort icons
  function updateSortIcons() {
    const headers = document.querySelectorAll('th[data-sort]');
    headers.forEach(header => {
      const column = header.dataset.sort;
      const icon = header.querySelector('.sort-icon');

      if (icon) {
        if (column === sortColumn) {
          icon.classList.remove('opacity-30');
          icon.classList.add('opacity-100');
          if (sortDirection === 'asc') {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />';
          } else {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />';
          }
        } else {
          icon.classList.remove('opacity-100');
          icon.classList.add('opacity-30');
          icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />';
        }
      }
    });
  }

  // Pagination functions
  function getPaginatedMovements() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedMovements.slice(startIndex, endIndex);
  }

  function getTotalPages() {
    return Math.ceil(sortedMovements.length / itemsPerPage);
  }

  function updatePagination() {
    const totalItems = sortedMovements.length;
    const totalPages = getTotalPages();
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    // Update pagination info
    paginationInfo.textContent = `Showing ${startItem} to ${endItem} of ${totalItems} movements`;

    // Update buttons
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;

    // Update page numbers
    renderPageNumbers();
  }

  function renderPageNumbers() {
    const totalPages = getTotalPages();
    pageNumbers.innerHTML = '';

    if (totalPages <= 7) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        createPageButton(i);
      }
    } else {
      // Show first page
      createPageButton(1);

      if (currentPage > 4) {
        pageNumbers.innerHTML += '<span class="px-2">...</span>';
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        createPageButton(i);
      }

      if (currentPage < totalPages - 3) {
        pageNumbers.innerHTML += '<span class="px-2">...</span>';
      }

      // Show last page
      if (totalPages > 1) {
        createPageButton(totalPages);
      }
    }
  }

  function createPageButton(pageNum) {
    const button = document.createElement('button');
    button.textContent = pageNum;
    button.className = `px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 ${
      pageNum === currentPage ? 'bg-green-500 text-white border-green-500' : 'bg-white'
    }`;
    button.addEventListener('click', () => goToPage(pageNum));
    pageNumbers.appendChild(button);
  }

  function goToPage(page) {
    currentPage = page;
    renderMovements();
    updatePagination();
  }

  // Render movements table
  function renderMovements() {
    const paginatedMovements = getPaginatedMovements();

    if (paginatedMovements.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="10" class="px-6 py-4 text-center text-gray-500">
            <div class="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 6v2.25m0 0v2.25m0-2.25h2.25m-2.25 0h-2.25m6.75-3v6.75m-6.75 0v6.75m0-6.75l2.25-2.25m-2.25 2.25l-2.25-2.25m6.75-3l2.25 2.25m-2.25-2.25l-2.25 2.25" />
              </svg>
              No movements found matching your criteria.
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = paginatedMovements.map(movement => {
      const qty = parseFloat(movement.qty || 0);
      const rate = parseFloat(movement.rate || 0);
      const total = parseFloat(movement.total || 0);
      const type = movement.type || '';
      const isOutward = ['SALE', 'TRANSFER', 'ADJUSTMENT'].includes(type.toUpperCase());

      return `
        <tr class="bg-gradient-to-r from-white to-gray-50 hover:from-lime-100 hover:to-lime-200">
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(movement.bdate)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              isOutward ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }">
              ${type}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${movement.bno || ''}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${movement.item || ''}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${movement.batch || ''}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right ${isOutward ? 'text-red-600' : 'text-green-600'}">${qty.toFixed(2)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${movement.uom || ''}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">₹${rate.toFixed(2)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">₹${total.toFixed(2)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${movement.party_name || ''}</td>
        </tr>
      `;
    }).join('');
  }

  // Update summary statistics
  function updateSummary() {
    const totalRecords = allMovements.length;
    let totalIn = 0;
    let totalOut = 0;

    allMovements.forEach(movement => {
      const qty = parseFloat(movement.qty || 0);
      const type = movement.type || '';

      if (['RECEIPT', 'PURCHASE', 'OPENING'].includes(type.toUpperCase())) {
        totalIn += qty;
      } else if (['SALE', 'TRANSFER', 'ADJUSTMENT'].includes(type.toUpperCase())) {
        totalOut += qty;
      }
    });

    const netMovement = totalIn - totalOut;

    movementsCount.textContent = totalRecords;
    totalInEl.textContent = totalIn.toFixed(2);
    totalOutEl.textContent = totalOut.toFixed(2);
    netMovementEl.textContent = netMovement.toFixed(2);
    totalRecordsEl.textContent = totalRecords;
  }

  // Filter movements
  function filterMovements() {
    const searchTerm = searchInput.value.toLowerCase();
    const typeFilterValue = typeFilter.value;
    const dateFrom = dateFromFilter.value;
    const dateTo = dateToFilter.value;

    filteredMovements = allMovements.filter(movement => {
      // Search filter
      const matchesSearch = !searchTerm ||
        (movement.item || '').toLowerCase().includes(searchTerm) ||
        (movement.bno || '').toLowerCase().includes(searchTerm) ||
        (movement.party_name || '').toLowerCase().includes(searchTerm);

      // Type filter
      const matchesType = !typeFilterValue || movement.type === typeFilterValue;

      // Date filter
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const movementDate = new Date(movement.bdate);
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          matchesDate = matchesDate && movementDate >= fromDate;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999); // End of day
          matchesDate = matchesDate && movementDate <= toDate;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });

    sortedMovements = [...filteredMovements];

    // Apply current sorting
    if (sortColumn) {
      sortMovements(sortColumn, sortDirection);
    } else {
      currentPage = 1;
      renderMovements();
      updateSummary();
      updatePagination();
    }
  }

  // Export to Excel
  async function exportToExcel() {
    try {
      const params = new URLSearchParams();
      
      if (typeFilter.value) params.append('type', typeFilter.value);
      if (searchInput.value) params.append('searchTerm', searchInput.value);
      if (dateFromFilter.value) params.append('dateFrom', dateFromFilter.value);
      if (dateToFilter.value) params.append('dateTo', dateToFilter.value);
      
      const url = `/api/inventory/sales/stock-movements/export?${params.toString()}`;
      
      const response = await fetch(url, {
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `stock-movements-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Export error:', err);
      alert('Error exporting to Excel: ' + err.message);
    }
  }

  // Utility functions
  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // Event listeners
  searchInput.addEventListener('input', filterMovements);
  typeFilter.addEventListener('change', filterMovements);
  dateFromFilter.addEventListener('change', filterMovements);
  dateToFilter.addEventListener('change', filterMovements);
  refreshBtn.addEventListener('click', loadMovements);
  exportBtn.addEventListener('click', exportToExcel);

  // Sorting event listeners
  document.querySelectorAll('th[data-sort]').forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.sort;
      const newDirection = (sortColumn === column && sortDirection === 'asc') ? 'desc' : 'asc';
      sortMovements(column, newDirection);
    });
  });

  // Pagination event listeners
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  });

  nextPageBtn.addEventListener('click', () => {
    if (currentPage < getTotalPages()) {
      goToPage(currentPage + 1);
    }
  });

  // Items per page selector
  itemsPerPageSelect.addEventListener('change', () => {
    itemsPerPage = parseInt(itemsPerPageSelect.value);
    currentPage = 1; // Reset to first page
    renderMovements();
    updatePagination();
  });

  // Initialize sort icons
  updateSortIcons();

  // Initial load
  loadMovements();
}
