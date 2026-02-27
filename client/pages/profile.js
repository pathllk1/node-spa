import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { fetchWithCSRF } from '../utils/api.js';
import { authManager } from '../utils/auth.js';
import { UserCreator } from '../components/admin/userCreator.js';

export async function renderProfile(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const user        = authManager.getUser();
  const isSuperAdmin = user.role === 'super_admin';
  const userCreator = user.role === 'admin' ? new UserCreator() : null;

  try {
    const [profileRes, settingsRes] = await Promise.all([
      fetch('/api/pages/profile',                          { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }),
      fetch('/api/settings/system-config/gst-status',     { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }),
    ]);

    if (!profileRes.ok) throw new Error(`HTTP ${profileRes.status}`);
    const profileData = await profileRes.json();
    if (!profileData.success) throw new Error(profileData.error || 'Failed to fetch profile data');

    let gstEnabled = true;
    if (settingsRes.ok) {
      const s = await settingsRes.json();
      if (s.success) gstEnabled = s.data?.gst_enabled ?? true;
    }

    const content = `
      <div class="max-w-5xl mx-auto px-4 py-10 space-y-10">

        <!-- Page Header -->
        <div>
          <h1 class="text-3xl font-bold text-gray-900 tracking-tight">Profile</h1>
          <p class="text-gray-500 mt-1">Manage your account settings and preferences</p>
        </div>

        <!-- User Information -->
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800">User Information</h2>
          <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm grid md:grid-cols-2 gap-5">
            ${createInput('User ID',  user.id)}
            ${createInput('Username', user.username)}
            ${createInput('Email',    user.email)}
            ${createInput('Role',     user.role)}
          </div>
        </section>

        <!-- Preferences -->
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800">Preferences</h2>
          <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm grid md:grid-cols-3 gap-5">
            ${createInput('Theme',         profileData.data?.preferences?.theme         || 'light')}
            ${createInput('Notifications', profileData.data?.preferences?.notifications  ? 'Enabled' : 'Disabled')}
            ${createInput('Language',      profileData.data?.preferences?.language       || 'en')}
          </div>
        </section>

        <!-- Account Information -->
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800">Account Information</h2>
          <div class="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-2 text-sm text-gray-700">
            <p><span class="font-medium text-gray-600">Member Since:</span> ${profileData.data?.accountInfo?.memberSince || 'N/A'}</p>
            <p><span class="font-medium text-gray-600">Last Password Change:</span> ${profileData.data?.accountInfo?.lastPasswordChange || 'N/A'}</p>
            <p><span class="font-medium text-gray-600">Two-Factor Authentication:</span>
              ${profileData.data?.accountInfo?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </section>

        <!-- System Settings -->
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800">System Settings</h2>
          <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-gray-800">GST Calculation</h3>
                <p class="text-xs text-gray-500 mt-0.5">Enable or disable GST in invoices</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="gst-toggle" ${gstEnabled ? 'checked' : ''} class="sr-only peer"/>
                <div class="w-11 h-6 bg-gray-300 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer
                             peer-checked:after:translate-x-full peer-checked:after:border-white
                             after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                             after:bg-white after:border-gray-300 after:border after:rounded-full
                             after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div id="gst-message" class="mt-3"></div>
          </div>
        </section>

        <!-- Security -->
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800">Security</h2>
          <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 class="text-sm font-semibold text-gray-800">Token Authentication Status</h3>
            <div class="space-y-1.5 text-sm text-gray-700">
              <p>✅ Access Token: Active (15 min expiry)</p>
              <p>✅ Refresh Token: Active (30 day expiry)</p>
              <p>✅ Auto-Refresh: Enabled (every 10 minutes)</p>
            </div>
            <button id="manual-refresh-btn"
                    class="px-4 py-2 text-sm font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors">
              Manually Refresh Token
            </button>
            <div id="refresh-message"></div>
          </div>
        </section>

        ${user.role === 'admin' ? `
        <!-- Firm Users -->
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800">Firm Users</h2>
          <div id="firm-users-list" class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold">Firm Users</h3>
              <button id="add-user-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Add User</button>
            </div>
            <div id="firm-users-content">
              Loading...
            </div>
          </div>
        </section>
        ` : ''}

        ${isSuperAdmin ? `
        <!-- Admin Panel -->
        <section class="space-y-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-800">Admin Panel</h2>
            <p class="text-sm text-gray-500 mt-0.5">Manage firms, users, and system administration</p>
          </div>

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
        </section>
        ` : ''}

      </div>
    `;

    renderLayout(content, router);

    if (user.role === 'admin') {
      loadFirmUsers();
      if (userCreator) {
        document.getElementById('add-user-btn')?.addEventListener('click', () => userCreator.show());
      }
    }

    if (isSuperAdmin) initializeAdminComponents();

    /* ── GST Toggle ── */
    const gstToggle  = document.getElementById('gst-toggle');
    const gstMessage = document.getElementById('gst-message');

    gstToggle?.addEventListener('change', async () => {
      gstMessage.innerHTML = statusMsg('blue', 'Updating GST setting…');
      try {
        const res = await fetchWithCSRF('/api/settings/system-config/gst-status', {
          method: 'PUT',
          body: JSON.stringify({ enabled: gstToggle.checked }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || `Failed (${res.status})`); }
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Failed to update');
        gstMessage.innerHTML = statusMsg('green', 'GST setting updated successfully!');
        setTimeout(() => { gstMessage.innerHTML = ''; }, 3000);
      } catch (err) {
        gstToggle.checked = !gstToggle.checked;
        gstMessage.innerHTML = statusMsg('red', 'Error: ' + err.message);
      }
    });

    /* ── Token Refresh ── */
    const refreshBtn     = document.getElementById('manual-refresh-btn');
    const refreshMessage = document.getElementById('refresh-message');

    refreshBtn?.addEventListener('click', async () => {
      refreshMessage.innerHTML = statusMsg('blue', 'Refreshing token…');
      try {
        await authManager.refreshToken();
        refreshMessage.innerHTML = statusMsg('green', 'Token refreshed successfully!');
        setTimeout(() => { refreshMessage.innerHTML = ''; }, 3000);
      } catch {
        refreshMessage.innerHTML = statusMsg('red', 'Token refresh failed.');
      }
    });

  } catch (error) {
    const content = `
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">Profile</h1>
        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl text-sm">
          Failed to load profile data: ${error.message}
        </div>
      </div>
    `;
    renderLayout(content, router);
  }
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

    setupAdminTabs();

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
  const tabs     = document.querySelectorAll('.admin-tab');
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

/* ── Helpers ─────────────────────────────────────────────────────────── */

function createInput(label, value) {
  return `
    <div class="space-y-1.5">
      <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide">${label}</label>
      <input type="text" value="${value}" disabled
             class="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg
                    bg-gray-50 text-gray-600 cursor-not-allowed"/>
    </div>
  `;
}

function statusMsg(color, text) {
  const map = {
    blue:  'bg-blue-50  border-blue-200  text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red:   'bg-red-50   border-red-200   text-red-700',
  };
  return `<div class="border rounded-lg px-4 py-2.5 text-sm ${map[color]}">${text}</div>`;
}

/* ── Load Firm Users for Admin ───────────────────────────────────── */

async function loadFirmUsers() {
  const user = authManager.getUser();
  try {
    const res = await fetch('/api/admin/users-with-firms', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error('Failed to fetch users');
    
    const data = await res.json();
    const firmUsers = data.users.filter(u => u.firm_id === user.firm_id);
    
    const listEl = document.getElementById('firm-users-content');
    if (!listEl) return;
    
    if (firmUsers.length === 0) {
      listEl.innerHTML = '<p class="text-gray-500">No users in your firm.</p>';
      return;
    }
    
    listEl.innerHTML = `
      <div class="space-y-3">
        ${firmUsers.map(u => `
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p class="font-medium text-gray-900">${u.fullname}</p>
              <p class="text-sm text-gray-500">@${u.username} · ${u.email}</p>
            </div>
            <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">${u.role}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Error loading firm users:', err);
    const listEl = document.getElementById('firm-users-content');
    if (listEl) listEl.innerHTML = '<p class="text-red-500">Failed to load firm users.</p>';
  }
}

window.loadFirmUsers = loadFirmUsers;