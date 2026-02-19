import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { api } from '../utils/api.js';
import { authManager } from '../utils/auth.js';

export async function renderProfile(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const user = authManager.getUser();

  try {
    const response = await api.get('/api/pages/profile');
    const data = response.data;

    const content = `
      <div class="max-w-6xl mx-auto px-4 py-12 space-y-12">

        <!-- Header -->
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Profile</h1>
          <p class="text-gray-600 mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        <!-- User Information -->
        <section class="space-y-6">
          <h2 class="text-xl font-semibold text-gray-800">User Information</h2>

          <div class="bg-white border border-gray-200 rounded-xl p-8 shadow-sm grid md:grid-cols-2 gap-6">

            ${createInput("User ID", user.id)}
            ${createInput("Username", user.username)}
            ${createInput("Email", user.email)}
            ${createInput("Role", user.role)}

          </div>
        </section>

        <!-- Preferences -->
        <section class="space-y-6">
          <h2 class="text-xl font-semibold text-gray-800">Preferences</h2>

          <div class="bg-white border border-gray-200 rounded-xl p-8 shadow-sm grid md:grid-cols-3 gap-6">

            ${createInput("Theme", data.preferences.theme)}
            ${createInput("Notifications", data.preferences.notifications ? "Enabled" : "Disabled")}
            ${createInput("Language", data.preferences.language)}

          </div>
        </section>

        <!-- Account Information -->
        <section class="space-y-6">
          <h2 class="text-xl font-semibold text-gray-800">Account Information</h2>

          <div class="bg-gray-50 border border-gray-200 rounded-xl p-8 space-y-3 text-gray-700">
            <p><strong>Member Since:</strong> ${data.accountInfo.memberSince}</p>
            <p><strong>Last Password Change:</strong> ${data.accountInfo.lastPasswordChange}</p>
            <p><strong>Two-Factor Authentication:</strong> ${data.accountInfo.twoFactorEnabled ? "Enabled" : "Disabled"}</p>
          </div>
        </section>

        <!-- Security -->
        <section class="space-y-6">
          <h2 class="text-xl font-semibold text-gray-800">Security</h2>

          <div class="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-4">

            <h3 class="font-semibold text-gray-800">Token Authentication Status</h3>

            <div class="space-y-2 text-gray-700">
              <p>✅ Access Token: Active (15 min expiry)</p>
              <p>✅ Refresh Token: Active (30 day expiry)</p>
              <p>✅ Auto-Refresh: Enabled (every 10 minutes)</p>
            </div>

            <div class="pt-4">
              <button
                id="manual-refresh-btn"
                class="bg-gray-800 text-white px-4 py-2 rounded-lg
                       hover:bg-gray-900 transition"
              >
                Manually Refresh Token
              </button>
            </div>

            <div id="refresh-message" class="pt-2"></div>

          </div>
        </section>

      </div>
    `;

    renderLayout(content, router);

    const refreshBtn = document.getElementById('manual-refresh-btn');
    const refreshMessage = document.getElementById('refresh-message');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        try {
          refreshMessage.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
              Refreshing token...
            </div>
          `;

          await authManager.refreshToken();

          refreshMessage.innerHTML = `
            <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              Token refreshed successfully!
            </div>
          `;

          setTimeout(() => {
            refreshMessage.innerHTML = '';
          }, 3000);

        } catch (error) {
          refreshMessage.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              Token refresh failed
            </div>
          `;
        }
      });
    }

  } catch (error) {
    const content = `
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">Profile</h1>

        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          Failed to load profile data. ${error.message}
        </div>
      </div>
    `;

    renderLayout(content, router);
  }
}

/* Helper function for disabled input fields */
function createInput(label, value) {
  return `
    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700">
        ${label}
      </label>
      <input
        type="text"
        value="${value}"
        disabled
        class="w-full px-4 py-2 border border-gray-300 rounded-lg
               bg-gray-100 text-gray-700 cursor-not-allowed"
      />
    </div>
  `;
}
