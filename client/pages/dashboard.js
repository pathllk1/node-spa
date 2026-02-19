import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { api } from '../utils/api.js';
import { authManager } from '../utils/auth.js';

export async function renderDashboard(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const user = authManager.getUser();

  try {
    const response = await api.get('/api/pages/dashboard');
    const data = response.data;

    const content = `
      <div class="max-w-7xl mx-auto px-4 py-12 space-y-12">

        <!-- Header -->
        <div class="space-y-3">
          <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p class="text-gray-600">
            Welcome back, <span class="font-semibold text-gray-800">${user.username}</span>!
          </p>

          <div class="bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-lg">
            You are successfully authenticated. Your session is automatically managed with dual-token refresh.
          </div>
        </div>

        <!-- Statistics -->
        <section class="space-y-6">
          <h2 class="text-xl font-semibold text-gray-800">Statistics</h2>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-6">

            ${createStatCard("Page Views", data.stats.pageViews)}
            ${createStatCard("Active Users", data.stats.activeUsers)}
            ${createStatCard("Revenue", "$" + data.stats.revenue)}
            ${createStatCard("Growth", data.stats.growth)}

          </div>
        </section>

        <!-- Recent Activity -->
        <section class="space-y-6">
          <h2 class="text-xl font-semibold text-gray-800">Recent Activity</h2>

          <div class="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100">
            ${data.recentActivity.map(activity => `
              <div class="flex justify-between items-center p-4">
                <div class="text-gray-800">${activity.action}</div>
                <div class="text-sm text-gray-500">${activity.time}</div>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- Authentication Info -->
        <section class="space-y-6">
          <h2 class="text-xl font-semibold text-gray-800">Authentication Info</h2>

          <div class="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-2 text-gray-700">
            <p><strong>User ID:</strong> ${user.id}</p>
            <p><strong>Username:</strong> ${user.username}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Role:</strong> ${user.role}</p>
          </div>
        </section>

        <!-- Pro Tip -->
        <div class="bg-blue-50 border border-blue-200 text-blue-700 px-6 py-4 rounded-lg">
          💡 <strong>Pro Tip:</strong> Your access token refreshes automatically every 10 minutes.
          Try keeping this page open for more than 15 minutes and notice that you stay logged in!
        </div>

      </div>
    `;

    renderLayout(content, router);

  } catch (error) {
    const content = `
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>

        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          Failed to load dashboard data. ${error.message}
        </div>
      </div>
    `;

    renderLayout(content, router);
  }
}

/* Helper for stat cards */
function createStatCard(label, value) {
  return `
    <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm
                hover:shadow-md transition">
      <div class="text-sm text-gray-500 mb-1">${label}</div>
      <div class="text-2xl font-bold text-gray-900">${value}</div>
    </div>
  `;
}
