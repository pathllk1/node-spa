import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

export async function renderNewJournalEntry(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
    <div class="max-w-6xl mx-auto px-4 py-12 space-y-8">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">New Journal Entry</h1>
          <p class="text-gray-600 mt-2">Create a new general journal entry</p>
        </div>
        <a href="/ledger/journal-entries" data-navigo class="px-6 py-3 rounded-lg bg-gray-600 text-white font-medium hover:bg-gray-700 transition">
          ← Back to Journal Entries
        </a>
      </div>

      <form id="journal-entry-form" class="bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-6">
        <!-- Header Section -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Transaction Date *</label>
            <input type="date" id="transaction-date" name="transaction_date" required
                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
          </div>
          <div class="md:col-span-1">
            <label class="block text-sm font-semibold text-gray-700 mb-2">Overall Narration</label>
            <input type="text" id="overall-narration" name="narration" placeholder="Overall description of the transaction"
                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
          </div>
        </div>

        <!-- Entries Section -->
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold text-gray-900">Journal Entries</h3>
            <button type="button" id="add-entry-btn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              + Add Entry
            </button>
          </div>

          <div id="entries-container" class="space-y-4">
            <!-- Entry rows will be added here -->
          </div>
        </div>

        <!-- Balance Summary -->
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="text-center">
              <div class="text-sm font-medium text-gray-700">Total Debits</div>
              <div id="total-debits" class="text-2xl font-bold text-green-600">₹0.00</div>
            </div>
            <div class="text-center">
              <div class="text-sm font-medium text-gray-700">Total Credits</div>
              <div id="total-credits" class="text-2xl font-bold text-red-600">₹0.00</div>
            </div>
            <div class="text-center">
              <div class="text-sm font-medium text-gray-700">Balance</div>
              <div id="balance" class="text-2xl font-bold text-gray-900">₹0.00</div>
            </div>
          </div>
        </div>

        <!-- Submit Buttons -->
        <div class="flex justify-end gap-4 pt-6 border-t border-gray-200">
          <a href="/ledger/journal-entries" data-navigo class="px-6 py-3 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition">
            Cancel
          </a>
          <button type="submit" id="save-btn" class="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
            Save Journal Entry
          </button>
        </div>
      </form>
    </div>
  `;

  renderLayout(content, router);

  // Initialize the form after DOM is ready
  setTimeout(() => {
    initJournalEntryForm(router);
  }, 100);
}

function initJournalEntryForm(router) {
  const form = document.getElementById('journal-entry-form');
  const addEntryBtn = document.getElementById('add-entry-btn');
  const entriesContainer = document.getElementById('entries-container');
  const transactionDateInput = document.getElementById('transaction-date');
  const overallNarrationInput = document.getElementById('overall-narration');
  const saveBtn = document.getElementById('save-btn');

  let entryCounter = 0;
  let entries = [];

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  transactionDateInput.value = today;

  // Add first entry row
  addEntryRow();

  // Event listeners
  addEntryBtn.addEventListener('click', addEntryRow);
  form.addEventListener('submit', handleSubmit);

  function addEntryRow() {
    entryCounter++;
    const entryId = `entry-${entryCounter}`;

    const entryHTML = `
      <div class="entry-row bg-white border border-gray-200 rounded-lg p-4" data-entry-id="${entryId}">
        <div class="flex justify-between items-center mb-4">
          <h4 class="text-sm font-medium text-gray-900">Entry ${entryCounter}</h4>
          ${entryCounter > 1 ? `<button type="button" class="remove-entry-btn text-red-600 hover:text-red-700 text-sm" data-entry-id="${entryId}">Remove</button>` : ''}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1.5">Account Head *</label>
            <input type="text" name="account_head_${entryId}" list="account-head-list-${entryId}" required
                   class="account-head-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   placeholder="Select or type account name">
            <datalist id="account-head-list-${entryId}"></datalist>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1.5">Account Type</label>
            <select name="account_type_${entryId}" class="account-type-select w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="GENERAL">General</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="DEBTOR">Debtor</option>
              <option value="CREDITOR">Creditor</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1.5">Debit Amount</label>
            <input type="number" name="debit_amount_${entryId}" step="0.01" min="0"
                   class="debit-amount w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   placeholder="0.00">
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1.5">Credit Amount</label>
            <input type="number" name="credit_amount_${entryId}" step="0.01" min="0"
                   class="credit-amount w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   placeholder="0.00">
          </div>
        </div>

        <div class="mt-4">
          <label class="block text-xs font-semibold text-gray-700 mb-1.5">Narration</label>
          <input type="text" name="narration_${entryId}" placeholder="Entry description"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
        </div>
      </div>
    `;

    entriesContainer.insertAdjacentHTML('beforeend', entryHTML);

    // Load account heads for the new select
    loadAccountHeads(entryId);

    // Add event listeners for the new row
    const row = entriesContainer.querySelector(`[data-entry-id="${entryId}"]`);
    const removeBtn = row.querySelector('.remove-entry-btn');
    const debitInput = row.querySelector('.debit-amount');
    const creditInput = row.querySelector('.credit-amount');

    if (removeBtn) {
      removeBtn.addEventListener('click', () => removeEntryRow(entryId));
    }

    debitInput.addEventListener('input', updateBalance);
    creditInput.addEventListener('input', updateBalance);

    entries.push({
      id: entryId,
      element: row
    });
  }

  function removeEntryRow(entryId) {
    const row = document.querySelector(`[data-entry-id="${entryId}"]`);
    if (row) {
      row.remove();
      entries = entries.filter(e => e.id !== entryId);
      updateBalance();
    }
  }

  async function loadAccountHeads(entryId) {
    try {
      const response = await api.get('/api/ledger/accounts');
      const accounts = response || [];

      const datalist = document.getElementById(`account-head-list-${entryId}`);
      if (datalist) {
        datalist.innerHTML = accounts.map(account =>
          `<option value="${account.account_head}">`
        ).join('');
      }
    } catch (error) {
      console.error('Failed to load account heads:', error);
    }
  }

  function updateBalance() {
    let totalDebits = 0;
    let totalCredits = 0;

    document.querySelectorAll('.entry-row').forEach(row => {
      const debitInput = row.querySelector('.debit-amount');
      const creditInput = row.querySelector('.credit-amount');

      const debit = parseFloat(debitInput.value) || 0;
      const credit = parseFloat(creditInput.value) || 0;

      totalDebits += debit;
      totalCredits += credit;
    });

    const balance = totalDebits - totalCredits;

    document.getElementById('total-debits').textContent = `₹${totalDebits.toFixed(2)}`;
    document.getElementById('total-credits').textContent = `₹${totalCredits.toFixed(2)}`;
    document.getElementById('balance').textContent = `₹${Math.abs(balance).toFixed(2)}`;

    const balanceEl = document.getElementById('balance');
    if (Math.abs(balance) < 0.01) {
      balanceEl.className = 'text-2xl font-bold text-green-600';
    } else {
      balanceEl.className = 'text-2xl font-bold text-red-600';
    }

    // Enable/disable save button based on balance
    saveBtn.disabled = Math.abs(balance) >= 0.01 || totalDebits === 0 || totalCredits === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const transactionDate = transactionDateInput.value;
    const overallNarration = overallNarrationInput.value;

    if (!transactionDate) {
      alert('Please select a transaction date');
      return;
    }

    const entries = [];
    let hasValidEntry = false;

    document.querySelectorAll('.entry-row').forEach(row => {
      const accountHead = row.querySelector('input[name^="account_head_"]').value;
      const accountType = row.querySelector('select[name^="account_type_"]').value;
      const debitAmount = row.querySelector('.debit-amount').value;
      const creditAmount = row.querySelector('.credit-amount').value;
      const narration = row.querySelector('input[name^="narration_"]').value;

      if (accountHead) {
        const debit = parseFloat(debitAmount) || 0;
        const credit = parseFloat(creditAmount) || 0;

        if (debit > 0 || credit > 0) {
          entries.push({
            account_head: accountHead,
            account_type: accountType,
            debit_amount: debit.toString(),
            credit_amount: credit.toString(),
            narration: narration || overallNarration || `Journal Entry`
          });
          hasValidEntry = true;
        }
      }
    });

    if (!hasValidEntry) {
      alert('Please add at least one valid journal entry');
      return;
    }

    const totalDebits = entries.reduce((sum, entry) => sum + parseFloat(entry.debit_amount), 0);
    const totalCredits = entries.reduce((sum, entry) => sum + parseFloat(entry.credit_amount), 0);

    if (Math.abs(totalDebits - totalCredits) >= 0.01) {
      alert('Journal entry must be balanced. Total debits must equal total credits.');
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const response = await api.post('/api/ledger/journal-entries', {
        entries,
        narration: overallNarration,
        transaction_date: transactionDate
      });

      if (response.message) {
        alert('Journal entry created successfully!');
        router.navigate('/ledger/journal-entries');
      }
    } catch (error) {
      alert('Error creating journal entry: ' + error.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Journal Entry';
    }
  }

  // Add event listeners for existing remove buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-entry-btn')) {
      const entryId = e.target.dataset.entryId;
      removeEntryRow(entryId);
    }
  });
}
