import { toast } from './toast.js';

export class UserFirmAssignment {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.users = [];
    this.firms = [];
    this.filteredUsers = [];
    this.searchTerm = '';
    this.selectedFirmFilter = '';

    this.init();
  }

  async init() {
    await this.loadData();
    this.render();
  }

  async loadData() {
    try {
      const [usersRes, firmsRes] = await Promise.all([
        fetch('/api/admin/users-with-firms', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }),
        fetch('/api/admin/firms',             { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }),
      ]);

      if (!usersRes.ok || !firmsRes.ok) throw new Error('Failed to load data');

      const [usersData, firmsData] = await Promise.all([usersRes.json(), firmsRes.json()]);

      this.users = usersData.users || [];
      this.firms = firmsData.firms || [];
      this.applyFilters();
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load user and firm data: ' + error.message);
    }
  }

  applyFilters() {
    let filtered = [...this.users];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.fullname.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term),
      );
    }

    if (this.selectedFirmFilter === 'unassigned') {
      filtered = filtered.filter(u => !u.firm_id);
    } else if (this.selectedFirmFilter) {
      filtered = filtered.filter(u => String(u.firm_id) === this.selectedFirmFilter);
    }

    this.filteredUsers = filtered;
  }

  async assignUserToFirm(userId, firmId) {
    try {
      const response = await fetch('/api/admin/assign-user-to-firm', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, firmId }),   // firmId can be null to unassign
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      toast.success(data.message || 'Assignment updated successfully');

      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Error assigning user to firm:', error);
      toast.error('Failed to update assignment: ' + error.message);
    }
  }

  /* ── RENDER ─────────────────────────────────────────────────────── */

  render() {
    if (!this.container) return;

    const assigned   = this.users.filter(u => u.firm_id).length;
    const unassigned = this.users.filter(u => !u.firm_id).length;

    const roleBadge = (role) => {
      const map = {
        super_admin: 'bg-purple-100 text-purple-800',
        admin:       'bg-blue-100   text-blue-800',
        manager:     'bg-indigo-100 text-indigo-800',
        user:        'bg-gray-100   text-gray-700',
      };
      return map[role] || 'bg-gray-100 text-gray-700';
    };

    this.container.innerHTML = `
      <div class="user-firm-assignment space-y-6">

        <!-- Header -->
        <div>
          <h2 class="text-2xl font-bold text-gray-900 tracking-tight">User–Firm Assignment</h2>
          <p class="text-sm text-gray-500 mt-0.5">Assign or reassign users to firms</p>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-3 gap-3">
          ${[
            { label: 'Total Users',  value: this.users.length, color: 'blue'   },
            { label: 'Assigned',     value: assigned,          color: 'emerald'},
            { label: 'Unassigned',   value: unassigned,        color: 'amber'  },
          ].map(s => `
            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">${s.label}</p>
              <p class="text-2xl font-bold text-${s.color}-600 mt-1">${s.value}</p>
            </div>
          `).join('')}
        </div>

        <!-- Filters -->
        <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row gap-3">
          <div class="relative flex-1">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
            </svg>
            <input id="user-search" type="text"
                   placeholder="Search by name, username, or email…"
                   value="${this.searchTerm}"
                   class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg
                          focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"/>
          </div>
          <select id="firm-filter"
                  class="text-sm border border-gray-300 rounded-lg px-3 py-2
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
            <option value="">All Users</option>
            <option value="unassigned" ${this.selectedFirmFilter === 'unassigned' ? 'selected' : ''}>Unassigned Only</option>
            ${this.firms.map(f => `
              <option value="${f._id}" ${this.selectedFirmFilter === String(f._id) ? 'selected' : ''}>${f.name}</option>
            `).join('')}
          </select>
        </div>

        <!-- Table -->
        <div class="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Firm</th>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Assign To</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${this.filteredUsers.length === 0 ? `
                  <tr>
                    <td colspan="4" class="px-5 py-16 text-center">
                      <div class="flex flex-col items-center text-gray-400">
                        <svg class="w-12 h-12 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        <p class="font-medium text-gray-600">No users found</p>
                        <p class="text-xs mt-1">Try adjusting your search or filter.</p>
                      </div>
                    </td>
                  </tr>
                ` : this.filteredUsers.map(user => `
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-5 py-3.5">
                      <div class="flex items-center gap-3">
                        <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600
                                    flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span class="text-white font-bold text-xs">${user.fullname.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p class="font-semibold text-gray-900 leading-tight">${user.fullname}</p>
                          <p class="text-xs text-gray-500">@${user.username} · ${user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-5 py-3.5">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${roleBadge(user.role)}">
                        ${user.role}
                      </span>
                    </td>
                    <td class="px-5 py-3.5">
                      ${user.firm_name ? `
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 ring-1 ring-blue-200 ring-inset">
                          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clip-rule="evenodd"/>
                          </svg>
                          ${user.firm_name}
                        </span>
                      ` : `
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 ring-1 ring-gray-200 ring-inset">
                          Not Assigned
                        </span>
                      `}
                    </td>
                    <td class="px-5 py-3.5">
                      <div class="flex items-center gap-2">
                        <select class="assign-firm-select text-sm border border-gray-300 rounded-lg px-2.5 py-1.5
                                       focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none
                                       min-w-[160px]" data-user-id="${user._id}">
                          <option value="">— Select —</option>
                          <option value="unassign" ${!user.firm_id ? 'selected' : ''}>Remove from Firm</option>
                          ${this.firms.map(f => `
                            <option value="${f._id}" ${String(user.firm_id) === String(f._id) ? 'selected' : ''}>${f.name}</option>
                          `).join('')}
                        </select>
                        <button class="assign-btn inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold
                                       text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg
                                       transition-colors shadow-sm" data-user-id="${user._id}">
                          Apply
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    this.attachEventListeners();
  }

  /* ── EVENT LISTENERS ────────────────────────────────────────────── */

  attachEventListeners() {
    document.getElementById('user-search')?.addEventListener('input', (e) => {
      this.searchTerm = e.target.value;
      this.applyFilters();
      this.render();
    });

    document.getElementById('firm-filter')?.addEventListener('change', (e) => {
      this.selectedFirmFilter = e.target.value;
      this.applyFilters();
      this.render();
    });

    // Assign buttons (event delegation)
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('.assign-btn');
      if (!btn) return;

      e.preventDefault();
      const userId = btn.dataset.userId;
      const select = btn.closest('td')?.querySelector('.assign-firm-select');
      const firmId = select?.value;

      if (!firmId) {
        toast.warning('Please select a firm first');
        return;
      }

      this.assignUserToFirm(userId, firmId === 'unassign' ? null : firmId);
    });
  }
}