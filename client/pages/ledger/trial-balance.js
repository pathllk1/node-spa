import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

export async function renderTrialBalance(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  try {
    const response = await api.get('/api/ledger/accounts');
    const accounts = response || [];

    const totalDebits = accounts.reduce((sum, acc) => sum + (acc.total_debit || 0), 0);
    const totalCredits = accounts.reduce((sum, acc) => sum + (acc.total_credit || 0), 0);

    const content = `
      <div class="max-w-7xl mx-auto px-4 py-12 space-y-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Trial Balance</h1>
            <p class="text-gray-600 mt-2">Verify that total debits equal total credits</p>
          </div>
          <button id="export-pdf-btn" class="px-6 py-3 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition">
            📥 Export PDF
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div class="text-sm text-gray-600 mb-2">Total Debits</div>
            <div class="text-3xl font-bold text-green-600">₹${formatNumber(totalDebits)}</div>
          </div>
          <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div class="text-sm text-gray-600 mb-2">Total Credits</div>
            <div class="text-3xl font-bold text-red-600">₹${formatNumber(totalCredits)}</div>
          </div>
          <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div class="text-sm text-gray-600 mb-2">Status</div>
            <div class="text-3xl font-bold ${Math.abs(totalDebits - totalCredits) < 0.01 ? 'text-green-600' : 'text-red-600'}">
              ${Math.abs(totalDebits - totalCredits) < 0.01 ? '✓ Balanced' : '✗ Unbalanced'}
            </div>
          </div>
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
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${accounts.map(account => `
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900">${account.account_head}</td>
                    <td class="px-6 py-4 text-sm">
                      <span class="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        ${account.account_type}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-right text-green-600 font-semibold">₹${formatNumber(account.total_debit || 0)}</td>
                    <td class="px-6 py-4 text-sm text-right text-red-600 font-semibold">₹${formatNumber(account.total_credit || 0)}</td>
                  </tr>
                `).join('')}
                <tr class="bg-gray-50 border-t-2 border-gray-300 font-bold">
                  <td colspan="2" class="px-6 py-4 text-sm text-gray-900">TOTALS</td>
                  <td class="px-6 py-4 text-sm text-right text-green-600">₹${formatNumber(totalDebits)}</td>
                  <td class="px-6 py-4 text-sm text-right text-red-600">₹${formatNumber(totalCredits)}</td>
                </tr>
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
        const fetchResponse = await fetch('/api/ledger/export/trial-balance', {
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
        link.setAttribute('download', `Trial_Balance_${new Date().toISOString().slice(0, 10)}.pdf`);
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
        <h1 class="text-3xl font-bold text-gray-900">Trial Balance</h1>
        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          Failed to load trial balance. ${error.message}
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