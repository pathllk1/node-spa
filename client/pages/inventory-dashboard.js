import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export async function renderInventoryDashboard(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
  <div class="relative min-h-screen bg-[#f8fafc] overflow-hidden z-0">

    <div class="absolute top-0 left-0 w-96 h-96 bg-blue-300/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
    <div class="absolute bottom-0 right-0 w-96 h-96 bg-emerald-300/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>

    <div class="relative p-8">

      <div class="max-w-7xl mx-auto mb-12">
        <nav class="text-sm text-gray-400 mb-3">
          <span class="hover:text-gray-600 cursor-pointer transition">Dashboard</span>
          <span class="mx-2">/</span>
          <span class="text-gray-700 font-medium">Inventory</span>
        </nav>

        <h1 class="text-4xl font-bold text-gray-900 tracking-tight">
          Inventory Dashboard
        </h1>
        <p class="text-gray-500 mt-2 text-lg">
          Manage inventory, suppliers, categories and insights in one place.
        </p>
      </div>

      <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">

        <div class="group relative p-8 rounded-3xl bg-white/70 backdrop-blur-xl
                    border border-white/40 shadow-xl
                    transition duration-500 hover:scale-[1.03] hover:shadow-2xl">
          <div class="absolute inset-0 rounded-3xl bg-gradient-to-br
                      from-blue-400/0 to-indigo-500/0
                      group-hover:from-blue-400/10 group-hover:to-indigo-500/10
                      transition duration-500"></div>
          <div class="relative z-10">
            <div class="w-14 h-14 flex items-center justify-center rounded-2xl
                        bg-gradient-to-br from-blue-500 to-indigo-600
                        text-white shadow-lg mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">Stock Management</h2>
            <p class="text-gray-500 mb-6">Manage inventory items, batches, and stock levels.</p>
            <a href="/inventory/stocks" data-navigo class="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-blue-600 text-white font-medium shadow-md hover:bg-blue-700 transition duration-300">Manage Stocks</a>
          </div>
        </div>

        <div class="group relative p-8 rounded-3xl bg-white/70 backdrop-blur-xl
                    border border-white/40 shadow-xl
                    transition duration-500 hover:scale-[1.03] hover:shadow-2xl">
          <div class="absolute inset-0 rounded-3xl bg-gradient-to-br
                      from-emerald-400/0 to-green-500/0
                      group-hover:from-emerald-400/10 group-hover:to-green-500/10
                      transition duration-500"></div>
          <div class="relative z-10">
            <div class="w-14 h-14 flex items-center justify-center rounded-2xl
                        bg-gradient-to-br from-emerald-500 to-green-600
                        text-white shadow-lg mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">Categories</h2>
            <p class="text-gray-500 mb-6">Organize and categorize your inventory items.</p>
            <a href="/inventory/categories" data-navigo class="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-emerald-600 text-white font-medium shadow-md hover:bg-emerald-700 transition duration-300">Manage Categories</a>
          </div>
        </div>

        <div class="group relative p-8 rounded-3xl bg-white/70 backdrop-blur-xl
                    border border-white/40 shadow-xl
                    transition duration-500 hover:scale-[1.03] hover:shadow-2xl">
          <div class="absolute inset-0 rounded-3xl bg-gradient-to-br
                      from-purple-400/0 to-violet-500/0
                      group-hover:from-purple-400/10 group-hover:to-violet-500/10
                      transition duration-500"></div>
          <div class="relative z-10">
            <div class="w-14 h-14 flex items-center justify-center rounded-2xl
                        bg-gradient-to-br from-purple-500 to-violet-600
                        text-white shadow-lg mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">Suppliers</h2>
            <p class="text-gray-500 mb-6">Manage suppliers and vendor relationships.</p>
            <a href="/inventory/suppliers" data-navigo class="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-purple-600 text-white font-medium shadow-md hover:bg-purple-700 transition duration-300">Manage Suppliers</a>
          </div>
        </div>

        <div class="group relative p-8 rounded-3xl bg-white/70 backdrop-blur-xl
                    border border-white/40 shadow-xl
                    transition duration-500 hover:scale-[1.03] hover:shadow-2xl">
          <div class="absolute inset-0 rounded-3xl bg-gradient-to-br
                      from-orange-400/0 to-amber-500/0
                      group-hover:from-orange-400/10 group-hover:to-amber-500/10
                      transition duration-500"></div>
          <div class="relative z-10">
            <div class="w-14 h-14 flex items-center justify-center rounded-2xl
                        bg-gradient-to-br from-orange-500 to-amber-600
                        text-white shadow-lg mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">Reports</h2>
            <p class="text-gray-500 mb-6">Analyze inventory performance and generate insights.</p>
            <a href="/inventory/reports" data-navigo class="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-orange-600 text-white font-medium shadow-md hover:bg-orange-700 transition duration-300">View Reports</a>
          </div>
        </div>

        <div class="group relative p-8 rounded-3xl bg-white/70 backdrop-blur-xl
                    border border-white/40 shadow-xl
                    transition duration-500 hover:scale-[1.03] hover:shadow-2xl">
          <div class="absolute inset-0 rounded-3xl bg-gradient-to-br
                      from-pink-400/0 to-rose-500/0
                      group-hover:from-pink-400/10 group-hover:to-rose-500/10
                      transition duration-500"></div>
          <div class="relative z-10">
            <div class="w-14 h-14 flex items-center justify-center rounded-2xl
                        bg-gradient-to-br from-pink-500 to-rose-600
                        text-white shadow-lg mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">Sales</h2>
            <p class="text-gray-500 mb-6">Track sales transactions and revenue.</p>
            <a href="/inventory/sls" data-navigo class="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-pink-600 text-white font-medium shadow-md hover:bg-pink-700 transition duration-300">View Sales</a>
          </div>
        </div>

        <div class="group relative p-8 rounded-3xl bg-white/70 backdrop-blur-xl
                    border border-white/40 shadow-xl
                    transition duration-500 hover:scale-[1.03] hover:shadow-2xl">
          <div class="absolute inset-0 rounded-3xl bg-gradient-to-br
                      from-green-400/0 to-emerald-500/0
                      group-hover:from-green-400/10 group-hover:to-emerald-500/10
                      transition duration-500"></div>
          <div class="relative z-10">
            <div class="w-14 h-14 flex items-center justify-center rounded-2xl
                        bg-gradient-to-br from-green-500 to-emerald-600
                        text-white shadow-lg mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 6v2.25m0 0v2.25m0-2.25h2.25m-2.25 0h-2.25m6.75-3v6.75m-6.75 0v6.75m0-6.75l2.25-2.25m-2.25 2.25l-2.25-2.25m6.75-3l2.25 2.25m-2.25-2.25l-2.25 2.25" />
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">Stock Movement</h2>
            <p class="text-gray-500 mb-6">Track and analyze all stock movements and inventory transactions.</p>
            <a href="/inventory/stock-movement" data-navigo class="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-green-600 text-white font-medium shadow-md hover:bg-green-700 transition duration-300">View Movements</a>
          </div>
        </div>

      </div>
    </div>
  </div>
  `;

  renderLayout(content, router);
}
