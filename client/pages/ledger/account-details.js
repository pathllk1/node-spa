import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

export async function renderAccountDetails(router, params) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const accountHead = decodeURIComponent(params.account_head);

  try {
    const response = await api.get(`/api/ledger/account/${accountHead}`);
    const records = response || [];

    let runningBalance = 0;
    // Records arrive in ASC order (oldest first) — calculate running balance
    // chronologically so each row reflects the true balance after that transaction.
    const processedRecords = records.map(record => {
      const debit = record.debit_amount || 0;
      const credit = record.credit_amount || 0;
      runningBalance += debit - credit;
      return {
        ...record,
        running_balance: runningBalance
      };
    });

    // Reverse for display: newest transaction at the top, and the top row will
    // now correctly show the closing balance (₹X DR) rather than a small opening amount.
    processedRecords.reverse();

    const totalDebits = records.reduce((sum, r) => sum + (r.debit_amount || 0), 0);
    const totalCredits = records.reduce((sum, r) => sum + (r.credit_amount || 0), 0);
    const closingBalance = runningBalance;

    const content = `
      <div class="max-w-7xl mx-auto px-4 py-12 space-y-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">${accountHead}</h1>
            <p class="text-gray-600 mt-2">Account ledger details and transactions</p>
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
            <div class="text-sm text-gray-600 mb-2">Closing Balance</div>
            <div class="text-3xl font-bold ${closingBalance > 0 ? 'text-green-600' : 'text-red-600'}">
              ₹${formatNumber(Math.abs(closingBalance))} ${closingBalance > 0 ? 'DR' : 'CR'}
            </div>
          </div>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="bg-gray-50 border-b border-gray-200">
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Voucher No</th>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Narration</th>
                  <th class="px-6 py-4 text-right text-sm font-semibold text-gray-900">Debit</th>
                  <th class="px-6 py-4 text-right text-sm font-semibold text-gray-900">Credit</th>
                  <th class="px-6 py-4 text-right text-sm font-semibold text-gray-900">Balance</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${processedRecords.length > 0 ? processedRecords.map(record => `
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 text-sm text-gray-600">${new Date(record.transaction_date).toLocaleDateString('en-IN')}</td>
                    <td class="px-6 py-4 text-sm font-medium text-gray-900">${record.voucher_no}</td>
                    <td class="px-6 py-4 text-sm">
                      <span class="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        ${record.voucher_type}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-600">${record.narration || '-'}</td>
                    <td class="px-6 py-4 text-sm text-right text-green-600 font-semibold">${record.debit_amount > 0 ? '₹' + formatNumber(record.debit_amount) : '-'}</td>
                    <td class="px-6 py-4 text-sm text-right text-red-600 font-semibold">${record.credit_amount > 0 ? '₹' + formatNumber(record.credit_amount) : '-'}</td>
                    <td class="px-6 py-4 text-sm text-right font-bold ${record.running_balance > 0 ? 'text-green-600' : 'text-red-600'}">
                      ₹${formatNumber(Math.abs(record.running_balance))} ${record.running_balance > 0 ? 'DR' : 'CR'}
                    </td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                      No transactions found for this account.
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
        const fetchResponse = await fetch(`/api/ledger/export/account-ledger/${encodeURIComponent(accountHead)}`, {
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
        link.setAttribute('download', `Ledger_${accountHead}.pdf`);
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
        <h1 class="text-3xl font-bold text-gray-900">Account Details</h1>
        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          Failed to load account details. ${error.message}
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