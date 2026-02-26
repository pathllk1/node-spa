import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

export async function renderJournalEntries(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  try {
    const response = await api.get('/api/ledger/journal-entries');
    const entries = response.journalEntries || [];

    const content = `
      <div class="max-w-7xl mx-auto px-4 py-12 space-y-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Journal Entries</h1>
            <p class="text-gray-600 mt-2">Create and manage general journal entries</p>
          </div>
          <button id="create-journal-btn" class="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition">
            + New Entry
          </button>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="bg-gray-50 border-b border-gray-200">
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Entry No</th>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th class="px-6 py-4 text-left text-sm font-semibold text-gray-900">Narration</th>
                  <th class="px-6 py-4 text-right text-sm font-semibold text-gray-900">Debits</th>
                  <th class="px-6 py-4 text-right text-sm font-semibold text-gray-900">Credits</th>
                  <th class="px-6 py-4 text-center text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${entries.length > 0 ? entries.map(entry => `
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900">${entry.voucher_no}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">${new Date(entry.transaction_date).toLocaleDateString('en-IN')}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">${entry.narration || '-'}</td>
                    <td class="px-6 py-4 text-sm text-right text-green-600 font-semibold">₹${formatNumber(entry.total_debit || 0)}</td>
                    <td class="px-6 py-4 text-sm text-right text-red-600 font-semibold">₹${formatNumber(entry.total_credit || 0)}</td>
                    <td class="px-6 py-4 text-center">
                      <div class="flex justify-center gap-2">
                        <a href="/ledger/journal-entries/${entry.id}" data-navigo class="text-blue-600 hover:text-blue-700 text-sm font-medium">View</a>
                        <button class="text-red-600 hover:text-red-700 text-sm font-medium delete-entry" data-id="${entry.id}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                      No journal entries found. Create one to get started.
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
    document.getElementById('create-journal-btn')?.addEventListener('click', () => {
      router.navigate('/ledger/journal-entries/new');
    });

    document.querySelectorAll('.delete-entry').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('Are you sure you want to delete this entry?')) {
          try {
            await api.delete(`/api/ledger/journal-entries/${id}`);
            router.navigate('/ledger/journal-entries');
          } catch (error) {
            alert('Error deleting entry: ' + error.message);
          }
        }
      });
    });
  } catch (error) {
    const content = `
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">Journal Entries</h1>
        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          Failed to load journal entries. ${error.message}
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
