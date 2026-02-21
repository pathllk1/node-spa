import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

export async function renderVouchers(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  try {
    const response = await api.get('/api/ledger/vouchers');
    const vouchers = response.vouchers || [];

    const content = `
      <div class="max-w-7xl mx-auto px-4 py-12 space-y-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Vouchers</h1>
            <p class="text-gray-600 mt-2">Payment and receipt vouchers</p>
          </div>
          <button id="create-voucher-btn" class="px-6 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition">
            + New Voucher
          </button>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="bg-gray-50 border-b border-gray-200">
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Voucher No</th>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Party</th>
                  <th class="px-6 py-4 text-right text-sm font-semibold text-gray-900">Amount</th>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Mode</th>
                  <th class="px-6 py-4 text-center text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${vouchers.length > 0 ? vouchers.map(voucher => `
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900">${voucher.voucher_no}</td>
                    <td class="px-6 py-4 text-sm">
                      <span class="px-3 py-1 rounded-full ${voucher.voucher_type === 'RECEIPT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-xs font-semibold">
                        ${voucher.voucher_type}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-600">${new Date(voucher.transaction_date).toLocaleDateString('en-IN')}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">${voucher.party_name || '-'}</td>
                    <td class="px-6 py-4 text-sm text-right font-semibold text-gray-900">₹${formatNumber(voucher.amount || 0)}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">${voucher.payment_mode || '-'}</td>
                    <td class="px-6 py-4 text-center">
                      <div class="flex justify-center gap-2">
                        <a href="/ledger/vouchers/${voucher.id}" data-navigo class="text-blue-600 hover:text-blue-700 text-sm font-medium">View</a>
                        <button class="text-red-600 hover:text-red-700 text-sm font-medium delete-voucher" data-id="${voucher.id}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                      No vouchers found. Create one to get started.
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

    // Event listeners
    document.getElementById('create-voucher-btn')?.addEventListener('click', () => {
      router.navigate('/ledger/vouchers/new');
    });

    document.querySelectorAll('.delete-voucher').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('Are you sure you want to delete this voucher?')) {
          try {
            await api.delete(`/api/ledger/vouchers/${id}`);
            router.navigate('/ledger/vouchers');
          } catch (error) {
            alert('Error deleting voucher: ' + error.message);
          }
        }
      });
    });
  } catch (error) {
    const content = `
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">Vouchers</h1>
        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          Failed to load vouchers. ${error.message}
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
