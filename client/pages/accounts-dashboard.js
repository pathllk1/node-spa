import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { api } from '../utils/api.js';

export async function renderAccountsDashboard(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  try {
    const [accountsRes, summariesRes] = await Promise.all([
      api.get('/api/ledger/accounts'),
      api.get('/api/ledger/account-types')
    ]);

    const accounts = accountsRes || [];
    const summaries = summariesRes || [];


    const content = `
      <div class="relative min-h-screen bg-[#f8fafc] overflow-hidden z-0">
        <div class="absolute top-0 left-0 w-96 h-96 bg-blue-300/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div class="absolute bottom-0 right-0 w-96 h-96 bg-emerald-300/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>

        <div class="relative p-8">
          <div class="max-w-7xl mx-auto mb-12">
            <nav class="text-sm text-gray-400 mb-3">
              <span class="hover:text-gray-600 cursor-pointer transition">Dashboard</span>
              <span class="mx-2">/</span>
              <span class="text-gray-700 font-medium">Accounts</span>
            </nav>

            <h1 class="text-4xl font-bold text-gray-900 tracking-tight">
              Accounts Dashboard
            </h1>
            <p class="text-gray-500 mt-2 text-lg">
              View and manage all ledger accounts and financial records.
            </p>
          </div>

          <!-- Account Type Summaries -->
          <div class="max-w-7xl mx-auto mb-12">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Account Type Summary</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              ${summaries.map(summary => `
                <div class="group relative p-6 rounded-2xl bg-white/70 backdrop-blur-xl
                            border border-white/40 shadow-xl
                            transition duration-500 hover:scale-[1.02] hover:shadow-2xl">
                  <div class="absolute inset-0 rounded-2xl bg-gradient-to-br
                              from-blue-400/0 to-indigo-500/0
                              group-hover:from-blue-400/10 group-hover:to-indigo-500/10
                              transition duration-500"></div>
                  <div class="relative z-10">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">${summary.account_type}</h3>
                    <div class="space-y-3">
                      <div class="flex justify-between items-center">
                        <span class="text-gray-600">Accounts:</span>
                        <span class="font-bold text-gray-900">${summary.account_count || 0}</span>
                      </div>
                      <div class="flex justify-between items-center">
                        <span class="text-gray-600">Total Debit:</span>
                        <span class="font-bold text-green-600">₹${formatNumber(summary.total_debit || 0)}</span>
                      </div>
                      <div class="flex justify-between items-center">
                        <span class="text-gray-600">Total Credit:</span>
                        <span class="font-bold text-red-600">₹${formatNumber(summary.total_credit || 0)}</span>
                      </div>
                      <div class="border-t border-gray-200 pt-3 flex justify-between items-center">
                        <span class="text-gray-700 font-semibold">Balance:</span>
                        <span class="font-bold ${summary.total_balance > 0 ? 'text-green-600' : 'text-red-600'}">
                          ₹${formatNumber(Math.abs(summary.total_balance || 0))} ${summary.total_balance > 0 ? 'DR' : 'CR'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- All Accounts Table -->
          <div class="max-w-7xl mx-auto">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">All Accounts</h2>
            <div class="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                      <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Account Head</th>
                      <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Type</th>
                      <th class="px-6 py-4 text-right text-sm font-semibold text-gray-900">Debit</th>
                      <th class="px-6 py-4 text-right text-sm font-semibold text-gray-900">Credit</th>
                      <th class="px-6 py-4 text-right text-sm font-semibold text-gray-900">Balance</th>
                      <th class="px-6 py-4 text-center text-sm font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    ${accounts.length > 0 ? accounts.map(account => `
                      <tr class="hover:bg-blue-50/50 transition">
                        <td class="px-6 py-4 text-sm text-gray-900 font-medium">${account.account_head}</td>
                        <td class="px-6 py-4 text-sm text-gray-600">
                          <span class="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                            ${account.account_type}
                          </span>
                        </td>
                        <td class="px-6 py-4 text-sm text-right text-green-600 font-semibold">₹${formatNumber(account.total_debit || 0)}</td>
                        <td class="px-6 py-4 text-sm text-right text-red-600 font-semibold">₹${formatNumber(account.total_credit || 0)}</td>
                        <td class="px-6 py-4 text-sm text-right font-bold ${account.balance > 0 ? 'text-green-600' : 'text-red-600'}">
                          ₹${formatNumber(Math.abs(account.balance || 0))} ${account.balance > 0 ? 'DR' : 'CR'}
                        </td>
                        <td class="px-6 py-4 text-center">
                          <a href="/ledger/account/${encodeURIComponent(account.account_head)}" data-navigo 
                             class="inline-flex items-center px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition">
                            View Details
                          </a>
                        </td>
                      </tr>
                    `).join('') : `
                      <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                          No accounts found. Start by creating journal entries or vouchers.
                        </td>
                      </tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="max-w-7xl mx-auto mt-12">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <a href="/ledger/journal-entries" data-navigo 
                 class="group relative p-6 rounded-2xl bg-white/70 backdrop-blur-xl
                         border border-white/40 shadow-xl
                         transition duration-500 hover:scale-[1.02] hover:shadow-2xl">
                <div class="absolute inset-0 rounded-2xl bg-gradient-to-br
                            from-purple-400/0 to-violet-500/0
                            group-hover:from-purple-400/10 group-hover:to-violet-500/10
                            transition duration-500"></div>
                <div class="relative z-10 text-center">
                  <div class="w-12 h-12 flex items-center justify-center rounded-xl
                              bg-gradient-to-br from-purple-500 to-violet-600
                              text-white shadow-lg mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <h3 class="font-semibold text-gray-900">Journal Entries</h3>
                  <p class="text-sm text-gray-500 mt-1">Create and manage journal entries</p>
                </div>
              </a>

              <a href="/ledger/vouchers" data-navigo 
                 class="group relative p-6 rounded-2xl bg-white/70 backdrop-blur-xl
                         border border-white/40 shadow-xl
                         transition duration-500 hover:scale-[1.02] hover:shadow-2xl">
                <div class="absolute inset-0 rounded-2xl bg-gradient-to-br
                            from-green-400/0 to-emerald-500/0
                            group-hover:from-green-400/10 group-hover:to-emerald-500/10
                            transition duration-500"></div>
                <div class="relative z-10 text-center">
                  <div class="w-12 h-12 flex items-center justify-center rounded-xl
                              bg-gradient-to-br from-green-500 to-emerald-600
                              text-white shadow-lg mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                  </div>
                  <h3 class="font-semibold text-gray-900">Vouchers</h3>
                  <p class="text-sm text-gray-500 mt-1">Payment and receipt vouchers</p>
                </div>
              </a>

              <a href="/ledger/trial-balance" data-navigo 
                 class="group relative p-6 rounded-2xl bg-white/70 backdrop-blur-xl
                         border border-white/40 shadow-xl
                         transition duration-500 hover:scale-[1.02] hover:shadow-2xl">
                <div class="absolute inset-0 rounded-2xl bg-gradient-to-br
                            from-orange-400/0 to-amber-500/0
                            group-hover:from-orange-400/10 group-hover:to-amber-500/10
                            transition duration-500"></div>
                <div class="relative z-10 text-center">
                  <div class="w-12 h-12 flex items-center justify-center rounded-xl
                              bg-gradient-to-br from-orange-500 to-amber-600
                              text-white shadow-lg mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                  </div>
                  <h3 class="font-semibold text-gray-900">Trial Balance</h3>
                  <p class="text-sm text-gray-500 mt-1">View trial balance report</p>
                </div>
              </a>

              <a href="/ledger/general-ledger" data-navigo 
                 class="group relative p-6 rounded-2xl bg-white/70 backdrop-blur-xl
                         border border-white/40 shadow-xl
                         transition duration-500 hover:scale-[1.02] hover:shadow-2xl">
                <div class="absolute inset-0 rounded-2xl bg-gradient-to-br
                            from-pink-400/0 to-rose-500/0
                            group-hover:from-pink-400/10 group-hover:to-rose-500/10
                            transition duration-500"></div>
                <div class="relative z-10 text-center">
                  <div class="w-12 h-12 flex items-center justify-center rounded-xl
                              bg-gradient-to-br from-pink-500 to-rose-600
                              text-white shadow-lg mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006.175 4.5M12 6.042A8.967 8.967 0 0118.825 4.5M12 6.042a8.968 8.968 0 016.175 1.542m-6.175-1.542a8.968 8.968 0 00-6.175 1.542m0 0A9 9 0 0112 3m0 0a9 9 0 019 9m-9 9a9 9 0 01-9-9m9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                  <h3 class="font-semibold text-gray-900">General Ledger</h3>
                  <p class="text-sm text-gray-500 mt-1">Complete ledger report</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    renderLayout(content, router);
  } catch (error) {
    const content = `
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">Accounts Dashboard</h1>
        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          Failed to load accounts dashboard. ${error.message}
        </div>
      </div>
    `;
    renderLayout(content, router);
  }
}

function formatNumber(num) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}
