import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export async function renderInventorySuppliers(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
  <div class="max-w-7xl mx-auto px-4 py-16 space-y-8">

    <div class="text-center space-y-4">
      <div class="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-violet-600 rounded-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-10 h-10 text-white">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      </div>
      <h1 class="text-4xl font-bold text-gray-900">Inventory Suppliers</h1>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto">
        Manage your suppliers and vendor relationships. This feature is coming soon!
      </p>
    </div>

    <div class="bg-purple-50 border border-purple-200 rounded-xl p-8 text-center">
      <h3 class="text-lg font-semibold text-purple-900 mb-2">Coming Soon</h3>
      <p class="text-purple-700">
        The supplier management system is currently under development.
        Check back soon for supplier tracking and relationship management features.
      </p>
    </div>

    <div class="flex justify-center">
      <a href="/inventory/dashboard" data-navigo class="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Dashboard
      </a>
    </div>

  </div>
  `;

  renderLayout(content, router);
}
