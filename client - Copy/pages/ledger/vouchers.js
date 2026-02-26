import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';
import { openVoucherModal } from '../../components/voucher-modal.js';

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
                        <button class="view-voucher text-blue-600 hover:text-blue-700 text-sm font-medium" data-id="${voucher.voucher_id}">View</button>
                        <button class="text-red-600 hover:text-red-700 text-sm font-medium delete-voucher" data-id="${voucher.voucher_id}">Delete</button>
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

      <!-- Modal container (modal will be dynamically added here) -->
      <div id="modal-container"></div>
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

    // Handle view voucher button clicks
    document.querySelectorAll('.view-voucher').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const voucherId = e.target.dataset.id;

        try {
          // Fetch voucher data
          const response = await api.get(`/api/ledger/vouchers/${voucherId}`);
          const voucher = response;

          // Open modal with voucher data
          openVoucherModal(voucher, {
            onUpdate: async (voucherId, voucherData) => {
              // After successful update, reload the page to show updated data
              window.location.reload();
            }
          });

        } catch (error) {
          alert('Error loading voucher: ' + error.message);
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

function initEditModalForm(router, voucherId, voucher) {
  const form = document.getElementById('voucher-edit-form');
  const transactionDateInput = document.getElementById('transaction-date');
  const partySelect = document.getElementById('party-select');
  const amountInput = document.getElementById('amount');
  const paymentModeSelect = document.getElementById('payment-mode');
  const bankAccountSection = document.getElementById('bank-account-section');
  const bankAccountSelect = document.getElementById('bank-account-select');
  const narrationInput = document.getElementById('narration');
  const saveBtn = document.getElementById('save-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const modal = document.getElementById('voucher-modal');

  // Load data
  loadParties(voucher.party_id);
  loadBankAccounts();

  // Event listeners
  document.querySelectorAll('input[name="voucher_type"]').forEach(radio => {
    radio.addEventListener('change', updateSummary);
  });

  partySelect.addEventListener('change', updateSummary);
  amountInput.addEventListener('input', updateSummary);
  paymentModeSelect.addEventListener('change', handlePaymentModeChange);
  form.addEventListener('submit', handleSubmit);

  // Close modal handlers
  cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));

  async function loadParties(selectedPartyId) {
    try {
      const response = await api.get('/api/inventory/sales/parties');
      const parties = response.data || [];

      partySelect.innerHTML = '<option value="">Select Party</option>' +
        parties.map(party => `<option value="${party.id}" ${party.id == selectedPartyId ? 'selected' : ''}>${party.firm} (${party.contact_person || 'N/A'})</option>`).join('');
    } catch (error) {
      console.error('Failed to load parties:', error);
      partySelect.innerHTML = '<option value="">Failed to load parties</option>';
    }
  }

  async function loadBankAccounts() {
    try {
      // Note: This would need a bank accounts API endpoint
      // For now, we'll use placeholder data or skip if not available
      bankAccountSelect.innerHTML = '<option value="">Select Bank Account</option>';
      // You might want to add a call to load bank accounts here
    } catch (error) {
      console.error('Failed to load bank accounts:', error);
    }
  }

  function handlePaymentModeChange() {
    const paymentMode = paymentModeSelect.value;
    const isBankMode = paymentMode && !paymentMode.toLowerCase().includes('cash');

    if (isBankMode) {
      bankAccountSection.classList.remove('hidden');
      bankAccountSelect.required = true;
    } else {
      bankAccountSection.classList.add('hidden');
      bankAccountSelect.required = false;
      bankAccountSelect.value = '';
    }

    updateSummary();
  }

  function updateSummary() {
    const voucherType = document.querySelector('input[name="voucher_type"]:checked')?.value || '';
    const partyOption = partySelect.options[partySelect.selectedIndex];
    const partyText = partyOption && partyOption.value ? partyOption.text.split(' (')[0] : '';
    const amount = parseFloat(amountInput.value) || 0;
    const paymentMode = paymentModeSelect.value;

    document.getElementById('summary-type').textContent = voucherType ? voucherType.charAt(0).toUpperCase() + voucherType.slice(1).toLowerCase() : '-';
    document.getElementById('summary-party').textContent = partyText || '-';
    document.getElementById('summary-amount').textContent = amount > 0 ? `₹${amount.toFixed(2)}` : '-';
    document.getElementById('summary-mode').textContent = paymentMode || '-';
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const formData = new FormData(form);
    const voucherData = Object.fromEntries(formData);

    // Validate required fields
    if (!voucherData.voucher_type) {
      alert('Please select voucher type');
      return;
    }

    if (!voucherData.party_id) {
      alert('Please select a party');
      return;
    }

    if (!voucherData.amount || parseFloat(voucherData.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!voucherData.payment_mode) {
      alert('Please select payment mode');
      return;
    }

    // Check if bank account is required
    const isBankMode = voucherData.payment_mode && !voucherData.payment_mode.toLowerCase().includes('cash');
    if (isBankMode && !voucherData.bank_account_id) {
      alert('Please select a bank account for bank transactions');
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Updating...';

      // For now, just show success - we'll need to add the update API later
      alert('Update functionality not implemented yet. This would update the voucher.');

      modal.classList.add('hidden');
      // Reload the page to show updated data
      // window.location.reload();
    } catch (error) {
      alert('Error updating voucher: ' + error.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Update Voucher';
    }
  }

  // Initialize summary and payment mode
  handlePaymentModeChange();
  updateSummary();
}

function formatNumber(num) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}
