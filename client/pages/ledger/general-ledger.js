import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

export async function renderGeneralLedger(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  try {
    const response = await api.get('/api/ledger/accounts');
    const accounts = response || [];

    const content = `
      <div class="max-w-7xl mx-auto px-4 py-12 space-y-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">General Ledger</h1>
            <p class="text-gray-600 mt-2">Complete ledger of all accounts and transactions</p>
          </div>
          <button id="export-pdf-btn" class="px-6 py-3 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition">
            📥 Export PDF
          </button>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="bg-gray-50 border-b border-gray-200">
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Account Head</th>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th class="px-6 py-4 text-right text-sm font-semibold text-gray-900">Debits</th>
                  <th class="px-6 py-4 text-right text-sm font-semibold text-gray-900">Credits</th>
                  <th class="px-6 py-4 text-right text-sm font-semibold text-gray-900">Balance</th>
                  <th class="px-6 py-4 text-center text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${accounts.length > 0 ? accounts.map(account => `
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900">${account.account_head}</td>
                    <td class="px-6 py-4 text-sm">
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
                         class="text-blue-600 hover:text-blue-700 text-sm font-medium">View Details</a>
                    </td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                      No accounts found.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    renderLayout(content, router);

    document.getElementById('export-pdf-btn')?.addEventListener('click', async () => {
      try {
        // Use native fetch() for binary PDF downloads — api.get() always calls
        // response.json() internally which crashes on PDF binary data.
        // Cookies are sent automatically by the browser (credentials: 'include').
        const fetchResponse = await fetch('/api/ledger/export/general-ledger', {
          method: 'GET',
          credentials: 'include'
        });

        if (!fetchResponse.ok) {
          const errText = await fetchResponse.text();
          throw new Error(`Server error ${fetchResponse.status}: ${errText}`);
        }

        const blob = await fetchResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `General_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        alert('Error exporting PDF: ' + error.message);
      }
    });
  } catch (error) {
    const content = `
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">General Ledger</h1>
        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          Failed to load general ledger. ${error.message}
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