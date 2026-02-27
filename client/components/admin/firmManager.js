import { toast } from './toast.js';

export class FirmManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.firms = [];
    this.filteredFirms = [];   // FIX: initialize so getCurrentPageFirms() never crashes
    this.currentPage = 1;
    this.pageSize = 10;
    this.totalPages = 1;
    this.searchTerm = '';
    this.sortField = 'createdAt';
    this.sortOrder = 'desc';

    this.init();
  }

  async init() {
    await this.loadFirms();
  }

  async loadFirms() {
    try {
      const response = await fetch('/api/admin/firms', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data.firms) throw new Error(data.error || 'Failed to load firms');

      this.firms = data.firms;
      this.applyFilters();
    } catch (error) {
      console.error('Error loading firms:', error);
      toast.error('Failed to load firms: ' + error.message);
    }

    // FIX: always render (and re-attach listeners) after data loads
    this.render();
  }

  applyFilters() {
    let filtered = [...this.firms];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(firm =>
        firm.name.toLowerCase().includes(term) ||
        (firm.legal_name && firm.legal_name.toLowerCase().includes(term)) ||
        (firm.city && firm.city.toLowerCase().includes(term)) ||
        (firm.email && firm.email.toLowerCase().includes(term)),
      );
    }

    filtered.sort((a, b) => {
      const aVal = a[this.sortField] ?? '';
      const bVal = b[this.sortField] ?? '';
      return this.sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    this.filteredFirms = filtered;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredFirms.length / this.pageSize);
    this.currentPage = Math.min(this.currentPage, this.totalPages || 1);
  }

  getCurrentPageFirms() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredFirms.slice(start, start + this.pageSize);
  }

  /* ── API CALLS ─────────────────────────────────────────────────────── */

  async createFirm(firmData) {
    try {
      const response = await fetch('/api/admin/firms', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firmData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      toast.success(data.message || 'Firm created successfully');
      await this.loadFirms();
      return true;
    } catch (error) {
      console.error('Error creating firm:', error);
      toast.error('Failed to create firm: ' + error.message);
      return false;
    }
  }

  async updateFirm(id, firmData) {
    try {
      const response = await fetch(`/api/admin/firms/${id}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firmData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      toast.success(data.message || 'Firm updated successfully');
      await this.loadFirms();
      return true;
    } catch (error) {
      console.error('Error updating firm:', error);
      toast.error('Failed to update firm: ' + error.message);
      return false;
    }
  }

  async deleteFirm(id) {
    if (!confirm('Are you sure you want to delete this firm? This action cannot be undone.')) return false;

    try {
      const response = await fetch(`/api/admin/firms/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      toast.success(data.message || 'Firm deleted successfully');
      await this.loadFirms();
      return true;
    } catch (error) {
      console.error('Error deleting firm:', error);
      toast.error('Failed to delete firm: ' + error.message);
      return false;
    }
  }

  /* ── RENDER ────────────────────────────────────────────────────────── */

  render() {
    if (!this.container) return;

    const currentFirms = this.getCurrentPageFirms();
    const approved  = this.firms.filter(f => f.status === 'approved').length;
    const pending   = this.firms.filter(f => f.status === 'pending').length;
    const suspended = this.firms.filter(f => f.status === 'suspended' || f.status === 'rejected').length;

    const statusBadge = (status) => {
      const map = {
        approved:  'bg-emerald-100 text-emerald-800 ring-emerald-200',
        pending:   'bg-amber-100 text-amber-800 ring-amber-200',
        rejected:  'bg-red-100 text-red-800 ring-red-200',
        suspended: 'bg-red-100 text-red-800 ring-red-200',
      };
      return map[status] || 'bg-gray-100 text-gray-700 ring-gray-200';
    };

    this.container.innerHTML = `
      <div class="firm-management space-y-6">

        <!-- Header Row -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 tracking-tight">Firm Management</h2>
            <p class="text-sm text-gray-500 mt-0.5">${this.firms.length} firm${this.firms.length !== 1 ? 's' : ''} registered</p>
          </div>
          <button
            id="create-firm-btn"
            class="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                   text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:outline-none
                   focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            New Firm
          </button>
        </div>

        <!-- Stats Strip -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${[
            { label: 'Total',     value: this.firms.length, color: 'blue'   },
            { label: 'Approved',  value: approved,          color: 'emerald'},
            { label: 'Pending',   value: pending,           color: 'amber'  },
            { label: 'Suspended', value: suspended,         color: 'red'    },
          ].map(s => `
            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">${s.label}</p>
              <p class="text-2xl font-bold text-${s.color}-600 mt-1">${s.value}</p>
            </div>
          `).join('')}
        </div>

        <!-- Search + Sort Bar -->
        <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row gap-3">
          <div class="relative flex-1">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
            </svg>
            <input
              id="firm-search"
              type="text"
              placeholder="Search by name, city, or email…"
              value="${this.searchTerm}"
              class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div class="flex gap-2">
            <select id="sort-field"
                    class="text-sm border border-gray-300 rounded-lg px-3 py-2
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
              <option value="createdAt" ${this.sortField === 'createdAt' ? 'selected' : ''}>Date Added</option>
              <option value="name"      ${this.sortField === 'name'      ? 'selected' : ''}>Name</option>
              <option value="city"      ${this.sortField === 'city'      ? 'selected' : ''}>City</option>
              <option value="status"    ${this.sortField === 'status'    ? 'selected' : ''}>Status</option>
            </select>
            <select id="sort-order"
                    class="text-sm border border-gray-300 rounded-lg px-3 py-2
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
              <option value="desc" ${this.sortOrder === 'desc' ? 'selected' : ''}>Newest first</option>
              <option value="asc"  ${this.sortOrder === 'asc'  ? 'selected' : ''}>Oldest first</option>
            </select>
          </div>
        </div>

        <!-- Firms Table -->
        <div class="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Firm</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Business</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                  <th class="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${currentFirms.length === 0 ? `
                  <tr>
                    <td colspan="6" class="px-5 py-16 text-center">
                      <div class="flex flex-col items-center text-gray-400">
                        <svg class="w-12 h-12 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"/>
                        </svg>
                        <p class="font-medium text-gray-600">No firms found</p>
                        <p class="text-sm mt-1">${this.searchTerm ? 'Try a different search term.' : 'Get started by creating your first firm.'}</p>
                      </div>
                    </td>
                  </tr>
                ` : currentFirms.map(firm => `
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-5 py-4">
                      <div class="flex items-center gap-3">
                        <div class="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600
                                    flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span class="text-white font-bold text-sm">${firm.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p class="font-semibold text-gray-900 leading-tight">${firm.name}</p>
                          ${firm.legal_name ? `<p class="text-xs text-gray-500 mt-0.5">${firm.legal_name}</p>` : ''}
                        </div>
                      </div>
                    </td>
                    <td class="px-5 py-4">
                      <p class="text-gray-700">${firm.city ? `${firm.city}${firm.state ? `, ${firm.state}` : ''}` : '—'}</p>
                      ${firm.email ? `<p class="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">${firm.email}</p>` : ''}
                      ${firm.phone_number ? `<p class="text-xs text-gray-500">${firm.phone_number}</p>` : ''}
                    </td>
                    <td class="px-5 py-4">
                      <p class="text-gray-700">${firm.business_type || '—'}</p>
                      ${firm.industry_type ? `<p class="text-xs text-gray-500 mt-0.5">${firm.industry_type}</p>` : ''}
                      ${firm.employee_count ? `<p class="text-xs text-gray-500">${firm.employee_count} employees</p>` : ''}
                    </td>
                    <td class="px-5 py-4">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                                   ring-1 ring-inset ${statusBadge(firm.status)}">
                        ${firm.status || 'N/A'}
                      </span>
                    </td>
                    <td class="px-5 py-4 text-gray-500 whitespace-nowrap">
                      ${firm.createdAt ? new Date(firm.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td class="px-5 py-4">
                      <div class="flex items-center justify-end gap-1">
                        <button title="View details"
                                class="view-firm-btn p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50
                                       rounded-md transition-colors" data-id="${firm._id}">
                          <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                        </button>
                        <button title="Edit firm"
                                class="edit-firm-btn p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                                       rounded-md transition-colors" data-id="${firm._id}">
                          <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button title="Delete firm"
                                class="delete-firm-btn p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50
                                       rounded-md transition-colors" data-id="${firm._id}">
                          <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          ${this.renderPagination()}
        </div>

      </div>
    `;

    // FIX: always re-attach event listeners after every render
    this.attachEventListeners();
  }

  renderPagination() {
    if (this.totalPages <= 1) return '';

    const pages = [];
    const start = Math.max(1, this.currentPage - 2);
    const end   = Math.min(this.totalPages, this.currentPage + 2);

    if (start > 1) {
      pages.push(`<button class="pagination-btn px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50" data-page="1">1</button>`);
      if (start > 2) pages.push(`<span class="px-2 text-gray-400">…</span>`);
    }

    for (let i = start; i <= end; i++) {
      pages.push(`
        <button class="pagination-btn px-3 py-1.5 text-xs font-medium border rounded transition-colors
                       ${i === this.currentPage
                           ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                           : 'text-gray-600 bg-white border-gray-300 hover:bg-gray-50'}"
                data-page="${i}">${i}</button>
      `);
    }

    if (end < this.totalPages) {
      if (end < this.totalPages - 1) pages.push(`<span class="px-2 text-gray-400">…</span>`);
      pages.push(`<button class="pagination-btn px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50" data-page="${this.totalPages}">${this.totalPages}</button>`);
    }

    return `
      <div class="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600 bg-gray-50">
        <span>
          Showing ${Math.min((this.currentPage - 1) * this.pageSize + 1, this.filteredFirms.length)}–${Math.min(this.currentPage * this.pageSize, this.filteredFirms.length)}
          of ${this.filteredFirms.length}
        </span>
        <div class="flex items-center gap-1">
          <button class="pagination-prev px-2.5 py-1.5 text-gray-500 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  ${this.currentPage <= 1 ? 'disabled' : ''}>‹</button>
          ${pages.join('')}
          <button class="pagination-next px-2.5 py-1.5 text-gray-500 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  ${this.currentPage >= this.totalPages ? 'disabled' : ''}>›</button>
        </div>
      </div>
    `;
  }

  /* ── EVENT LISTENERS ───────────────────────────────────────────────── */
  // FIX: called at the end of every render() so fresh DOM always has listeners

  attachEventListeners() {
    // Create button
    document.getElementById('create-firm-btn')?.addEventListener('click', () => this.showCreateFirmModal());

    // Search
    document.getElementById('firm-search')?.addEventListener('input', (e) => {
      this.searchTerm = e.target.value;
      this.currentPage = 1;
      this.applyFilters();
      this.render();
    });

    // Sort field
    document.getElementById('sort-field')?.addEventListener('change', (e) => {
      this.sortField = e.target.value;
      this.currentPage = 1;
      this.applyFilters();
      this.render();
    });

    // Sort order
    document.getElementById('sort-order')?.addEventListener('change', (e) => {
      this.sortOrder = e.target.value;
      this.currentPage = 1;
      this.applyFilters();
      this.render();
    });

    // Table row actions + pagination via event delegation
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const firmId = btn.dataset.id;

      if (btn.classList.contains('view-firm-btn')) {
        e.preventDefault(); this.showFirmDetails(firmId);
      } else if (btn.classList.contains('edit-firm-btn')) {
        e.preventDefault(); this.showEditFirmModal(firmId);
      } else if (btn.classList.contains('delete-firm-btn')) {
        e.preventDefault(); this.deleteFirm(firmId);
      } else if (btn.classList.contains('pagination-btn')) {
        const page = parseInt(btn.dataset.page, 10);
        if (page && page !== this.currentPage) { this.currentPage = page; this.render(); }
      } else if (btn.classList.contains('pagination-prev')) {
        if (this.currentPage > 1) { this.currentPage--; this.render(); }
      } else if (btn.classList.contains('pagination-next')) {
        if (this.currentPage < this.totalPages) { this.currentPage++; this.render(); }
      }
    });
  }

  /* ── MODAL HELPERS ─────────────────────────────────────────────────── */

  showCreateFirmModal() {
    if (window.firmModal) window.firmModal.showCreateMode();
    else console.error('FirmModal not available');
  }

  showEditFirmModal(firmId) {
    if (window.firmModal && firmId) window.firmModal.showEditMode(firmId);
    else console.error('FirmModal not available or missing firm ID');
  }

  showFirmDetails(firmId) {
    if (window.firmDetails && firmId) window.firmDetails.showFirmDetails(firmId);
    else console.error('FirmDetails not available or missing firm ID');
  }
}