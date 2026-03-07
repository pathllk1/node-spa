import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export async function renderInventoryDashboard(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
  <div class="relative min-h-screen bg-[#f8fafc] overflow-hidden z-0">

    <div class="absolute top-0 left-0 w-96 h-96 bg-blue-300/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
    <div class="absolute bottom-0 right-0 w-96 h-96 bg-emerald-300/30 rounded-full blur-3xl translate-x/3 translate-y/3"></div>

    <div class="relative p-6">

      <div class="mb-6">
        <nav class="text-sm text-gray-400 mb-2">
          <span class="hover:text-gray-600 cursor-pointer transition">Dashboard</span>
          <span class="mx-2">/</span>
          <span class="text-gray-700 font-medium">Inventory</span>
        </nav>

        <h1 class="text-3xl font-bold text-gray-900 tracking-tight">
          Inventory Dashboard
        </h1>
        <p class="text-gray-500 mt-1 text-base">
          Manage inventory, suppliers, categories and insights in one place.
        </p>
      </div>

      <div class="flex flex-wrap justify-center gap-4 p-4 bg-[#f8fafc] rounded-xl shadow-lg border border-gray-200 overflow-x-auto">
        <a href="/inventory/stocks" data-navigo class="flex flex-col items-center p-3 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 min-w-[100px] group" aria-label="Stock Management">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7 mb-1 group-hover:animate-pulse">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
          <span class="text-xs font-semibold text-center">Stock Management</span>
        </a>
        <a href="/inventory/categories" data-navigo class="flex flex-col items-center p-3 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-lg shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 min-w-[100px] group" aria-label="Categories">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7 mb-1 group-hover:animate-pulse">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
          </svg>
          <span class="text-xs font-semibold text-center">Categories</span>
        </a>
        <a href="/inventory/suppliers" data-navigo class="flex flex-col items-center p-3 bg-gradient-to-br from-purple-500 to-violet-600 text-white rounded-lg shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 min-w-[100px] group" aria-label="Suppliers">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7 mb-1 group-hover:animate-pulse">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <span class="text-xs font-semibold text-center">Suppliers</span>
        </a>
        <a href="/inventory/reports" data-navigo class="flex flex-col items-center p-3 bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-lg shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 min-w-[100px] group" aria-label="Reports">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7 mb-1 group-hover:animate-pulse">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <span class="text-xs font-semibold text-center">Reports</span>
        </a>
        <a href="/inventory/sls" data-navigo class="flex flex-col items-center p-3 bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-lg shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 min-w-[100px] group" aria-label="Sales">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7 mb-1 group-hover:animate-pulse">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
          <span class="text-xs font-semibold text-center">Sales</span>
        </a>
        <a href="/inventory/prs" data-navigo class="flex flex-col items-center p-3 bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-lg shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 min-w-[100px] group" aria-label="Purchases">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7 mb-1 group-hover:animate-pulse">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h2.25m6-3h3.75m-12 3H4.5m1.386-6.75h13.386a1.125 1.125 0 011.125 1.125v9a1.125 1.125 0 01-1.125 1.125H5.625A1.125 1.125 0 014.5 16.125v-9A1.125 1.125 0 015.625 6z" />
          </svg>
          <span class="text-xs font-semibold text-center">Purchases</span>
        </a>
        <a href="/inventory/stock-movement" data-navigo class="flex flex-col items-center p-3 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-lg shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 min-w-[100px] group" aria-label="Stock Movement">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7 mb-1 group-hover:animate-pulse">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 6v2.25m0 0v2.25m0-2.25h2.25m-2.25 0h-2.25m6.75-3v6.75m-6.75 0v6.75m0-6.75l2.25-2.25m-2.25 2.25l-2.25-2.25m6.75-3l2.25 2.25m-2.25-2.25l-2.25 2.25" />
          </svg>
          <span class="text-xs font-semibold text-center">Stock Movement</span>
        </a>
      </div>
    </div>
  </div>
  `;

  renderLayout(content, router);
}
