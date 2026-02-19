/**
 * CHARGES MODAL COMPONENT
 * Handles other charges management (add, remove, edit)
 */

import { showToast } from './toast.js';

export function openOtherChargesModal(state, callbacks) {
    const { onAddCharge, onRemoveCharge, onUpdateCharge, formatCurrency } = callbacks;
    
    const modal = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;
    
    modal.classList.remove('hidden');

    const renderChargesList = () => {
        if (state.otherCharges.length === 0) {
            return `<tr><td colspan="6" class="p-3 text-center text-gray-400 italic">No other charges added</td></tr>`;
        }
        
        return state.otherCharges.map((charge, idx) => {
            const chargeAmount = parseFloat(charge.amount) || 0;
            const chargeGstRate = parseFloat(charge.gstRate) || 0;
            const chargeGstAmount = (chargeAmount * chargeGstRate) / 100;
            const chargeTotal = chargeAmount + chargeGstAmount;
            
            return `
                <tr class="hover:bg-blue-50 transition-colors border-b border-gray-50">
                    <td class="p-3 font-semibold text-gray-800">${charge.name}</td>
                    <td class="p-3 text-gray-500">${charge.type || '-'}</td>
                    <td class="p-3 text-gray-500">${charge.hsnSac || '-'}</td>
                    <td class="p-3 text-right font-mono">${formatCurrency(chargeAmount)}</td>
                    <td class="p-3 text-right">${chargeGstRate}%</td>
                    <td class="p-3 text-right font-bold">${formatCurrency(chargeTotal)}</td>
                    <td class="p-3 text-center">
                        <button class="btn-remove-charge bg-red-50 border border-red-200 text-red-600 px-2 py-1 rounded text-[10px] font-bold hover:bg-red-100 transition-colors" data-idx="${idx}">
                            REMOVE
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    };

    content.innerHTML = `
        <div class="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 class="font-bold text-lg text-gray-800">Other Charges</h3>
            <button id="close-modal" class="text-gray-400 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 bg-white">
            <div class="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
                <div class="relative">
                    <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Charge Name *</label>
                    <input type="text" id="charge-name" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" placeholder="e.g. Freight, Packing">
                    <div id="charge-name-suggestions" class="hidden absolute bg-white border border-gray-300 rounded shadow-lg mt-1 w-full max-h-48 overflow-y-auto z-50"></div>
                </div>
                
                <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Type</label>
                    <select id="charge-type" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none bg-white">
                        <option value="freight">Freight</option>
                        <option value="packing">Packing</option>
                        <option value="insurance">Insurance</option>
                        <option value="handling">Handling</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">HSN/SAC Code</label>
                    <input type="text" id="charge-hsn" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" placeholder="e.g. 9965">
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Amount (₹) *</label>
                    <input type="number" step="0.01" id="charge-amount" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" placeholder="0.00">
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">GST %</label>
                    <select id="charge-gst" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none bg-white">
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                    </select>
                </div>

                <div class="flex items-end">
                    <button id="add-charge-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold shadow transition-colors">
                        ADD CHARGE
                    </button>
                </div>
            </div>

            <div class="mb-4">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-bold text-gray-800">Charges List</h4>
                    <div class="text-sm text-gray-600">
                        Total: <span id="total-other-charges" class="font-bold text-blue-600">${formatCurrency(0)}</span>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-gray-100 text-[11px] font-bold text-gray-600 uppercase sticky top-0 border-b border-gray-200">
                            <tr>
                                <th class="p-3">Charge Name</th>
                                <th class="p-3">Type</th>
                                <th class="p-3">HSN/SAC</th>
                                <th class="p-3 text-right">Amount</th>
                                <th class="p-3 text-right">GST %</th>
                                <th class="p-3 text-right">Total</th>
                                <th class="p-3 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody class="text-xs text-gray-700 divide-y divide-gray-100 bg-white" id="other-charges-list">
                            ${renderChargesList()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button id="cancel-other-charges" class="px-5 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded">Cancel</button>
            <button id="save-other-charges" class="px-6 py-2 bg-slate-800 text-white text-sm font-bold rounded shadow hover:bg-slate-900 transition-colors">SAVE</button>
        </div>
    `;

    // Load existing charges for autocomplete
    let existingCharges = [];
    
    async function loadExistingCharges() {
        try {
            const response = await fetch('/api/inventory/sales/other-charges-types', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                // Use the full charge objects returned from API
                existingCharges = data.charges || [];
            }
        } catch (error) {
            console.warn('Error loading existing charges:', error);
        }
    }
    
    loadExistingCharges();

    // Update total display
    const updateTotalDisplay = () => {
        const total = state.otherCharges.reduce((sum, charge) => {
            const chargeAmount = parseFloat(charge.amount) || 0;
            const chargeGstRate = parseFloat(charge.gstRate) || 0;
            const chargeGstAmount = (chargeAmount * chargeGstRate) / 100;
            return sum + chargeAmount + chargeGstAmount;
        }, 0);
        
        const totalElement = document.getElementById('total-other-charges');
        if (totalElement) {
            totalElement.textContent = formatCurrency(total);
        }
    };

    // Autocomplete functionality for charge name
    const chargeNameInput = document.getElementById('charge-name');
    const suggestionsContainer = document.getElementById('charge-name-suggestions');
    
    chargeNameInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        
        if (query.length === 0) {
            suggestionsContainer.classList.add('hidden');
            return;
        }
        
        // Filter existing charges based on query
        const filteredCharges = existingCharges.filter(charge => 
            charge.name.toLowerCase().includes(query) || 
            charge.type.toLowerCase().includes(query)
        );
        
        if (filteredCharges.length > 0) {
            suggestionsContainer.innerHTML = filteredCharges.map(charge => {
                return `<div class="charge-suggestion-item p-2 hover:bg-blue-100 cursor-pointer border-b border-gray-100" 
                        data-name="${charge.name}" 
                        data-type="${charge.type}" 
                        data-hsnSac="${charge.hsnSac || ''}" 
                        data-gstRate="${charge.gstRate || 0}">
                        <div class="font-medium truncate">${charge.name || charge.type}</div>
                        <div class="text-xs text-gray-500 truncate">Type: ${charge.type} | HSN/SAC: ${charge.hsnSac || 'N/A'} | GST: ${charge.gstRate || 0}%</div>
                    </div>`;
            }).join('');
            
            // Add event listeners to suggestion items
            suggestionsContainer.querySelectorAll('.charge-suggestion-item').forEach(item => {
                item.addEventListener('click', function() {
                    const name = this.getAttribute('data-name');
                    const type = this.getAttribute('data-type');
                    const hsnSac = this.getAttribute('data-hsnSac');
                    const gstRate = this.getAttribute('data-gstRate');
                    
                    // Fill the form with selected values
                    if (name) document.getElementById('charge-name').value = name;
                    if (type) document.getElementById('charge-type').value = type;
                    if (hsnSac) document.getElementById('charge-hsn').value = hsnSac;
                    if (gstRate) document.getElementById('charge-gst').value = gstRate;
                    
                    // Hide suggestions
                    suggestionsContainer.classList.add('hidden');
                });
            });
            
            suggestionsContainer.classList.remove('hidden');
        } else {
            suggestionsContainer.classList.add('hidden');
        }
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!suggestionsContainer.contains(e.target) && e.target !== chargeNameInput) {
            suggestionsContainer.classList.add('hidden');
        }
    });

    // Add charge button
    document.getElementById('add-charge-btn').onclick = () => {
        const name = document.getElementById('charge-name').value.trim();
        const hsnSac = document.getElementById('charge-hsn').value.trim();
        const amount = parseFloat(document.getElementById('charge-amount').value);
        const gstRate = parseFloat(document.getElementById('charge-gst').value) || 0;
        const type = document.getElementById('charge-type').value;
        
        if (!name) {
            showToast('Please enter a charge name', 'error');
            return;
        }
        
        if (isNaN(amount) || amount <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        
        onAddCharge({ name, hsnSac, amount, gstRate, type });
        
        // Clear inputs
        document.getElementById('charge-name').value = '';
        document.getElementById('charge-hsn').value = '';
        document.getElementById('charge-amount').value = '';
        document.getElementById('charge-gst').value = '';
        
        // Update display
        const chargesList = document.getElementById('other-charges-list');
        if (chargesList) {
            chargesList.innerHTML = renderChargesList();
        }
        updateTotalDisplay();
        attachRemoveListeners();
    };

    // Remove charge listeners
    const attachRemoveListeners = () => {
        document.querySelectorAll('.btn-remove-charge').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'));
                onRemoveCharge(idx);
                
                const chargesList = document.getElementById('other-charges-list');
                if (chargesList) {
                    chargesList.innerHTML = renderChargesList();
                }
                updateTotalDisplay();
                attachRemoveListeners();
            });
        });
    };

    attachRemoveListeners();

    // Close buttons
    document.getElementById('close-modal').onclick = () => modal.classList.add('hidden');
    document.getElementById('cancel-other-charges').onclick = () => modal.classList.add('hidden');
    document.getElementById('save-other-charges').onclick = () => {
        modal.classList.add('hidden');
        
        // Call the onSave callback if provided
        if (callbacks.onSave) {
            callbacks.onSave();
        }
    };

    updateTotalDisplay();
}
