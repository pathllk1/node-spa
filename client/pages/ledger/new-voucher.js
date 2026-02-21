import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

export async function renderNewVoucher(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
    <div class="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">New Voucher</h1>
          <p class="text-gray-600 mt-2">Create a new payment or receipt voucher</p>
        </div>
        <a href="/ledger/vouchers" data-navigo class="px-6 py-3 rounded-lg bg-gray-600 text-white font-medium hover:bg-gray-700 transition">
          ← Back to Vouchers
        </a>
      </div>

      <form id="voucher-form" class="bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-6">
        <!-- Voucher Type -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-4">Voucher Type *</label>
          <div class="flex gap-6">
            <label class="flex items-center">
              <input type="radio" name="voucher_type" value="RECEIPT" required
                     class="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 focus:ring-green-500">
              <span class="ml-2 text-sm font-medium text-gray-900">Receipt Voucher</span>
            </label>
            <label class="flex items-center">
              <input type="radio" name="voucher_type" value="PAYMENT" required
                     class="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 focus:ring-red-500">
              <span class="ml-2 text-sm font-medium text-gray-900">Payment Voucher</span>
            </label>
          </div>
        </div>

        <!-- Basic Details -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Transaction Date *</label>
            <input type="date" id="transaction-date" name="transaction_date" required
                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Party *</label>
            <select id="party-select" name="party_id" required
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
              <option value="">Select Party</option>
            </select>
          </div>
        </div>

        <!-- Amount and Payment Mode -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Amount *</label>
            <input type="number" id="amount" name="amount" step="0.01" min="0.01" required
                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                   placeholder="0.00">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Payment Mode *</label>
            <select id="payment-mode" name="payment_mode" required
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
              <option value="">Select Payment Mode</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>

        <!-- Bank Account (conditional) -->
        <div id="bank-account-section" class="hidden">
          <label class="block text-sm font-semibold text-gray-700 mb-2">Bank Account</label>
          <select id="bank-account-select" name="bank_account_id"
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
            <option value="">Select Bank Account</option>
          </select>
        </div>

        <!-- Narration -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">Narration</label>
          <textarea id="narration" name="narration" rows="3"
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none"
                    placeholder="Enter voucher description"></textarea>
        </div>

        <!-- Transaction Summary -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="text-sm font-semibold text-gray-700 mb-3">Transaction Summary</h4>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Type:</span>
              <span id="summary-type" class="text-sm font-medium text-gray-900">-</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Party:</span>
              <span id="summary-party" class="text-sm font-medium text-gray-900">-</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Amount:</span>
              <span id="summary-amount" class="text-sm font-medium text-gray-900">-</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Payment Mode:</span>
              <span id="summary-mode" class="text-sm font-medium text-gray-900">-</span>
            </div>
          </div>
        </div>

        <!-- Submit Buttons -->
        <div class="flex justify-end gap-4 pt-6 border-t border-gray-200">
          <a href="/ledger/vouchers" data-navigo class="px-6 py-3 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition">
            Cancel
          </a>
          <button type="submit" id="save-btn" class="px-6 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
            Save Voucher
          </button>
        </div>
      </form>
    </div>
  `;

  renderLayout(content, router);

  // Initialize the form after DOM is ready
  setTimeout(() => {
    initVoucherForm(router);
  }, 100);
}

function initVoucherForm(router) {
  const form = document.getElementById('voucher-form');
  const transactionDateInput = document.getElementById('transaction-date');
  const partySelect = document.getElementById('party-select');
  const amountInput = document.getElementById('amount');
  const paymentModeSelect = document.getElementById('payment-mode');
  const bankAccountSection = document.getElementById('bank-account-section');
  const bankAccountSelect = document.getElementById('bank-account-select');
  const narrationInput = document.getElementById('narration');
  const saveBtn = document.getElementById('save-btn');

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  transactionDateInput.value = today;

  // Load data
  loadParties();
  loadBankAccounts();

  // Event listeners
  document.querySelectorAll('input[name="voucher_type"]').forEach(radio => {
    radio.addEventListener('change', updateSummary);
  });

  partySelect.addEventListener('change', updateSummary);
  amountInput.addEventListener('input', updateSummary);
  paymentModeSelect.addEventListener('change', handlePaymentModeChange);
  form.addEventListener('submit', handleSubmit);

  async function loadParties() {
    try {
      const response = await api.get('/api/inventory/sales/parties');
      const parties = response.data || [];

      partySelect.innerHTML = '<option value="">Select Party</option>' +
        parties.map(party => `<option value="${party.id}">${party.firm} (${party.contact_person || 'N/A'})</option>`).join('');
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
    const partyText = partyOption ? partyOption.textContent.split(' (')[0] : '';
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
      saveBtn.textContent = 'Saving...';

      const response = await api.post('/api/ledger/vouchers', voucherData);

      if (response.message) {
        alert('Voucher created successfully!');
        router.navigate('/ledger/vouchers');
      }
    } catch (error) {
      alert('Error creating voucher: ' + error.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Voucher';
    }
  }

  // Initialize summary
  updateSummary();
}
