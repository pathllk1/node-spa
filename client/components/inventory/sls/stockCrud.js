/**
 * STOCK CRUD COMPONENT
 * Handles stock create and edit operations
 */

import { showToast } from './toast.js';

export function openCreateStockModal(state, onStockSaved) {
    const subModal = document.getElementById('sub-modal-backdrop');
    const subContent = document.getElementById('sub-modal-content');
    if (!subModal || !subContent) return;

    subModal.classList.remove('hidden');

    subContent.innerHTML = `
        <div class="bg-slate-800 p-4 flex justify-between items-center text-white">
            <h3 class="font-bold text-sm tracking-wide">CREATE NEW STOCK ITEM</h3>
            <button id="close-sub-modal" class="hover:text-red-300 text-lg transition-colors">&times;</button>
        </div>
        
        <form id="create-stock-form" class="p-6 grid grid-cols-2 gap-x-6 gap-y-4 overflow-y-auto max-h-[70vh] lg:max-h-[80vh]">
            <div class="col-span-2">
                <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Item Description *</label>
                <input type="text" name="item" required class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" placeholder="e.g. Dell Monitor 24 inch">
            </div>
            
            <div id="batch-field-container">
                <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Batch No</label>
                <input type="text" name="batch" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" placeholder="Enter batch number (optional)">
            </div>
            
            <div>
                <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Part No (P/No)</label>
                <input type="text" name="pno" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">OEM / Brand</label>
                <input type="text" name="oem" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">HSN/SAC Code *</label>
                <input type="text" name="hsn" required class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" placeholder="Enter HSN for goods or SAC for services">
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Opening Qty *</label>
                    <input type="number" step="0.01" name="qty" required class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" placeholder="0.00">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">UOM *</label>
                    <select name="uom" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none bg-white">
                        <option value="NOS">NOS</option>
                        <option value="PCS">PCS</option>
                        <option value="SET">SET</option>
                        <option value="BOX">BOX</option>
                        <option value="MTR">MTR</option>
                        <option value="KGS">KGS</option>
                    </select>
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Selling Rate (₹) *</label>
                <input type="number" step="0.01" name="rate" required class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">GST % *</label>
                    <select name="grate" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none bg-white">
                        <option value="18">18%</option>
                        <option value="12">12%</option>
                        <option value="5">5%</option>
                        <option value="28">28%</option>
                        <option value="0">0%</option>
                    </select>
                </div>
                <div>
                     <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">MRP</label>
                     <input type="number" step="0.01" name="mrp" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
                </div>
            </div>

            <div>
                 <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Expiry Date</label>
                 <input type="date" name="expiryDate" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
            </div>

            <div class="col-span-2 pt-6 border-t border-gray-100 flex justify-end gap-3 mt-2">
                <button type="button" id="cancel-create-stock" class="px-5 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" class="px-6 py-2 bg-slate-800 text-white text-sm font-bold rounded shadow hover:bg-slate-900 transition-colors">SAVE</button>
            </div>
        </form>
    `;

    const closeModal = () => subModal.classList.add('hidden');
    document.getElementById('close-sub-modal').onclick = closeModal;
    document.getElementById('cancel-create-stock').onclick = closeModal;

    document.getElementById('create-stock-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        data.total = (parseFloat(data.qty) * parseFloat(data.rate)).toFixed(2);
        data.created_at = new Date().toISOString();
        data.updated_at = new Date().toISOString();

        if (data.batch || data.expiryDate || data.mrp) {
            const batchObj = {
                batch: data.batch || null,
                qty: parseFloat(data.qty) || 0,
                rate: parseFloat(data.rate) || 0,
                expiry: data.expiryDate || null,
                mrp: data.mrp ? parseFloat(data.mrp) : null
            };
            
            data.batches = JSON.stringify([batchObj]);
            delete data.batch;
            delete data.expiryDate;
            delete data.mrp;
        }

        try {
            closeModal();
            
            // Call API to create stock
            const response = await fetch('/api/inventory/sales/stocks', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Stock created:', result);
            showToast('Stock item created successfully!', 'success');
            await onStockSaved(data);
        } catch (err) {
            console.error(err);
            showToast("Error creating stock: " + err.message, 'error');
        }
    });
}

export function openEditStockModal(stock, state, onStockSaved) {
    const subModal = document.getElementById('sub-modal-backdrop');
    const subContent = document.getElementById('sub-modal-content');
    if (!subModal || !subContent) return;

    if (!stock || !stock.id) {
        showToast('Invalid stock item.', 'error');
        return;
    }

    subModal.classList.remove('hidden');

    const batchValue = stock.batches && Array.isArray(stock.batches) && stock.batches.length > 0 
        ? (stock.batches[0]?.batch || '') 
        : (stock.batch || '');

    subContent.innerHTML = `
        <div class="bg-slate-800 p-4 flex justify-between items-center text-white">
            <h3 class="font-bold text-sm tracking-wide">EDIT STOCK ITEM</h3>
            <button id="close-sub-modal" class="hover:text-red-300 text-lg transition-colors">&times;</button>
        </div>
        
        <form id="edit-stock-form" class="p-6 grid grid-cols-2 gap-x-6 gap-y-4 overflow-y-auto max-h-[70vh] lg:max-h-[80vh]">
            <div class="col-span-2">
                <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Item Description *</label>
                <input type="text" name="item" required class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" value="${(stock.item || '').replace(/"/g, '&quot;')}">
            </div>
            
            <div id="batch-field-container" class="col-span-2">
                <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Batch No</label>
                <input type="text" name="batch" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" value="${batchValue.replace(/"/g, '&quot;')}">
                <input type="hidden" name="selectedBatchIndex" value="">
            </div>
            
            <div id="batch-details" class="col-span-2 hidden p-3 bg-gray-50 rounded text-sm">
                <p class="text-gray-600">Select a batch to see details</p>
            </div>
            
            <div>
                <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Part No (P/No)</label>
                <input type="text" name="pno" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" value="${(stock.pno || '').replace(/"/g, '&quot;')}">
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">OEM / Brand</label>
                <input type="text" name="oem" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" value="${(stock.oem || '').replace(/"/g, '&quot;')}">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">HSN/SAC Code *</label>
                <input type="text" name="hsn" required class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" value="${(stock.hsn || '').replace(/"/g, '&quot;')}">
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Qty *</label>
                    <input type="number" step="0.01" name="qty" required class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" value="${Number(stock.qty || 0)}">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">UOM *</label>
                    <select name="uom" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none bg-white">
                        <option value="NOS" ${stock.uom === 'NOS' ? 'selected' : ''}>NOS</option>
                        <option value="PCS" ${stock.uom === 'PCS' ? 'selected' : ''}>PCS</option>
                        <option value="SET" ${stock.uom === 'SET' ? 'selected' : ''}>SET</option>
                        <option value="BOX" ${stock.uom === 'BOX' ? 'selected' : ''}>BOX</option>
                        <option value="MTR" ${stock.uom === 'MTR' ? 'selected' : ''}>MTR</option>
                        <option value="KGS" ${stock.uom === 'KGS' ? 'selected' : ''}>KGS</option>
                    </select>
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Selling Rate (₹) *</label>
                <input type="number" step="0.01" name="rate" required class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" value="${Number(stock.rate || 0)}">
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">GST % *</label>
                    <select name="grate" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none bg-white">
                        <option value="18" ${Number(stock.grate) === 18 ? 'selected' : ''}>18%</option>
                        <option value="12" ${Number(stock.grate) === 12 ? 'selected' : ''}>12%</option>
                        <option value="5" ${Number(stock.grate) === 5 ? 'selected' : ''}>5%</option>
                        <option value="28" ${Number(stock.grate) === 28 ? 'selected' : ''}>28%</option>
                        <option value="0" ${Number(stock.grate) === 0 ? 'selected' : ''}>0%</option>
                    </select>
                </div>
                <div>
                     <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">MRP</label>
                     <input type="number" step="0.01" name="mrp" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" value="${stock.mrp ? Number(stock.mrp) : ''}">
                </div>
            </div>

            <div>
                 <label class="block text-xs font-bold text-gray-600 mb-1 uppercase">Expiry Date</label>
                 <input type="date" name="expiryDate" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" value="${stock.expiryDate || ''}">
            </div>

            <div class="col-span-2 pt-6 border-t border-gray-100 flex justify-end gap-3 mt-2">
                <button type="button" id="cancel-edit-stock" class="px-5 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" class="px-6 py-2 bg-slate-800 text-white text-sm font-bold rounded shadow hover:bg-slate-900 transition-colors">UPDATE</button>
            </div>
        </form>
    `;

    const closeModal = () => subModal.classList.add('hidden');
    document.getElementById('close-sub-modal').onclick = closeModal;
    document.getElementById('cancel-edit-stock').onclick = closeModal;

    // Show batch selection if multiple batches exist
    if (stock.batches && Array.isArray(stock.batches) && stock.batches.length > 1) {
        showBatchSelectionForEdit(stock);
    }

    document.getElementById('edit-stock-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        let data = Object.fromEntries(formData.entries());

        data.total = (parseFloat(data.qty) * parseFloat(data.rate)).toFixed(2);
        data.updated_at = new Date().toISOString();
        
        if (data.batch || data.expiryDate || data.mrp) {
            const batchObj = {
                batch: data.batch || null,
                qty: parseFloat(data.qty) || 0,
                rate: parseFloat(data.rate) || 0,
                expiry: data.expiryDate || null,
                mrp: data.mrp ? parseFloat(data.mrp) : null
            };
            
            data.batches = JSON.stringify([batchObj]);
            delete data.batch;
            delete data.expiryDate;
            delete data.mrp;
        }

        try {
            closeModal();
            
            // Call API to update stock
            const response = await fetch(`/api/inventory/sales/stocks/${stock.id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Stock updated:', result);
            showToast('Stock item updated successfully!', 'success');
            await onStockSaved(stock.id, data);
        } catch (err) {
            console.error(err);
            showToast("Error updating stock: " + err.message, 'error');
        }
    });
}

function showBatchSelectionForEdit(stock) {
    const batchContainer = document.getElementById('batch-field-container');
    if (!batchContainer) return;
    
    // Create the batch selection dropdown
    const select = document.createElement('select');
    select.id = 'batch-select';
    select.name = 'batch-select';
    select.className = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none mb-2';
    
    // Add an option for "Select a batch" as default
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a batch to edit';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
    
    // Add options for each batch
    stock.batches.forEach((batch, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${batch.batch || 'No Batch'} (Qty: ${batch.qty}, Exp: ${batch.expiry || 'N/A'})`;
        select.appendChild(option);
    });
    
    // Create a container for batch details
    const detailsContainer = document.getElementById('batch-details');
    
    // Create the label
    const label = document.createElement('label');
    label.className = 'block text-xs font-bold text-gray-600 mb-1 uppercase';
    label.textContent = 'Select Batch to Edit';
    
    // Clear and rebuild the batch field container
    batchContainer.innerHTML = '';
    batchContainer.appendChild(label);
    batchContainer.appendChild(select);
    
    // Add event listener to handle batch selection
    select.addEventListener('change', function() {
        const batchIndex = parseInt(this.value);
        if (!isNaN(batchIndex) && batchIndex >= 0) {
            const selectedBatch = stock.batches[batchIndex];
            
            // Update form fields with selected batch data
            const form = select.closest('form');
            if (form) {
                const batchInput = form.querySelector('input[name="batch"]');
                if (batchInput) {
                    batchInput.value = selectedBatch.batch || '';
                }
                
                const mrpInput = form.querySelector('input[name="mrp"]');
                if (mrpInput) {
                    mrpInput.value = selectedBatch.mrp || '';
                }
                
                const expiryInput = form.querySelector('input[name="expiryDate"]');
                if (expiryInput) {
                    expiryInput.value = selectedBatch.expiry ? selectedBatch.expiry.split('T')[0] : '';
                }
                
                const qtyInput = form.querySelector('input[name="qty"]');
                if (qtyInput) {
                    qtyInput.value = selectedBatch.qty || '';
                }
                
                const rateInput = form.querySelector('input[name="rate"]');
                if (rateInput) {
                    rateInput.value = selectedBatch.rate || '';
                }
                
                const batchIndexInput = form.querySelector('input[name="selectedBatchIndex"]');
                if (batchIndexInput) {
                    batchIndexInput.value = batchIndex;
                }
            }
            
            // Show batch details
            detailsContainer.innerHTML = `
                <div class="font-medium text-gray-800">Selected Batch: ${selectedBatch.batch || 'No Batch'}</div>
                <div class="text-gray-600">Quantity: ${selectedBatch.qty}</div>
                <div class="text-gray-600">Rate: ${selectedBatch.rate}</div>
                <div class="text-gray-600">Expiry: ${selectedBatch.expiry || 'N/A'}</div>
                <div class="text-gray-600">MRP: ${selectedBatch.mrp || 'N/A'}</div>
            `;
            detailsContainer.classList.remove('hidden');
        }
    });
}
