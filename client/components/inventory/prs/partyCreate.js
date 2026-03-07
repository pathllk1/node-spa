/**
 * PARTY CREATE COMPONENT
 * Handles party creation modal
 */

import { fetchPartyByGST } from './partyManager.js';
import { showToast }       from './toast.js';
import { fetchWithCSRF }   from '../../../utils/api.js';
import { escHtml }         from './utils.js';

export function openCreatePartyModal(state, onPartySaved) {
    const subModal   = document.getElementById('sub-modal-backdrop');
    const subContent = document.getElementById('sub-modal-content');
    if (!subModal || !subContent) return;

    subModal.classList.remove('hidden');

    subContent.innerHTML = `
        <div class="bg-gradient-to-r from-slate-800 to-slate-700 p-4 flex justify-between items-center text-white">
            <div>
                <h3 class="font-bold text-sm tracking-wide">ADD NEW PARTY</h3>
                <p class="text-slate-400 text-[10px] mt-0.5">Fill in party details below</p>
            </div>
            <button id="close-sub-modal-party" class="hover:text-red-300 text-xl transition-colors w-7 h-7 flex items-center justify-center">&times;</button>
        </div>

        <form id="create-party-form" class="p-5 grid grid-cols-2 gap-x-5 gap-y-3.5 overflow-y-auto max-h-[72vh]">

            <div class="col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Firm Name *</label>
                <input type="text" name="firm" id="new-party-firm" required
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none"
                       placeholder="e.g. M/S Global Enterprises">
            </div>

            <div class="col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">GSTIN</label>
                <div class="flex gap-2">
                    <input type="text" name="gstin" id="new-party-gstin"
                           class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none font-mono uppercase"
                           placeholder="27ABCDE1234F1Z5" maxlength="15">
                    <button type="button" id="btn-fetch-gst"
                            class="shrink-0 bg-orange-500 hover:bg-orange-600 text-white px-3 rounded-lg text-xs font-bold shadow transition-colors min-w-[60px]">
                        FETCH
                    </button>
                </div>
                <p class="text-[10px] text-gray-400 mt-1">Click Fetch to auto-fill details from GST portal</p>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Contact No</label>
                <input type="text" name="contact"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">State *</label>
                <input type="text" name="state" id="new-party-state" required
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">State Code</label>
                <input type="number" name="state_code" id="new-party-state-code"
                       class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 outline-none text-gray-400 cursor-not-allowed" readonly>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">PAN</label>
                <input type="text" name="pan" id="new-party-pan"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none uppercase font-mono"
                       maxlength="10">
            </div>

            <div class="col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Address</label>
                <textarea name="addr" id="new-party-addr" rows="2"
                          class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none resize-none"></textarea>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Pincode</label>
                <input type="number" name="pin" id="new-party-pin"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
            </div>

            <div class="col-span-2 pt-4 border-t border-gray-100 flex justify-end gap-2 mt-1">
                <button type="button" id="cancel-create-party"
                        class="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded-lg transition-colors">
                    Cancel
                </button>
                <button type="submit"
                        class="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
                    Save Party
                </button>
            </div>
        </form>
    `;

    const closeFunc = () => subModal.classList.add('hidden');
    document.getElementById('close-sub-modal-party').addEventListener('click', closeFunc);
    document.getElementById('cancel-create-party').addEventListener('click', closeFunc);

    // Auto-detect State Code + PAN from GSTIN
    document.getElementById('new-party-gstin').addEventListener('input', e => {
        const val = e.target.value.toUpperCase();
        e.target.value = val;
        if (val.length >= 2 && !isNaN(val.substring(0, 2))) {
            document.getElementById('new-party-state-code').value = val.substring(0, 2);
        }
        if (val.length >= 12) {
            document.getElementById('new-party-pan').value = val.substring(2, 12);
        }
    });

    document.getElementById('btn-fetch-gst').addEventListener('click', function () {
        fetchPartyByGST(this);
    });

    document.getElementById('create-party-form').addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data     = Object.fromEntries(formData.entries());

        data.supply     = data.state;
        data.gstin      = data.gstin   || 'UNREGISTERED';
        data.state_code = data.state_code || null;
        data.contact    = data.contact || null;
        data.addr       = data.addr    || null;
        data.pin        = data.pin     || null;
        data.pan        = data.pan     || null;

        try {
            const response = await fetchWithCSRF('/api/inventory/purchase/parties', {
                method: 'POST',
                body:   JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                showToast(error.error || `Failed (${response.status})`, 'error');
                return;
            }

            const result = await response.json();
            if (!result.success) {
                showToast(result.error || 'Failed to create party', 'error');
                return;
            }

            closeFunc();
            showToast('Party created successfully!', 'success');
            await onPartySaved(result.data || result);

        } catch (err) {
            console.error('Error creating party:', err);
            showToast('Error creating party: ' + err.message, 'error');
        }
    });
}