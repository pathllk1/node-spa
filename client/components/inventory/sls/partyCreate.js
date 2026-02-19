/**
 * PARTY CREATE COMPONENT
 * Handles party creation modal
 */

import { fetchPartyByGST } from './partyManager.js';
import { showToast } from './toast.js';

export function openCreatePartyModal(state, onPartySaved) {
    const subModal = document.getElementById('sub-modal-backdrop');
    const subContent = document.getElementById('sub-modal-content');
    if (!subModal || !subContent) return;

    subModal.classList.remove('hidden');

    subContent.innerHTML = `
        <div class="bg-slate-800 p-4 flex justify-between items-center text-white">
            <h3 class="font-bold text-sm tracking-wide">ADD NEW PARTY</h3>
            <button id="close-sub-modal-party" class="hover:text-red-300 text-lg transition-colors">&times;</button>
        </div>
        
        <form id="create-party-form" class="p-6 grid grid-cols-2 gap-x-6 gap-y-4 overflow-y-auto max-h-96">
            
            <div class="col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Firm Name *</label>
                <input type="text" name="firm" id="new-party-firm" required class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none placeholder-gray-300" placeholder="e.g. M/S Global Enterprises">
            </div>

            <div class="col-span-2 md:col-span-1">
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">GSTIN</label>
                <div class="flex gap-2">
                    <input type="text" name="gstin" id="new-party-gstin" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none font-mono uppercase" placeholder="27ABCDE1234F1Z5" maxlength="15">
                    <button type="button" id="btn-fetch-gst" class="bg-orange-500 hover:bg-orange-600 text-white px-3 rounded text-xs font-bold shadow transition-colors flex items-center justify-center min-w-[60px]">
                        FETCH
                    </button>
                </div>
                <p class="text-[10px] text-gray-400 mt-1">Click Fetch to auto-fill details</p>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Contact No</label>
                <input type="text" name="contact" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">State *</label>
                <input type="text" name="state" id="new-party-state" required class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">State Code</label>
                <input type="number" name="state_code" id="new-party-state-code" class="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50 outline-none" readonly>
            </div>

            <div class="col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Address</label>
                <textarea name="addr" id="new-party-addr" rows="2" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none resize-none"></textarea>
            </div>
            
            <div class="grid grid-cols-2 gap-4 col-span-2">
                <div>
                     <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Pincode</label>
                     <input type="number" name="pin" id="new-party-pin" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
                </div>
                <div>
                     <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">PAN</label>
                     <input type="text" name="pan" id="new-party-pan" class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none uppercase font-mono" maxlength="10">
                </div>
            </div>

            <div class="col-span-2 pt-4 border-t border-gray-100 flex justify-end gap-3 mt-2">
                <button type="button" id="cancel-create-party" class="px-5 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" class="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded shadow hover:bg-blue-700 transition-colors">SAVE PARTY</button>
            </div>
        </form>
    `;

    const closeFunc = () => subModal.classList.add('hidden');
    document.getElementById('close-sub-modal-party').addEventListener('click', closeFunc);
    document.getElementById('cancel-create-party').addEventListener('click', closeFunc);

    // Auto-detect State Code from GSTIN
    const gstinInput = document.getElementById('new-party-gstin');
    gstinInput.addEventListener('input', (e) => {
        const val = e.target.value.toUpperCase();
        e.target.value = val;
        if (val.length >= 2 && !isNaN(val.substring(0, 2))) {
            document.getElementById('new-party-state-code').value = val.substring(0, 2);
        }
        if (val.length >= 12) {
            document.getElementById('new-party-pan').value = val.substring(2, 12);
        }
    });

    // Fetch GST Details
    document.getElementById('btn-fetch-gst').addEventListener('click', function () {
        fetchPartyByGST(this);
    });

    // Form Submit
    document.getElementById('create-party-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        // Ensure all required fields are present
        data.supply = data.state;
        data.gstin = data.gstin || 'UNREGISTERED';
        data.state_code = data.state_code || null;
        data.contact = data.contact || null;
        data.addr = data.addr || null;
        data.pin = data.pin || null;
        data.pan = data.pan || null;

        try {
            const response = await fetch('/api/inventory/sales/parties', {
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
            closeFunc();
            showToast('Party created successfully!', 'success');
            await onPartySaved(result);

        } catch (err) {
            console.error('Error creating party:', err);
            showToast("Error creating party: " + err.message, 'error');
        }
    });
}
