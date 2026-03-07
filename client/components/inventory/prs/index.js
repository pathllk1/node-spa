/**
 * PURCHASE SYSTEM (PRS) - MAIN ORCHESTRATOR
 * Coordinates all components and manages the application lifecycle
 */

import { createInitialState, fetchCurrentUserFirmName, fetchData, loadExistingBillData } from './stateManager.js';
import { formatCurrency, populateConsigneeFromBillTo, getPartyId, escHtml } from './utils.js';
import { addOtherCharge, removeOtherCharge, updateOtherCharge } from './otherChargesManager.js';
import { addItemToCart, removeItemFromCart, updateCartItem, updateCartItemNarration, clearCart } from './cartManager.js';
import { renderItemsList, renderTotals, renderPartyCard } from './layoutRenderer.js';
import { openStockModal } from './stockModal.js';
import { showBatchSelectionModal } from './batchModal.js';
import { openPartyItemHistoryModal } from './historyModal.js';
import { openCreateStockModal, openEditStockModal } from './stockCrud.js';
import { openOtherChargesModal } from './chargesModal.js';
import { openPartyModal } from './partyModal.js';
import { openCreatePartyModal } from './partyCreate.js';
import { showToast } from './toast.js';
import { exportInvoiceToPDF } from './invoiceExport.js';
import { fetchWithCSRF } from '../../../utils/api.js';

export function initPurchaseSystem(router) {
    const container = document.getElementById('purchase-system');
    if (!container) return;

    // FIX: Removed all [LOAD_BILL_DATA] and URL/param debug console.log calls

    const urlParams      = new URLSearchParams(window.location.search);
    const editBillIdParam = urlParams.get('edit');
    const sessionEditId   = sessionStorage.getItem('editBillId');
    const finalEditParam  = editBillIdParam || sessionEditId;

    let editBillId  = null;
    let isEditMode  = false;

    if (finalEditParam) {
        const isValidObjectId = /^[a-f\d]{24}$/i.test(finalEditParam);
        if (isValidObjectId) {
            editBillId  = finalEditParam;
            isEditMode  = true;
        } else {
            console.warn('Invalid edit bill ID:', finalEditParam);
            sessionStorage.removeItem('editBillId');
            window.location.href = '/inventory/sls';
            return;
        }
    }

    const state = createInitialState();

    fetchCurrentUserFirmName(state);

    if (isEditMode) {
        loadExistingBillData(state, editBillId).then(() => {
            sessionStorage.removeItem('editBillId');
            fetchData(state).then(() => {
                renderMainLayout(isEditMode);
            }).catch(err => {
                console.error('Failed to load data for edit mode:', err);
                showEditError(container, err.message, editBillId);
            });
        }).catch(err => {
            console.error('Failed to load bill data:', err);
            sessionStorage.removeItem('editBillId');
            showEditError(container, err.message, editBillId);
        });
    } else {
        fetchData(state).then(() => {
            renderMainLayout(isEditMode);
        }).catch(err => {
            console.error('Failed to load data:', err);
            // FIX: escHtml on err.message before innerHTML interpolation
            container.innerHTML = `
                <div class="p-8 text-center text-red-600 border border-red-200 bg-red-50 rounded">
                    <h3 class="font-bold text-lg">System Error</h3>
                    <p>${escHtml(err.message)}</p>
                    <button class="reload-system-btn mt-4 px-4 py-2 bg-red-600 text-white rounded shadow">Reload System</button>
                </div>`;
            const reloadBtn = container.querySelector('.reload-system-btn');
            if (reloadBtn) reloadBtn.addEventListener('click', () => location.reload());
        });
    }

    function showEditError(container, errorMessage, billId) {
        // FIX: escHtml on both errorMessage (JS Error.message, not DB-sanitized) and billId
        container.innerHTML = `
            <div class="p-8 text-center text-red-600 border border-red-200 bg-red-50 rounded">
                <h3 class="font-bold text-lg">Edit Bill Error</h3>
                <p class="mb-4">Unable to load bill ${escHtml(String(billId))} for editing:</p>
                <p class="mb-6 font-mono text-sm">${escHtml(errorMessage)}</p>
                <div class="flex gap-3 justify-center">
                    <button onclick="window.location.href='/inventory/sls-rpt'"
                            class="px-4 py-2 bg-gray-600 text-white rounded shadow hover:bg-gray-700 transition">
                        Back to Sales Report
                    </button>
                    <button onclick="window.location.href='/inventory/sls'"
                            class="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition">
                        Create New Bill
                    </button>
                </div>
            </div>`;
    }

    function renderMainLayout(isEditMode = false) {
        container.innerHTML = `
        <div class="h-[calc(100vh-140px)] flex flex-col bg-gray-50 text-slate-800 font-sans text-sm border border-gray-300 rounded-lg shadow-sm overflow-hidden">

            <!-- Header -->
            <div class="bg-white border-b border-gray-200 p-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-sm z-20">
                <div class="flex flex-col sm:flex-row flex-wrap gap-2">
                    <div class="flex items-center gap-2">
                        <h1 class="text-lg font-bold text-gray-800">Purchase Invoice</h1>
                        ${isEditMode ? '<span class="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full border border-orange-200">EDIT MODE</span>' : ''}
                    </div>
                    <div class="flex flex-col">
                        <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Bill No</label>
                        <input type="text" value="${escHtml(state.meta.billNo)}" readonly
                               class="border border-gray-300 rounded px-2 py-1 text-xs font-bold w-32 bg-gray-100 text-slate-500 cursor-not-allowed"
                               title="${isEditMode ? 'Bill number cannot be changed in edit mode' : 'Auto-generated when saved'}">
                    </div>
                    <div class="flex flex-col">
                        <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Date</label>
                        <input type="date" value="${escHtml(state.meta.billDate)}"
                               class="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-slate-700">
                    </div>
                    <div class="flex flex-col">
                        <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Transaction Type</label>
                        <select id="billTypeSelector" class="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-700 font-medium">
                            <option value="intra-state" ${state.meta.billType === 'intra-state' ? 'selected' : ''}>Intra-State (CGST + SGST)</option>
                            <option value="inter-state" ${state.meta.billType === 'inter-state' ? 'selected' : ''}>Inter-State (IGST)</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-2 pt-4">
                        <label class="flex items-center cursor-pointer">
                            <input type="checkbox" id="reverse-charge-toggle" ${state.meta.reverseCharge ? 'checked' : ''} class="form-checkbox h-4 w-4 text-blue-600 rounded">
                            <span class="ml-2 text-[10px] uppercase text-gray-500 font-bold tracking-wider whitespace-nowrap">Reverse Charge</span>
                        </label>
                        <div class="text-[10px] font-bold px-2 py-1 rounded ${state.gstEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            GST: ${state.gstEnabled ? 'ON' : 'OFF'}
                        </div>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2">
                    <button id="btn-other-charges" class="px-3 py-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded hover:bg-blue-100 transition-colors whitespace-nowrap">Other Charges</button>
                    <button id="btn-reset"         class="px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50 rounded hover:bg-red-100 transition-colors whitespace-nowrap">Reset</button>
                    <button id="btn-save"          class="px-4 py-1.5 bg-slate-800 text-white text-xs rounded hover:bg-slate-900 shadow font-medium flex items-center gap-2 transition-colors whitespace-nowrap">
                        <span id="save-icon">💾</span>
                        <span id="save-text">${isEditMode ? 'Update Purchase Bill' : 'Save Purchase Invoice'}</span>
                        <div id="save-spinner" class="hidden w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"></div>
                    </button>
                </div>
            </div>

            <!-- Main Content -->
            <div class="flex-1 overflow-hidden flex flex-col md:flex-row">

                <!-- Sidebar -->
                <div class="w-full md:w-64 bg-slate-50 border-r border-gray-200 flex flex-col overflow-y-auto z-10">
                    <div class="p-3 border-b border-gray-200 bg-white">
                        <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Bill To</label>
                        <div id="party-display">
                            <div class="group bg-blue-50 p-3 rounded border border-blue-200 shadow-sm">
                                <h3 class="font-bold text-sm text-blue-900 truncate">Loading…</h3>
                                <p class="text-[11px] text-gray-600 truncate mt-1">Please wait</p>
                            </div>
                        </div>
                    </div>

                    <!-- Consignee Section -->
                    <div class="p-3 border-b border-gray-200 bg-white mt-3">
                        <div class="flex justify-between items-center mb-2">
                            <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Consignee Details</label>
                            <label class="flex items-center cursor-pointer text-[10px] text-blue-600 font-medium">
                                <input type="checkbox" id="consignee-same-as-bill-to" ${state.consigneeSameAsBillTo ? 'checked' : ''} class="form-checkbox h-3 w-3 text-blue-600 rounded mr-1">
                                Same as Bill To
                            </label>
                        </div>
                        <div id="consignee-display">
                            <div class="space-y-2">
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">Consignee Name *</label>
                                    <input type="text" id="consignee-name" value="${escHtml(state.selectedConsignee?.name || '')}"
                                           class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="Enter consignee name">
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">Address *</label>
                                    <textarea id="consignee-address" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none h-16 resize-none" placeholder="Enter delivery address">${escHtml(state.selectedConsignee?.address || '')}</textarea>
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-[10px] text-gray-500 font-bold mb-1 block">GSTIN</label>
                                        <input type="text" id="consignee-gstin" value="${escHtml(state.selectedConsignee?.gstin || '')}"
                                               class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none uppercase" placeholder="27ABCDE1234F1Z5" maxlength="15">
                                    </div>
                                    <div>
                                        <label class="text-[10px] text-gray-500 font-bold mb-1 block">State *</label>
                                        <input type="text" id="consignee-state" value="${escHtml(state.selectedConsignee?.state || '')}"
                                               class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="Enter state">
                                    </div>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">PIN Code</label>
                                    <input type="text" id="consignee-pin" value="${escHtml(state.selectedConsignee?.pin || '')}"
                                           class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="Enter PIN code" maxlength="6">
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">Contact</label>
                                    <input type="text" id="consignee-contact" value="${escHtml(state.selectedConsignee?.contact || '')}"
                                           class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="Phone/Email">
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">Delivery Instructions</label>
                                    <textarea id="consignee-delivery-instructions" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none h-12 resize-none" placeholder="Special delivery instructions">${escHtml(state.selectedConsignee?.deliveryInstructions || '')}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Meta Fields -->
                    <div class="p-3 space-y-3">
                        <div>
                            <label class="text-[10px] text-gray-500 font-bold">Reference / PO No</label>
                            <input type="text" id="reference-no" value="${escHtml(state.meta.referenceNo)}"
                                   class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="e.g. PO-2025-001">
                        </div>
                        <div>
                            <label class="text-[10px] text-gray-500 font-bold">Vehicle No</label>
                            <input type="text" id="vehicle-no" value="${escHtml(state.meta.vehicleNo)}"
                                   class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="e.g. KA01AB1234">
                        </div>
                        <div>
                            <label class="text-[10px] text-gray-500 font-bold">Narration</label>
                            <textarea id="narration" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none h-20 resize-none" placeholder="Additional notes…">${escHtml(state.meta.narration)}</textarea>
                        </div>
                    </div>
                </div>

                <!-- Items Section -->
                <div class="flex-1 bg-white flex flex-col relative min-w-0">
                    <div class="bg-gray-100 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider flex pr-2 shrink-0">
                        <div class="p-2 w-10 text-center">#</div>
                        <div class="p-2 flex-1">Item Description</div>
                        <div class="p-2 w-20">HSN</div>
                        <div class="p-2 w-16 text-right">Qty</div>
                        <div class="p-2 w-12 text-center">Unit</div>
                        <div class="p-2 w-24 text-right">Rate</div>
                        <div class="p-2 w-16 text-right">Disc %</div>
                        <div class="p-2 w-16 text-right">Tax %</div>
                        <div class="p-2 w-28 text-right">Total</div>
                        <div class="p-2 w-10 text-center"></div>
                    </div>

                    <div class="flex-1 overflow-y-auto custom-scrollbar relative" id="items-container">
                        ${renderItemsList(state)}
                    </div>

                    <div class="p-2 border-t border-dashed border-gray-200 bg-gray-50 shrink-0">
                        <button id="btn-add-item" class="w-full py-2 border border-dashed border-blue-300 text-blue-600 rounded hover:bg-blue-50 text-xs font-bold transition-colors uppercase tracking-wide">
                            + Add Items (F2) &nbsp;|&nbsp; Select Party (F3) &nbsp;|&nbsp; Charges (F4)
                        </button>
                    </div>

                    <div class="bg-slate-50 border-t border-slate-300 p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]" id="totals-section">
                        ${renderTotals(state)}
                    </div>
                </div>
            </div>
        </div>

        <!-- Modals -->
        <div id="modal-backdrop" class="fixed inset-0 bg-black/50 hidden z-40 flex items-center justify-center backdrop-blur-sm transition-opacity">
            <div id="modal-content" class="bg-white rounded shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-down"></div>
        </div>

        <div id="sub-modal-backdrop" class="fixed inset-0 bg-black/60 hidden z-50 flex items-center justify-center backdrop-blur-sm transition-opacity">
            <div id="sub-modal-content" class="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-300 animate-scale-in"></div>
        </div>

        <!-- Save Confirmation Modal -->
        <div id="save-confirmation-modal" class="fixed inset-0 bg-black/50 hidden z-50 flex items-center justify-center backdrop-blur-sm">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                <div class="bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-5 text-white text-center">
                    <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                    </div>
                    <h3 class="text-base font-bold tracking-wide">Purchase Saved!</h3>
                    <p class="text-green-100 text-sm mt-1">Bill No: <span id="modal-bill-no" class="font-bold text-white"></span></p>
                </div>
                <div class="p-5 flex flex-col gap-2">
                    <button id="download-pdf-btn"
                            class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        Download PDF
                    </button>
                    <button id="download-excel-btn"
                            class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        Download Excel
                    </button>
                    <button id="close-modal-btn"
                            class="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
        `;

        // Party display
        const partyContainer = document.getElementById('party-display');
        if (partyContainer) {
            renderPartyCard(state).then(html => {
                partyContainer.innerHTML = html;

                const handlePartySelection = () => {
                    openPartyModal(state, {
                        onSelectParty: async (party) => {
                            state.selectedParty = party;
                            state.historyCache  = {};
                            renderMainLayout(isEditMode);
                        },
                        onCreateParty: () => {
                            openCreatePartyModal(state, async (newParty) => {
                                state.parties.push(newParty);
                                state.selectedParty = newParty;
                                state.historyCache  = {};
                                renderMainLayout(isEditMode);
                            });
                        },
                        onPartyCardUpdate: () => renderPartyCard(state),
                    });
                };

                const selectPartyBtn = document.getElementById('btn-select-party');
                const changePartyBtn = document.getElementById('btn-change-party');
                if (selectPartyBtn) selectPartyBtn.onclick = handlePartySelection;
                if (changePartyBtn) changePartyBtn.onclick = handlePartySelection;
            });
        }

        attachEventListeners(isEditMode, editBillId || null);
    }

    // ── Helper: refresh stocks list ────────────────────────────────────────
    async function refreshStocks() {
        try {
            const response = await fetch('/api/inventory/purchase/stocks', {
                method: 'GET', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success) state.stocks = Array.isArray(data.data) ? data.data : [];
            }
        } catch (err) {
            console.error('Failed to refresh stocks:', err);
        }
    }

    // ── Stock modal callbacks ─────────────────────────────────────────────
    function buildStockModalCallbacks(isEditMode) {
        const callbacks = {
            onSelectStock: async (stock, showBatchModal) => {
                if (showBatchModal) {
                    await showBatchSelectionModal(stock, (stockWithBatch) => {
                        addItemToCart(state, stockWithBatch);
                        renderMainLayout(isEditMode);
                    });
                } else {
                    addItemToCart(state, stock);
                    renderMainLayout(isEditMode);
                }
            },
            onCreateStock: () => {
                openCreateStockModal(state, async () => {
                    await refreshStocks();
                    openStockModal(state, buildStockModalCallbacks(isEditMode));
                });
            },
            onEditStock: (stock) => {
                openEditStockModal(stock, state, async () => {
                    await refreshStocks();
                    renderMainLayout(isEditMode);
                });
            },
            onViewHistory: (stock) => {
                openPartyItemHistoryModal(stock, state);
            },
        };
        return callbacks;
    }

    function attachEventListeners(isEditMode = false, editBillId = null) {

        // Save button spinner helpers
        const showSaveSpinner = () => {
            document.getElementById('btn-save')?.setAttribute('disabled', 'true');
            document.getElementById('save-icon')?.classList.add('hidden');
            document.getElementById('save-text')?.classList.add('hidden');
            document.getElementById('save-spinner')?.classList.remove('hidden');
        };
        const hideSaveSpinner = () => {
            document.getElementById('btn-save')?.removeAttribute('disabled');
            document.getElementById('save-icon')?.classList.remove('hidden');
            document.getElementById('save-text')?.classList.remove('hidden');
            document.getElementById('save-spinner')?.classList.add('hidden');
        };

        // Add item
        const addBtn = document.getElementById('btn-add-item');
        if (addBtn) {
            addBtn.onclick = () => openStockModal(state, buildStockModalCallbacks(isEditMode));
        }

        // Other charges
        const chargesBtn = document.getElementById('btn-other-charges');
        if (chargesBtn) {
            chargesBtn.onclick = () => {
                openOtherChargesModal(state, {
                    onAddCharge:    (charge)      => addOtherCharge(state, charge),
                    onRemoveCharge: (idx)          => removeOtherCharge(state, idx),
                    onUpdateCharge: (idx, charge)  => updateOtherCharge(state, idx, charge),
                    formatCurrency,
                    onSave: () => {
                        const totals = document.getElementById('totals-section');
                        if (totals) totals.innerHTML = renderTotals(state);
                    },
                });
            };
        }

        // Reset
        const resetBtn = document.getElementById('btn-reset');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm('Clear current invoice details?')) {
                    clearCart(state);
                    renderMainLayout(isEditMode);
                }
            };
        }

        // Save
        const saveBtn = document.getElementById('btn-save');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                if (state.cart.length === 0) {
                    showToast('Cannot save an empty invoice. Please add items.', 'error');
                    return;
                }
                if (!state.selectedParty) {
                    showToast('Please select a party before saving.', 'error');
                    return;
                }

                if (isEditMode) {
                    const confirmed = confirm(
                        '⚠️ Edit Bill Confirmation\n\n' +
                        'Editing this bill will:\n' +
                        '• Update stock quantities\n' +
                        '• Recalculate GST and totals\n' +
                        '• Update accounting ledger entries\n\n' +
                        'This action cannot be undone. Continue?'
                    );
                    if (!confirmed) return;
                }

                showSaveSpinner();

                try {
                    const partyId  = getPartyId(state.selectedParty);
                    const billData = {
                        meta:         state.meta,
                        party:        partyId,
                        cart:         state.cart,
                        otherCharges: state.otherCharges,
                        consignee:    state.selectedConsignee,
                    };

                    const method   = isEditMode ? 'PUT' : 'POST';
                    const url      = isEditMode
                        ? `/api/inventory/purchase/bills/${editBillId}`
                        : '/api/inventory/purchase/bills';

                    const response = await fetchWithCSRF(url, {
                        method,
                        body: JSON.stringify(billData),
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        showToast(error.error || `Failed (${response.status})`, 'error');
                        return;
                    }

                    const result = await response.json();
                    if (!result.success) {
                        showToast(result.error || 'Failed to save bill', 'error');
                        return;
                    }

                    const successMsg = isEditMode
                        ? `Purchase bill updated! Bill No: ${result.billNo || state.meta.billNo}`
                        : `Purchase saved! Bill No: ${result.billNo}`;
                    showToast(successMsg, 'success');
                    showSaveConfirmationModal(result.id, result.billNo, isEditMode);

                } catch (err) {
                    console.error('Error saving bill:', err);
                    showToast((isEditMode ? 'Error updating purchase bill: ' : 'Error saving purchase: ') + err.message, 'error');
                } finally {
                    hideSaveSpinner();
                }
            };
        }

        // Table inputs (qty / rate / disc)
        document.querySelectorAll('.tbl-input').forEach(input => {
            input.oninput = (e) => {
                const idx   = parseInt(e.target.dataset.idx);
                const field = e.target.dataset.field;
                updateCartItem(state, idx, field, e.target.value);

                const totalsSection = document.getElementById('totals-section');
                if (totalsSection) totalsSection.innerHTML = renderTotals(state);

                const rowTotalEl = e.target.closest('.flex')?.querySelector('.row-total');
                if (rowTotalEl) {
                    const item     = state.cart[idx];
                    const rowTotal = item.qty * item.rate * (1 - (item.disc || 0) / 100);
                    rowTotalEl.textContent = formatCurrency(rowTotal);
                }
            };
        });

        // Narration inputs (delegated)
        const itemsContainer = document.getElementById('items-container');
        if (itemsContainer) {
            itemsContainer.addEventListener('input', (e) => {
                if (e.target.matches('input[data-field="narration"]')) {
                    updateCartItemNarration(state, parseInt(e.target.dataset.idx), e.target.value);
                }
            });
        }

        // Remove row buttons
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.onclick = (e) => {
                removeItemFromCart(state, parseInt(e.target.dataset.idx));
                renderMainLayout(isEditMode);
            };
        });

        // Bill type
        const billTypeSelector = document.getElementById('billTypeSelector');
        if (billTypeSelector) {
            billTypeSelector.onchange = (e) => {
                state.meta.billType = e.target.value;
                const totals = document.getElementById('totals-section');
                if (totals) totals.innerHTML = renderTotals(state);
            };
        }

        // FIX: Removed stray `state.meta.vehicle_no = ''` that was silently clearing vehicle number on every render

        // Reverse charge
        const rcToggle = document.getElementById('reverse-charge-toggle');
        if (rcToggle) {
            rcToggle.onchange = (e) => {
                state.meta.reverseCharge = e.target.checked;
                const totals = document.getElementById('totals-section');
                if (totals) totals.innerHTML = renderTotals(state);
            };
        }

        // Consignee same-as-bill-to toggle
        const consigneeToggle = document.getElementById('consignee-same-as-bill-to');
        if (consigneeToggle) {
            consigneeToggle.onchange = (e) => {
                state.consigneeSameAsBillTo = e.target.checked;
                if (e.target.checked) populateConsigneeFromBillTo(state);
                renderMainLayout(isEditMode);
            };
        }

        // Scalar inputs
        const bindInput = (id, setter) => {
            const el = document.getElementById(id);
            if (el) el.oninput = (e) => setter(e.target.value);
        };
        bindInput('reference-no',                  v => { state.meta.referenceNo     = v; });
        bindInput('vehicle-no',                    v => { state.meta.vehicleNo        = v; });
        bindInput('narration',                     v => { state.meta.narration        = v; });
        bindInput('dispatch-through',              v => { state.meta.dispatchThrough  = v; });
        bindInput('consignee-name',                v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.name = v; });
        bindInput('consignee-gstin',               v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.gstin = v; });
        bindInput('consignee-state',               v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.state = v; });
        bindInput('consignee-pin',                 v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.pin = v; });
        bindInput('consignee-contact',             v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.contact = v; });
        bindInput('consignee-delivery-instructions', v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.deliveryInstructions = v; });
        bindInput('consignee-address',             v => { if (!state.selectedConsignee) state.selectedConsignee = {}; state.selectedConsignee.address = v; });

        // Bill date
        const billDateInput = document.querySelector('input[type="date"]');
        if (billDateInput) {
            billDateInput.oninput = (e) => { state.meta.billDate = e.target.value; };
        }
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (!container || container.classList.contains('hidden')) return;
        if (e.key === 'F2') { e.preventDefault(); document.getElementById('btn-add-item')?.click(); }
        else if (e.key === 'F3') {
            e.preventDefault();
            (document.getElementById('btn-select-party') || document.getElementById('btn-change-party'))?.click();
        } else if (e.key === 'F4') { e.preventDefault(); document.getElementById('btn-other-charges')?.click(); }
    });

    // ── Save confirmation modal ───────────────────────────────────────────
    function showSaveConfirmationModal(billId, billNo, isEditMode) {
        const modal     = document.getElementById('save-confirmation-modal');
        const billNoEl  = document.getElementById('modal-bill-no');
        if (billNoEl) billNoEl.textContent = billNo;
        modal.classList.remove('hidden');

        const handleAfterModal = () => {
            if (isEditMode) {
                setTimeout(() => router.navigate('/inventory/reports'), 500);
            } else {
                clearCart(state);
                fetchData(state).then(() => renderMainLayout(isEditMode));
            }
        };

        document.getElementById('download-pdf-btn').onclick = () => {
            downloadFile(`/api/inventory/sales/bills/${billId}/pdf`, `Invoice_${billId}.pdf`, 'application/pdf', billId, handleAfterModal);
        };
        document.getElementById('download-excel-btn').onclick = () => {
            downloadFile(`/api/inventory/sales/bills/${billId}/excel`, `Invoice_${billId}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', billId, handleAfterModal);
        };
        document.getElementById('close-modal-btn').onclick = () => {
            closeConfirmModal();
            handleAfterModal();
        };
    }

    function closeConfirmModal() {
        document.getElementById('save-confirmation-modal')?.classList.add('hidden');
    }

    // FIX: Uses credentials:'same-origin' (cookie auth).
    // Original code sent localStorage.getItem('token') in an Authorization header —
    // mixing auth strategies and defeating the HttpOnly cookie security model.
    // FIX: alert() → showToast
    function downloadFile(url, filename, _mimeType, billId, handleAfterModal) {
        fetch(url, { method: 'GET', credentials: 'same-origin' })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.blob();
            })
            .then(blob => {
                const objectUrl = URL.createObjectURL(blob);
                const link      = document.createElement('a');
                link.href       = objectUrl;
                link.download   = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(objectUrl);
                closeConfirmModal();
                handleAfterModal();
            })
            .catch(error => {
                console.error('Download error:', error);
                showToast('Failed to download. Please try again.', 'error');
            });
    }
}