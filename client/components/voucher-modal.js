/**
 * Voucher Edit Modal Component
 * Handles the editable voucher modal for viewing/editing voucher details
 */

export function openVoucherModal(voucher, callbacks) {
  const { onUpdate } = callbacks;

  // Create modal HTML
  const modalHTML = `
    <div id="voucher-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div class="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-4 flex justify-between items-center">
          <h2 class="text-xl font-bold">Edit Voucher</h2>
          <button id="close-voucher-modal" class="text-white hover:text-gray-200 text-2xl leading-none">&times;</button>
        </div>

        <form id="voucher-edit-form" class="p-6 space-y-6">
          <!-- Voucher Type -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-4">Voucher Type *</label>
            <div class="flex gap-6">
              <label class="flex items-center">
                <input type="radio" name="voucher_type" value="RECEIPT" ${voucher.voucher_type === 'RECEIPT' ? 'checked' : ''}
                       class="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 focus:ring-green-500" required>
                <span class="ml-2 text-sm font-medium text-gray-900">Receipt Voucher</span>
              </label>
              <label class="flex items-center">
                <input type="radio" name="voucher_type" value="PAYMENT" ${voucher.voucher_type === 'PAYMENT' ? 'checked' : ''}
                       class="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 focus:ring-red-500" required>
                <span class="ml-2 text-sm font-medium text-gray-900">Payment Voucher</span>
              </label>
            </div>
          </div>

          <!-- Basic Details -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Transaction Date *</label>
              <input type="date" id="transaction-date" name="transaction_date"
                     value="${voucher.transaction_date ? new Date(voucher.transaction_date).toISOString().split('T')[0] : ''}"
                     required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Party *</label>
              <select id="party-select" name="party_id" required
                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
                <option value="">Loading parties...</option>
              </select>
            </div>
          </div>

          <!-- Amount and Payment Mode -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Amount *</label>
              <input type="number" id="amount" name="amount" step="0.01" min="0.01"
                     value="${voucher.amount || ''}" required
                     class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition" placeholder="0.00">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Payment Mode *</label>
              <select id="payment-mode" name="payment_mode" required
                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition">
                <option value="">Select Payment Mode</option>
                <option value="Cash" ${voucher.payment_mode === 'Cash' ? 'selected' : ''}>Cash</option>
                <option value="Cheque" ${voucher.payment_mode === 'Cheque' ? 'selected' : ''}>Cheque</option>
                <option value="NEFT" ${voucher.payment_mode === 'NEFT' ? 'selected' : ''}>NEFT</option>
                <option value="RTGS" ${voucher.payment_mode === 'RTGS' ? 'selected' : ''}>RTGS</option>
                <option value="UPI" ${voucher.payment_mode === 'UPI' ? 'selected' : ''}>UPI</option>
                <option value="Bank Transfer" ${voucher.payment_mode === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
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
                      placeholder="Enter voucher description">${voucher.narration || ''}</textarea>
          </div>

          <!-- Transaction Summary -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Transaction Summary</h4>
            <div class="space-y-2">
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">Type:</span>
                <span id="summary-type" class="text-sm font-medium text-gray-900">${voucher.voucher_type || '-'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">Party:</span>
                <span id="summary-party" class="text-sm font-medium text-gray-900">${voucher.party_name || '-'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">Amount:</span>
                <span id="summary-amount" class="text-sm font-medium text-gray-900">${voucher.amount ? `₹${parseFloat(voucher.amount).toFixed(2)}` : '-'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">Payment Mode:</span>
                <span id="summary-mode" class="text-sm font-medium text-gray-900">${voucher.payment_mode || '-'}</span>
              </div>
            </div>
          </div>

          <!-- Submit Buttons -->
          <div class="flex justify-end gap-4 pt-6 border-t border-gray-200">
            <button type="button" id="cancel-edit-btn" class="px-6 py-3 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition">
              Cancel
            </button>
            <button type="submit" id="save-btn" class="px-6 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
              Update Voucher
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Remove existing modal if present
  const existingModal = document.getElementById('voucher-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Get modal elements
  const modal = document.getElementById('voucher-modal');
  const form = document.getElementById('voucher-edit-form');
  const closeBtn = document.getElementById('close-voucher-modal');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const saveBtn = document.getElementById('save-btn');

  // Form elements
  const transactionDateInput = document.getElementById('transaction-date');
  const partySelect = document.getElementById('party-select');
  const amountInput = document.getElementById('amount');
  const paymentModeSelect = document.getElementById('payment-mode');
  const bankAccountSection = document.getElementById('bank-account-section');
  const bankAccountSelect = document.getElementById('bank-account-select');
  const narrationInput = document.getElementById('narration');

  // Initialize modal
  initializeModal();

  async function initializeModal() {
    try {
      // Load parties and pre-select current party
      await loadParties(voucher.party_id);

      // Load bank accounts
      await loadBankAccounts();

      // Set up event listeners
      setupEventListeners();

      // Initialize UI state
      handlePaymentModeChange();
      updateSummary();

    } catch (error) {
      console.error('Error initializing modal:', error);
    }
  }

  async function loadParties(selectedPartyId) {
    try {
      const response = await fetch('/api/inventory/sales/parties', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load parties');
      }

      const data = await response.json();
      const parties = data.data || [];

      partySelect.innerHTML = '<option value="">Select Party</option>' +
        parties.map(party => `<option value="${party.id}" ${party.id == selectedPartyId ? 'selected' : ''}>${party.firm} (${party.contact_person || 'N/A'})</option>`).join('');

    } catch (error) {
      console.error('Failed to load parties:', error);
      partySelect.innerHTML = '<option value="">Failed to load parties</option>';
    }
  }

  async function loadBankAccounts() {
    try {
      // For now, just set placeholder - bank accounts API would be needed
      bankAccountSelect.innerHTML = '<option value="">Select Bank Account</option>';
      // TODO: Add bank accounts API call here
    } catch (error) {
      console.error('Failed to load bank accounts:', error);
    }
  }

  function setupEventListeners() {
    // Close modal
    closeBtn.addEventListener('click', () => closeModal());
    cancelBtn.addEventListener('click', () => closeModal());

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Form interactions
    document.querySelectorAll('input[name="voucher_type"]').forEach(radio => {
      radio.addEventListener('change', updateSummary);
    });

    partySelect.addEventListener('change', updateSummary);
    amountInput.addEventListener('input', updateSummary);
    paymentModeSelect.addEventListener('change', handlePaymentModeChange);
    form.addEventListener('submit', handleSubmit);
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

      // Make the actual API call to update the voucher
      const response = await fetch(`/api/ledger/vouchers/${voucher.voucher_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(voucherData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update voucher');
      }

      const result = await response.json();

      // Call the update callback if provided
      if (onUpdate) {
        await onUpdate(voucher.voucher_id, voucherData);
      }

      alert('Voucher updated successfully!');
      closeModal();

    } catch (error) {
      alert('Error updating voucher: ' + error.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Update Voucher';
    }
  }

  function closeModal() {
    modal.remove();
  }

  // Return modal control functions
  return {
    close: closeModal
  };
}
