import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authManager } from '../utils/auth.js';

export async function renderSuperAdmin(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const user = authManager.getUser();

  if (user.role !== 'super_admin') {
    const content = `
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">Super Admin Panel</h1>
        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl text-sm">
          Access denied. Super admin privileges required.
        </div>
      </div>
    `;
    renderLayout(content, router);
    return;
  }

  const content = `
    <div class="max-w-5xl mx-auto px-4 py-10 space-y-10">

      <!-- Page Header -->
      <div>
        <h1 class="text-3xl font-bold text-gray-900 tracking-tight">Super Admin Panel</h1>
        <p class="text-gray-500 mt-1">Manage firms, users, and system administration</p>
      </div>

      <!-- Super Admin Stats -->
      <section class="space-y-4">
        <h2 class="text-lg font-semibold text-gray-800">System Statistics</h2>
        <div id="super-admin-stats" class="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
            <div class="text-2xl font-bold text-blue-600" id="user-count">-</div>
            <div class="text-sm text-gray-500">Total Users</div>
          </div>
          <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
            <div class="text-2xl font-bold text-green-600" id="firm-count">-</div>
            <div class="text-sm text-gray-500">Total Firms</div>
          </div>
          <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
            <div class="text-2xl font-bold text-purple-600" id="approved-users">-</div>
            <div class="text-sm text-gray-500">Approved Users</div>
          </div>
          <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
            <div class="text-2xl font-bold text-orange-600" id="pending-users">-</div>
            <div class="text-sm text-gray-500">Pending Users</div>
          </div>
          <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
            <div class="text-2xl font-bold text-red-600" id="rejected-users">-</div>
            <div class="text-sm text-gray-500">Rejected Users</div>
          </div>
        </div>
      </section>

      <!-- Admin Panel -->
      <div class="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

        <!-- Tabs -->
        <div class="border-b border-gray-200 bg-gray-50">
          <nav class="flex px-1">
            <button id="firm-management-tab"
                    class="admin-tab px-5 py-3 text-sm font-semibold border-b-2 border-blue-500 text-blue-600">
              Firm Management
            </button>
            <button id="user-assignment-tab"
                    class="admin-tab px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent">
              User Assignment
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="p-6">
          <div id="firm-management-content" class="admin-content"></div>
          <div id="user-assignment-content" class="admin-content hidden"></div>
        </div>
      </div>
    </div>
  `;

  renderLayout(content, router);

  // Fetch and display super admin stats
  fetch('/api/admin/super-admin/stats', { credentials: 'same-origin' })
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    })
    .then(data => {
      document.getElementById('user-count').textContent = data.userCount || 0;
      document.getElementById('firm-count').textContent = data.firmCount || 0;
      document.getElementById('approved-users').textContent = data.approvedUsers || 0;
      document.getElementById('pending-users').textContent = data.pendingUsers || 0;
      document.getElementById('rejected-users').textContent = data.rejectedUsers || 0;
    })
    .catch(err => {
      console.error('Error fetching super admin stats:', err);
    });

  initializeAdminComponents();
  setupAdminTabs();
}

/* ── Admin Initialization ────────────────────────────────────────────── */

async function initializeAdminComponents() {
  try {
    const [fmMod, ufaMod, modalMod, detailsMod] = await Promise.all([
      import('../components/admin/firmManager.js'),
      import('../components/admin/userFirmAssignment.js'),
      import('../components/admin/firmModal.js'),
      import('../components/admin/firmDetails.js'),
    ]);

    // Modal must be created first (it appends to body)
    window.firmModal = new modalMod.FirmModal();

    // FIX: FirmDetails is rendered INTO the firm-management-content container
    //      (not a separate container that may not exist).
    window.firmDetails = new detailsMod.FirmDetails('firm-management-content');

    // FirmManager renders into firm-management-content
    window.firmManager = new fmMod.FirmManager('firm-management-content');

    // UserFirmAssignment renders into user-assignment-content
    new ufaMod.UserFirmAssignment('user-assignment-content');

  } catch (error) {
    console.error('Error initializing admin components:', error);
    const el = document.getElementById('firm-management-content');
    if (el) {
      el.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-gray-400">
          <svg class="w-12 h-12 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-base font-semibold text-gray-600">Failed to load admin panel</p>
          <p class="text-sm mt-1">Refresh the page and try again.</p>
        </div>
      `;
    }
  }
}

function setupAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const contents = document.querySelectorAll('.admin-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('border-blue-500', 'text-blue-600');
        t.classList.add('text-gray-500', 'border-transparent');
      });
      contents.forEach(c => c.classList.add('hidden'));

      tab.classList.add('border-blue-500', 'text-blue-600');
      tab.classList.remove('text-gray-500', 'border-transparent');

      const targetId = tab.id.replace('-tab', '-content');
      document.getElementById(targetId)?.classList.remove('hidden');
    });
  });
}
