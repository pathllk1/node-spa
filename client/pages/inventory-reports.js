import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export async function renderInventoryReports(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
  <div class="px-4 py-16 space-y-8">

    <!-- Header -->
    <div class="text-center space-y-4">
      <div class="w-20 h-20 mx-auto bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-10 h-10 text-white">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      </div>
      <h1 class="text-4xl font-bold text-gray-900">Bills Reports</h1>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto">
        View and analyze all your sales bills and transactions.
      </p>
    </div>

    <!-- Controls -->
    <div class="bg-white rounded-xl shadow-lg p-6">
      <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div class="flex flex-col sm:flex-row gap-4 items-center">
          <div class="relative">
            <input type="text" id="search-bills" placeholder="Search bills..." class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 absolute left-3 top-2.5 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <select id="filter-type" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
            <option value="">All Bill Types</option>
            <option value="SALES">Sales</option>
            <option value="PURCHASE">Purchase</option>
          </select>
          <input type="date" id="filter-date-from" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
          <input type="date" id="filter-date-to" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
        </div>
        <div class="flex gap-2">
          <button id="refresh-bills" class="px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
          <button id="export-bills" class="px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-blue-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-blue-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Bills</p>
            <p class="text-2xl font-bold text-gray-900" id="total-bills">0</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-green-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-green-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Revenue</p>
            <p class="text-2xl font-bold text-gray-900" id="total-revenue">₹0.00</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-orange-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-orange-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Tax</p>
            <p class="text-2xl font-bold text-gray-900" id="total-tax">₹0.00</p>
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
            <p class="text-sm font-medium text-gray-600">Active Bills</p>
            <p class="text-2xl font-bold text-gray-900" id="active-bills">0</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Bills Table -->
    <div class="bg-white rounded-xl shadow-lg overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">Bills Overview</h3>
        <p class="text-sm text-gray-600">Showing <span id="bills-count">0</span> bills</p>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gradient-to-r from-emerald-600 via-cyan-600 to-violet-600 text-white">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-white/20" data-sort="bno">
                <div class="flex items-center">
                  Bill No
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-white/20" data-sort="bdate">
                <div class="flex items-center">
                  Date
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-white/20" data-sort="firm">
                <div class="flex items-center">
                  Party
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-white/20" data-sort="btype">
                <div class="flex items-center">
                  Type
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-white/20" data-sort="gtot">
                <div class="flex items-center justify-end">
                  Taxable Amount
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-white/20" data-sort="tax">
                <div class="flex items-center justify-end">
                  Tax Amount
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                <div class="flex items-center justify-end">
                  Total Amount
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 ml-1 sort-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15M8.25 9l3.75-3.75L15.75 9" />
                  </svg>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody id="bills-table-body" class="bg-white divide-y divide-gray-200">
            <tr>
              <td colspan="9" class="px-6 py-4 text-center text-gray-500">
                <div class="flex items-center justify-center">
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading bills...
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
            <span id="pagination-info">Showing 0 to 0 of 0 bills</span>
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
      <a href="/inventory/dashboard" data-navigo class="inline-flex items-center px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Dashboard
      </a>
    </div>

  </div>

  <!-- Bill Details Modal -->
  <div id="bill-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50">
    <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
      <div class="flex items-center justify-between p-4 border-b">
        <h3 class="text-xl font-semibold text-gray-900">Bill Details</h3>
        <button id="close-modal" class="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6">
        <!-- Bill Header Information -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Bill Number</label>
              <p id="modal-bill-no" class="mt-1 text-sm text-gray-900"></p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Bill Date</label>
              <p id="modal-bill-date" class="mt-1 text-sm text-gray-900"></p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Bill Type</label>
              <p id="modal-bill-type" class="mt-1 text-sm text-gray-900"></p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Status</label>
              <p id="modal-bill-status" class="mt-1 text-sm text-gray-900"></p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Party Name</label>
              <p id="modal-party-name" class="mt-1 text-sm text-gray-900"></p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">GSTIN</label>
              <p id="modal-party-gstin" class="mt-1 text-sm text-gray-900"></p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Address</label>
              <p id="modal-party-address" class="mt-1 text-sm text-gray-900"></p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">State</label>
              <p id="modal-party-state" class="mt-1 text-sm text-gray-900"></p>
            </div>
          </div>
        </div>

        <!-- Bill Items Table -->
        <div class="mb-8">
          <h4 class="text-lg font-medium text-gray-900 mb-4">Bill Items</h4>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody id="modal-items-body" class="bg-white divide-y divide-gray-200">
                <!-- Items will be populated here -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- Bill Summary -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="text-sm font-medium text-gray-700">Taxable Amount</div>
            <div class="text-xl font-bold text-gray-900" id="modal-taxable-amount">₹0.00</div>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="text-sm font-medium text-gray-700">Tax Amount</div>
            <div class="text-xl font-bold text-gray-900" id="modal-tax-amount">₹0.00</div>
          </div>
          <div class="bg-green-50 p-4 rounded-lg">
            <div class="text-sm font-medium text-gray-700">Grand Total</div>
            <div class="text-xl font-bold text-green-600" id="modal-grand-total">₹0.00</div>
          </div>
        </div>

        <!-- Tax Breakdown -->
        <div class="mb-8">
          <h4 class="text-lg font-medium text-gray-900 mb-4">Tax Breakdown</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span class="text-sm font-medium text-blue-700">CGST</span>
              <span class="text-sm font-bold text-blue-900" id="modal-cgst">₹0.00</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span class="text-sm font-medium text-blue-700">SGST</span>
              <span class="text-sm font-bold text-blue-900" id="modal-sgst">₹0.00</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span class="text-sm font-medium text-blue-700">IGST</span>
              <span class="text-sm font-bold text-blue-900" id="modal-igst">₹0.00</span>
            </div>
          </div>
        </div>

        <!-- Other Charges -->
        <div id="other-charges-section" class="mb-8 hidden">
          <h4 class="text-lg font-medium text-gray-900 mb-4">Other Charges</h4>
          <div id="other-charges-list" class="space-y-2">
            <!-- Other charges will be populated here -->
          </div>
        </div>

        <!-- Cancel Bill Section (Hidden by default) -->
        <div id="cancel-bill-section" class="mb-8 hidden">
          <div class="bg-red-50 border border-red-200 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-lg font-medium text-red-900">Cancel Bill</h4>
              <button id="cancel-section-toggle" class="text-red-600 hover:text-red-800">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            <div id="cancel-form-content" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-red-700 mb-2">Cancellation Reason *</label>
                <select id="cancel-reason" class="w-full px-3 py-2 border border-red-300 rounded-md focus:ring-red-500 focus:border-red-500" required>
                  <option value="">Select a reason...</option>
                  <option value="CUSTOMER_REQUEST">Customer Request</option>
                  <option value="DATA_ENTRY_ERROR">Data Entry Error</option>
                  <option value="DUPLICATE_BILL">Duplicate Bill</option>
                  <option value="BILLING_ERROR">Billing Error</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-red-700 mb-2">Remarks/Notes</label>
                <textarea id="cancel-remarks" rows="3" class="w-full px-3 py-2 border border-red-300 rounded-md focus:ring-red-500 focus:border-red-500" placeholder="Additional notes about the cancellation..."></textarea>
              </div>

              <div class="flex items-center space-x-4 pt-4">
                <button id="confirm-cancel" class="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm Cancellation
                </button>
                <button id="cancel-cancel" class="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex justify-end space-x-3 pt-4 border-t">
          <button id="edit-bill" class="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            Edit Bill
          </button>
          <button id="cancel-bill" class="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel Bill
          </button>
          <button id="print-bill" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.06-.48.12-.72.18m6.72-1.829c.24.06.48.12.72.18m0 0c.96.24 1.92.48 2.88.72m-3.6-.9c.96-.24 1.92-.48 2.88-.72m-2.88.72V9.36c0-.48-.24-.96-.72-1.2-.48-.24-1.08-.24-1.56 0-.48.24-.72.72-.72 1.2v4.32c0 .48.24.96.72 1.2.48.24 1.08.24 1.56 0 .24-.06.48-.12.72-.18Z" />
            </svg>
            Print Bill
          </button>
          <button id="download-pdf" class="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download PDF
          </button>
          <button id="close-modal-bottom" class="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
  `;

  renderLayout(content, router);

  // Initialize the bills functionality
  initializeBillsPage(router);
}

// Bills page functionality
function initializeBillsPage(router) {
  let allBills = [];
  let filteredBills = [];
  let sortedBills = [];
  let currentPage = 1;
  let itemsPerPage = 10;
  let sortColumn = '';
  let sortDirection = 'asc'; // 'asc' or 'desc'

  // Modal elements
  const modal = document.getElementById('bill-modal');
  const closeModalBtn = document.getElementById('close-modal');
  const closeModalBottomBtn = document.getElementById('close-modal-bottom');
  const printBillBtn = document.getElementById('print-bill');
  const downloadPdfBtn = document.getElementById('download-pdf');
  const editBillBtn = document.getElementById('edit-bill');

  // Modal content elements
  const modalBillNo = document.getElementById('modal-bill-no');
  const modalBillDate = document.getElementById('modal-bill-date');
  const modalBillType = document.getElementById('modal-bill-type');
  const modalBillStatus = document.getElementById('modal-bill-status');
  const modalPartyName = document.getElementById('modal-party-name');
  const modalPartyGstin = document.getElementById('modal-party-gstin');
  const modalPartyAddress = document.getElementById('modal-party-address');
  const modalPartyState = document.getElementById('modal-party-state');
  const modalItemsBody = document.getElementById('modal-items-body');
  const modalTaxableAmount = document.getElementById('modal-taxable-amount');
  const modalTaxAmount = document.getElementById('modal-tax-amount');
  const modalGrandTotal = document.getElementById('modal-grand-total');
  const modalCgst = document.getElementById('modal-cgst');
  const modalSgst = document.getElementById('modal-sgst');
  const modalIgst = document.getElementById('modal-igst');
  const otherChargesSection = document.getElementById('other-charges-section');
  const otherChargesList = document.getElementById('other-charges-list');

  // Cancel bill modal elements
  const cancelBillBtn = document.getElementById('cancel-bill');
  const cancelBillSection = document.getElementById('cancel-bill-section');
  const cancelSectionToggle = document.getElementById('cancel-section-toggle');
  const cancelFormContent = document.getElementById('cancel-form-content');
  const cancelReasonSelect = document.getElementById('cancel-reason');
  const cancelRemarksTextarea = document.getElementById('cancel-remarks');
  const confirmCancelBtn = document.getElementById('confirm-cancel');
  const cancelCancelBtn = document.getElementById('cancel-cancel');

  // DOM elements
  const searchInput = document.getElementById('search-bills');
  const typeFilter = document.getElementById('filter-type');
  const dateFromFilter = document.getElementById('filter-date-from');
  const dateToFilter = document.getElementById('filter-date-to');
  const refreshBtn = document.getElementById('refresh-bills');
  const exportBtn = document.getElementById('export-bills');
  const tableBody = document.getElementById('bills-table-body');
  const billsCount = document.getElementById('bills-count');
  const totalBillsEl = document.getElementById('total-bills');
  const totalRevenueEl = document.getElementById('total-revenue');
  const totalTaxEl = document.getElementById('total-tax');
  const activeBillsEl = document.getElementById('active-bills');
  const paginationInfo = document.getElementById('pagination-info');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const pageNumbers = document.getElementById('page-numbers');
  const itemsPerPageSelect = document.createElement('select');
  itemsPerPageSelect.id = 'items-per-page';
  itemsPerPageSelect.className = 'px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500';
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

  // Load bills data
  async function loadBills() {
    try {
      console.log('Loading bills from API...');
      const response = await fetch('/api/inventory/sales/bills', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      console.log('API response status:', response.status);
      console.log('API response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to load bills: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Bills data received:', data);
      allBills = data || [];
      filteredBills = [...allBills];
      sortedBills = [...filteredBills];

      // Apply current sorting
      if (sortColumn) {
        sortBills(sortColumn, sortDirection);
      }

      currentPage = 1; // Reset to first page
      renderBills();
      updateSummary();
      updatePagination();
    } catch (error) {
      console.error('Error loading bills:', error);
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="px-6 py-4 text-center text-red-500">
            <div class="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Error loading bills. Please check console for details.
            </div>
          </td>
        </tr>
      `;
    }
  }

  // Sort bills function
  function sortBills(column, direction) {
    sortColumn = column;
    sortDirection = direction;

    sortedBills.sort((a, b) => {
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
        case 'firm':
          valueA = (a.firm || '').toLowerCase();
          valueB = (b.firm || '').toLowerCase();
          break;
        case 'btype':
          valueA = a.btype || '';
          valueB = b.btype || '';
          break;
        case 'gtot':
          valueA = parseFloat(a.gtot || 0);
          valueB = parseFloat(b.gtot || 0);
          break;
        case 'tax':
          const taxA = (a.cgst || 0) + (a.sgst || 0) + (a.igst || 0);
          const taxB = (b.cgst || 0) + (b.sgst || 0) + (b.igst || 0);
          valueA = parseFloat(taxA);
          valueB = parseFloat(taxB);
          break;
        case 'ntot':
          valueA = parseFloat(a.ntot || 0);
          valueB = parseFloat(b.ntot || 0);
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
    renderBills();
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
  function getPaginatedBills() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedBills.slice(startIndex, endIndex);
  }

  function getTotalPages() {
    return Math.ceil(sortedBills.length / itemsPerPage);
  }

  function updatePagination() {
    const totalItems = sortedBills.length;
    const totalPages = getTotalPages();
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    // Update pagination info
    paginationInfo.textContent = `Showing ${startItem} to ${endItem} of ${totalItems} bills`;

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
      pageNum === currentPage ? 'bg-orange-500 text-white border-orange-500' : 'bg-white'
    }`;
    button.addEventListener('click', () => goToPage(pageNum));
    pageNumbers.appendChild(button);
  }

  function goToPage(page) {
    currentPage = page;
    renderBills();
    updatePagination();
  }

  // Show bill details in modal
  async function showBillDetails(billId) {
    try {
      const response = await fetch(`/api/inventory/sales/bills/${billId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load bill details');
      }

      const billData = await response.json();
      console.log('Bill details received:', billData);

      // Handle different response structures
      const bill = billData.success ? billData.data : billData;

      // Populate modal with bill data
      modalBillNo.textContent = bill.bno || '';
      modalBillDate.textContent = formatDate(bill.bdate);
      modalBillType.textContent = bill.btype || 'SALES';
      modalBillStatus.textContent = bill.status || 'ACTIVE';

      modalPartyName.textContent = bill.firm || '';
      modalPartyGstin.textContent = bill.gstin || 'UNREGISTERED';
      modalPartyAddress.textContent = bill.addr || '';
      modalPartyState.textContent = bill.state || '';

      // Populate items table
      modalItemsBody.innerHTML = '';
      if (bill.items && bill.items.length > 0) {
        bill.items.forEach(item => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.item || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.batch || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">${item.qty || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">₹${(item.rate || 0).toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">₹${(item.total || 0).toFixed(2)}</td>
          `;
          modalItemsBody.appendChild(row);
        });
      } else {
        modalItemsBody.innerHTML = `
          <tr>
            <td colspan="5" class="px-6 py-4 text-center text-gray-500">No items found</td>
          </tr>
        `;
      }

      // Populate summary
      const taxableAmount = bill.gtot || 0;
      const taxAmount = (bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0);
      const grandTotal = bill.ntot || 0;

      modalTaxableAmount.textContent = `₹${taxableAmount.toFixed(2)}`;
      modalTaxAmount.textContent = `₹${taxAmount.toFixed(2)}`;
      modalGrandTotal.textContent = `₹${grandTotal.toFixed(2)}`;

      // Tax breakdown
      modalCgst.textContent = `₹${(bill.cgst || 0).toFixed(2)}`;
      modalSgst.textContent = `₹${(bill.sgst || 0).toFixed(2)}`;
      modalIgst.textContent = `₹${(bill.igst || 0).toFixed(2)}`;

      // Other charges
      if (bill.otherCharges && bill.otherCharges.length > 0) {
        otherChargesSection.classList.remove('hidden');
        otherChargesList.innerHTML = '';
        bill.otherCharges.forEach(charge => {
          const chargeDiv = document.createElement('div');
          chargeDiv.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg';
          chargeDiv.innerHTML = `
            <span class="text-sm font-medium text-gray-700">${charge.name || charge.type}</span>
            <span class="text-sm font-bold text-gray-900">₹${(charge.amount || 0).toFixed(2)}</span>
          `;
          otherChargesList.appendChild(chargeDiv);
        });
      } else {
        otherChargesSection.classList.add('hidden');
      }

      // Show modal
      modal.classList.remove('hidden');
      modal.setAttribute('data-current-bill-id', billId);

      // Handle cancel button visibility based on bill status
      if (bill.status === 'CANCELLED') {
        cancelBillBtn.disabled = true;
        cancelBillBtn.classList.add('opacity-50', 'cursor-not-allowed');
        cancelBillBtn.textContent = 'Bill Already Cancelled';
      } else {
        cancelBillBtn.disabled = false;
        cancelBillBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        cancelBillBtn.textContent = 'Cancel Bill';
      }

      // Reset cancel form when opening modal
      resetCancelForm();

    } catch (error) {
      console.error('Error loading bill details:', error);
      alert('Failed to load bill details. Please try again.');
    }
  }

  // Close modal
  function closeModal() {
    modal.classList.add('hidden');
    // Reset cancel form when closing modal
    resetCancelForm();
  }

  // Print bill (placeholder)
  function printBill() {
    window.print();
  }

  // Download PDF (calls the server endpoint)
  function downloadPdf(billId) {
    try {
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = `/api/inventory/sales/bills/${billId}/pdf`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      // Add authorization header by using fetch first
      fetch(`/api/inventory/sales/bills/${billId}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }).then(response => {
        if (response.ok) {
          // Create blob URL for download
          response.blob().then(blob => {
            const url = window.URL.createObjectURL(blob);
            link.href = url;
            link.download = `Invoice_${billId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          });
        } else {
          console.error('PDF download failed:', response.status, response.statusText);
          alert('Failed to download PDF. Please try again.');
        }
      }).catch(error => {
        console.error('PDF download error:', error);
        alert('Failed to download PDF. Please check your connection and try again.');
      });
    } catch (error) {
      console.error('PDF download error:', error);
      alert('Failed to download PDF. Please try again.');
    }
  }

  // Cancel bill functionality
  async function cancelBill(billId) {
    const reason = cancelReasonSelect.value;
    const remarks = cancelRemarksTextarea.value.trim();

    if (!reason) {
      alert('Please select a cancellation reason.');
      cancelReasonSelect.focus();
      return;
    }

    if (!confirm('Are you sure you want to cancel this bill? This action cannot be undone.')) {
      return;
    }

    try {
      confirmCancelBtn.disabled = true;
      confirmCancelBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Cancelling...
      `;

      const response = await fetch(`/api/inventory/sales/bills/${billId}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          reason: reason,
          remarks: remarks
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel bill');
      }

      const result = await response.json();

      // Update modal status
      modalBillStatus.textContent = 'CANCELLED';
      modalBillStatus.className = 'mt-1 text-sm text-red-600 font-semibold';

      // Disable cancel button
      cancelBillBtn.disabled = true;
      cancelBillBtn.classList.add('opacity-50', 'cursor-not-allowed');
      cancelBillBtn.textContent = 'Bill Cancelled';

      // Hide cancel section
      cancelBillSection.classList.add('hidden');

      // Show success message
      alert('Bill cancelled successfully.');

      // Refresh the bills list
      await loadBills();

    } catch (error) {
      console.error('Error cancelling bill:', error);
      alert('Failed to cancel bill: ' + error.message);
    } finally {
      confirmCancelBtn.disabled = false;
      confirmCancelBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Confirm Cancellation
      `;
    }
  }

  // Toggle cancel form visibility
  function toggleCancelSection() {
    const isHidden = cancelFormContent.classList.contains('hidden');

    if (isHidden) {
      cancelFormContent.classList.remove('hidden');
      cancelSectionToggle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      `;
    } else {
      cancelFormContent.classList.add('hidden');
      cancelSectionToggle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      `;
    }
  }

  // Reset cancel form
  function resetCancelForm() {
    cancelReasonSelect.value = '';
    cancelRemarksTextarea.value = '';
    cancelFormContent.classList.add('hidden');
    cancelBillSection.classList.add('hidden');
  }

  // Render bills table
  function renderBills() {
    const paginatedBills = getPaginatedBills();

    if (paginatedBills.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="px-6 py-4 text-center text-gray-500">
            <div class="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
              No bills found matching your criteria.
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = paginatedBills.map(bill => {
      const taxableAmount = bill.gtot || 0;
      const taxAmount = (bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0);
      const totalAmount = bill.ntot || 0;
      const status = bill.status || 'ACTIVE';
      const statusClass = status === 'CANCELLED' ? 'text-red-600 bg-red-100' : 'text-green-600 bg-green-100';

      return `
        <tr class="hover:bg-lime-100" data-bill-id="${bill.id}">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${bill.bno || ''}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(bill.bdate)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${bill.firm || ''}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${bill.btype || 'SALES'}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">₹${taxableAmount.toFixed(2)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">₹${taxAmount.toFixed(2)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">₹${totalAmount.toFixed(2)}</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
              ${status}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <button class="bill-view-btn group relative inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 rounded-md shadow-sm hover:shadow-md hover:shadow-blue-500/25 transform hover:scale-105 transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-blue-500/30 active:scale-95 overflow-hidden" data-bill-id="${bill.id}">
              <!-- Animated background gradient on hover -->
              <div class="absolute inset-0 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out rounded-md"></div>
              
              <!-- Icon with animation -->
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 mr-1.5 relative z-10 transform group-hover:rotate-12 transition-transform duration-300 ease-out drop-shadow-sm">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              
              <!-- Text with glow effect -->
              <span class="relative z-10 tracking-wide drop-shadow-sm group-hover:drop-shadow-md transition-all duration-300">View</span>
              
              <!-- Subtle shine effect -->
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-700 ease-out rounded-md"></div>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update summary statistics
  function updateSummary() {
    const totalBills = filteredBills.length;
    const activeBills = filteredBills.filter(bill => bill.status !== 'CANCELLED').length;

    const totalRevenue = filteredBills
      .filter(bill => bill.status !== 'CANCELLED')
      .reduce((sum, bill) => sum + (bill.ntot || 0), 0);

    const totalTax = filteredBills
      .filter(bill => bill.status !== 'CANCELLED')
      .reduce((sum, bill) => sum + ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)), 0);

    billsCount.textContent = totalBills;
    totalBillsEl.textContent = totalBills;
    totalRevenueEl.textContent = `₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    totalTaxEl.textContent = `₹${totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    activeBillsEl.textContent = activeBills;
  }

  // Filter bills
  function filterBills() {
    const searchTerm = searchInput.value.toLowerCase();
    const typeFilterValue = typeFilter.value;
    const dateFrom = dateFromFilter.value;
    const dateTo = dateToFilter.value;

    filteredBills = allBills.filter(bill => {
      // Search filter
      const matchesSearch = !searchTerm ||
        (bill.bno || '').toLowerCase().includes(searchTerm) ||
        (bill.firm || '').toLowerCase().includes(searchTerm);

      // Type filter
      const matchesType = !typeFilterValue || bill.btype === typeFilterValue;

      // Date filter
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const billDate = new Date(bill.bdate);
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          matchesDate = matchesDate && billDate >= fromDate;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999); // End of day
          matchesDate = matchesDate && billDate <= toDate;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });

    sortedBills = [...filteredBills];

    // Apply current sorting
    if (sortColumn) {
      sortBills(sortColumn, sortDirection);
    } else {
      currentPage = 1;
      renderBills();
      updateSummary();
      updatePagination();
    }
  }

  // Export to CSV
  function exportToCSV() {
    if (filteredBills.length === 0) {
      alert('No bills to export');
      return;
    }

    const csvContent = [
      ['Bill No', 'Date', 'Party', 'Type', 'Taxable Amount', 'Tax Amount', 'Total Amount', 'Status'],
      ...filteredBills.map(bill => [
        bill.bno || '',
        formatDate(bill.bdate),
        bill.firm || '',
        bill.btype || 'SALES',
        (bill.gtot || 0).toFixed(2),
        ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)).toFixed(2),
        (bill.ntot || 0).toFixed(2),
        bill.status || 'ACTIVE'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bills-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
  searchInput.addEventListener('input', filterBills);
  typeFilter.addEventListener('change', filterBills);
  dateFromFilter.addEventListener('change', filterBills);
  dateToFilter.addEventListener('change', filterBills);
  refreshBtn.addEventListener('click', loadBills);
  exportBtn.addEventListener('click', exportToCSV);

  // Sorting event listeners
  document.querySelectorAll('th[data-sort]').forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.sort;
      const newDirection = (sortColumn === column && sortDirection === 'asc') ? 'desc' : 'asc';
      sortBills(column, newDirection);
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
    renderBills();
    updatePagination();
  });

  // Initialize sort icons
  updateSortIcons();

  // Event listeners for modal functionality (using event delegation for CSP compliance)
  tableBody.addEventListener('click', (e) => {
    if (e.target.classList.contains('bill-view-btn') || e.target.closest('.bill-view-btn')) {
      const button = e.target.classList.contains('bill-view-btn') ? e.target : e.target.closest('.bill-view-btn');
      const billId = button.getAttribute('data-bill-id');
      if (billId) {
        showBillDetails(billId);
      }
    }
  });

  // Modal close event listeners
  closeModalBtn.addEventListener('click', closeModal);
  closeModalBottomBtn.addEventListener('click', closeModal);

  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Modal action buttons
  printBillBtn.addEventListener('click', () => printBill());
  downloadPdfBtn.addEventListener('click', () => {
    // Get current bill ID from modal data attribute
    const billId = modal.getAttribute('data-current-bill-id');
    if (billId) {
      downloadPdf(billId);
    } else {
      alert('No bill selected for PDF download.');
    }
  });
  editBillBtn.addEventListener('click', () => {
    const billId = modal.getAttribute('data-current-bill-id');
    if (billId) {
      sessionStorage.setItem('editBillId', billId);
      router.navigate('/inventory/sls');
    } else {
      alert('No bill selected for editing.');
    }
  });

  // Cancel bill event listeners
  cancelBillBtn.addEventListener('click', () => {
    const billId = modal.getAttribute('data-current-bill-id');
    if (billId) {
      cancelBillSection.classList.remove('hidden');
      cancelReasonSelect.focus();
    }
  });

  cancelSectionToggle.addEventListener('click', toggleCancelSection);

  confirmCancelBtn.addEventListener('click', () => {
    const billId = modal.getAttribute('data-current-bill-id');
    if (billId) {
      cancelBill(billId);
    }
  });

  cancelCancelBtn.addEventListener('click', () => {
    cancelBillSection.classList.add('hidden');
    resetCancelForm();
  });

  // Initial load
  loadBills();
}
