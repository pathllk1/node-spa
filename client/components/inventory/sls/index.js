/**
 * SALES SYSTEM (SLS) - MAIN ORCHESTRATOR
 * Coordinates all components and manages the application lifecycle
 */

import { createInitialState, fetchCurrentUserFirmName, fetchData, loadExistingBillData } from './stateManager.js';
import { formatCurrency, populateConsigneeFromBillTo } from './utils.js';
import { addOtherCharge, removeOtherCharge, updateOtherCharge } from './otherChargesManager.js';
import { addItemToCart, removeItemFromCart, updateCartItem, clearCart } from './cartManager.js';
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

export function initSalesSystem() {
    console.log('SLS: Initializing Professional Sales System...');
    const container = document.getElementById('sales-system');
    if (!container) return;

    // Check for edit mode
    console.log('SLS: Current URL:', window.location.href);
    console.log('SLS: window.location.search:', window.location.search);
    const urlParams = new URLSearchParams(window.location.search);
    const editBillIdParam = urlParams.get('edit');
    console.log('SLS: editBillIdParam from URL:', editBillIdParam);
    
    // Also check sessionStorage as fallback for SPA routing timing issues
    const sessionEditId = sessionStorage.getItem('editBillId');
    console.log('SLS: editBillId from sessionStorage:', sessionEditId);
    
    // Use URL param if available, otherwise sessionStorage
    const finalEditParam = editBillIdParam || sessionEditId;
    console.log('SLS: final edit param:', finalEditParam);
    
    // Validate edit bill ID
    let editBillId = null;
    let isEditMode = false;
    
    if (finalEditParam) {
        const parsedId = parseInt(finalEditParam, 10);
        console.log('SLS: parsedId:', parsedId, 'isNaN:', isNaN(parsedId), 'parsedId > 0:', parsedId > 0);
        if (!isNaN(parsedId) && parsedId > 0) {
            editBillId = parsedId;
            isEditMode = true;
            // Clear sessionStorage after use (moved to after loading)
            // sessionStorage.removeItem('editBillId');
        } else {
            // Invalid bill ID - redirect to create mode
            console.warn('Invalid edit bill ID:', finalEditParam);
            sessionStorage.removeItem('editBillId');
            window.location.href = '/inventory/sls';
            return;
        }
    }

    console.log('SLS: Edit mode detected:', isEditMode, 'Bill ID:', editBillId);

    const state = createInitialState();
    
    // Initialize
    fetchCurrentUserFirmName(state);
    
    // Load data and render
    if (isEditMode) {
        // Edit mode: Load existing bill data
        loadExistingBillData(state, editBillId).then(() => {
            // Clear sessionStorage after successful loading to prevent persistence
            sessionStorage.removeItem('editBillId');
            
            // Load additional data (stocks, parties) for editing
            fetchData(state).then(() => {
                renderMainLayout(isEditMode);
            }).catch(err => {
                console.error("Failed to load data for edit mode:", err);
                showEditError(container, err.message, editBillId);
            });
        }).catch(err => {
            console.error("Failed to load bill data:", err);
            // Clear sessionStorage on error to prevent stale data
            sessionStorage.removeItem('editBillId');
            showEditError(container, err.message, editBillId);
        });
    } else {
        // Create mode: Load fresh data
        fetchData(state).then(() => {
            renderMainLayout(isEditMode);
        }).catch(err => {
            console.error("Failed to load data:", err);
            container.innerHTML = `<div class="p-8 text-center text-red-600 border border-red-200 bg-red-50 rounded">
                <h3 class="font-bold text-lg">System Error</h3>
                <p>${err.message}</p>
                <button class="reload-system-btn mt-4 px-4 py-2 bg-red-600 text-white rounded shadow">Reload System</button>
            </div>`;
            
            const reloadBtn = container.querySelector('.reload-system-btn');
            if (reloadBtn) {
                reloadBtn.addEventListener('click', () => location.reload());
            }
        });
    }

    function showEditError(container, errorMessage, billId) {
        container.innerHTML = `<div class="p-8 text-center text-red-600 border border-red-200 bg-red-50 rounded">
            <h3 class="font-bold text-lg">Edit Bill Error</h3>
            <p class="mb-4">Unable to load bill ${billId} for editing:</p>
            <p class="mb-6 font-mono text-sm">${errorMessage}</p>
            <div class="flex gap-3 justify-center">
                <button onclick="window.location.href='/inventory/sls-rpt'" class="px-4 py-2 bg-gray-600 text-white rounded shadow hover:bg-gray-700 transition">Back to Sales Report</button>
                <button onclick="window.location.href='/inventory/sls'" class="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition">Create New Bill</button>
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
                        <h1 class="text-lg font-bold text-gray-800">Sales Invoice</h1>
                        ${isEditMode ? '<span class="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full border border-orange-200">EDIT MODE</span>' : ''}
                    </div>
                    <div class="flex flex-col">
                        <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Bill No</label>
                        <input type="text" value="${state.meta.billNo}" readonly class="border border-gray-300 rounded px-2 py-1 text-xs font-bold w-32 bg-gray-100 text-slate-500 cursor-not-allowed" title="${isEditMode ? 'Bill number cannot be changed in edit mode' : 'Auto-generated when saved'}">
                    </div>
                    <div class="flex flex-col">
                        <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Date</label>
                        <input type="date" value="${state.meta.billDate}" class="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-slate-700">
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
                    <button id="btn-reset" class="px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50 rounded hover:bg-red-100 transition-colors whitespace-nowrap">Reset</button>
                    <button id="btn-save" class="px-4 py-1.5 bg-slate-800 text-white text-xs rounded hover:bg-slate-900 shadow font-medium flex items-center gap-2 transition-colors whitespace-nowrap">
                        <span>💾</span> ${isEditMode ? 'Update Bill' : 'Save Invoice'}
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
                                <div>
                                    <h3 class="font-bold text-sm text-blue-900 truncate">Loading...</h3>
                                    <p class="text-[11px] text-gray-600 truncate mt-1">Please wait</p>
                                </div>
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
                                    <input type="text" id="consignee-name" value="${state.selectedConsignee?.name || ''}" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="Enter consignee name">
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">Address *</label>
                                    <textarea id="consignee-address" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none h-16 resize-none" placeholder="Enter delivery address">${state.selectedConsignee?.address || ''}</textarea>
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-[10px] text-gray-500 font-bold mb-1 block">GSTIN</label>
                                        <input type="text" id="consignee-gstin" value="${state.selectedConsignee?.gstin || ''}" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none uppercase" placeholder="27ABCDE1234F1Z5" maxlength="15">
                                    </div>
                                    <div>
                                        <label class="text-[10px] text-gray-500 font-bold mb-1 block">State *</label>
                                        <input type="text" id="consignee-state" value="${state.selectedConsignee?.state || ''}" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="Enter state">
                                    </div>
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">PIN Code</label>
                                    <input type="text" id="consignee-pin" value="${state.selectedConsignee?.pin || ''}" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="Enter PIN code" maxlength="6">
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">Contact</label>
                                    <input type="text" id="consignee-contact" value="${state.selectedConsignee?.contact || ''}" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="Phone/Email">
                                </div>
                                <div>
                                    <label class="text-[10px] text-gray-500 font-bold mb-1 block">Delivery Instructions</label>
                                    <textarea id="consignee-delivery-instructions" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none h-12 resize-none" placeholder="Special delivery instructions">${state.selectedConsignee?.deliveryInstructions || ''}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Meta Fields -->
                    <div class="p-3 space-y-3">
                        <div>
                            <label class="text-[10px] text-gray-500 font-bold">Reference / PO No</label>
                            <input type="text" id="reference-no" value="${state.meta.referenceNo}" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="e.g. PO-2025-001">
                        </div>
                        <div>
                            <label class="text-[10px] text-gray-500 font-bold">Vehicle No</label>
                            <input type="text" id="vehicle-no" value="${state.meta.vehicleNo}" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="e.g. KA01AB1234">
                        </div>
                        <div>
                            <label class="text-[10px] text-gray-500 font-bold">Narration</label>
                            <textarea id="narration" class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none h-20 resize-none" placeholder="Additional notes...">${state.meta.narration}</textarea>
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
                            + Add Items (F2) | Select Party (F3) | Charges (F4)
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
            <div id="modal-content" class="bg-white rounded shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-down">
            </div>
        </div>

        <div id="sub-modal-backdrop" class="fixed inset-0 bg-black/60 hidden z-50 flex items-center justify-center backdrop-blur-sm transition-opacity">
            <div id="sub-modal-content" class="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-300 animate-scale-in">
            </div>
        </div>
        `;

        // Update party display
        const partyContainer = document.getElementById('party-display');
        if (partyContainer) {
            renderPartyCard(state).then(html => {
                partyContainer.innerHTML = html;
                
                // Attach party selection/change button handlers
                const selectPartyBtn = document.getElementById('btn-select-party');
                const changePartyBtn = document.getElementById('btn-change-party');
                
                const handlePartySelection = () => {
                    openPartyModal(state, {
                        onSelectParty: async (party) => {
                            state.selectedParty = party;
                            state.historyCache = {};
                            renderMainLayout(isEditMode);
                        },
                        onCreateParty: () => {
                            openCreatePartyModal(state, async (newParty) => {
                                state.parties.push(newParty);
                                state.selectedParty = newParty;
                                state.historyCache = {};
                                renderMainLayout(isEditMode);
                            });
                        }
                    });
                };
                
                if (selectPartyBtn) {
                    selectPartyBtn.onclick = handlePartySelection;
                }
                
                if (changePartyBtn) {
                    changePartyBtn.onclick = handlePartySelection;
                }
            });
        }

        // Attach event listeners
        attachEventListeners(isEditMode, editBillId || null);
    }

    function attachEventListeners(isEditMode = false, editBillId = null) {
        // Add item button - open stock modal
        const addBtn = document.getElementById('btn-add-item');
        if (addBtn) {
            addBtn.onclick = () => {
                openStockModal(state, {
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
                        const handleStockCreated = async (data) => {
                            // Stock was already created via API in stockCrud.js
                            // Refresh the stocks list
                            try {
                                const response = await fetch('/api/inventory/sales/stocks', {
                                    method: 'GET',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' }
                                });
                                if (response.ok) {
                                    state.stocks = await response.json();
                                }
                            } catch (err) {
                                console.error('Failed to refresh stocks:', err);
                            }
                            
                            // Reopen the stock modal so user can select the newly created stock
                            openStockModal(state, {
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
                                    openCreateStockModal(state, handleStockCreated);
                                },
                                onEditStock: (stock) => {
                                    openEditStockModal(stock, state, async (stockId, data) => {
                                        try {
                                            const response = await fetch('/api/inventory/sales/stocks', {
                                                method: 'GET',
                                                credentials: 'include',
                                                headers: { 'Content-Type': 'application/json' }
                                            });
                                            if (response.ok) {
                                                state.stocks = await response.json();
                                            }
                                        } catch (err) {
                                            console.error('Failed to refresh stocks:', err);
                                        }
                                        renderMainLayout(isEditMode);
                                    });
                                },
                                onViewHistory: (stock) => {
                                    openPartyItemHistoryModal(stock, state);
                                }
                            });
                        };
                        
                        openCreateStockModal(state, handleStockCreated);
                    },
                    onEditStock: (stock) => {
                        openEditStockModal(stock, state, async (stockId, data) => {
                            // Stock was already updated via API in stockCrud.js
                            // Refresh the stocks list
                            try {
                                const response = await fetch('/api/inventory/sales/stocks', {
                                    method: 'GET',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' }
                                });
                                if (response.ok) {
                                    state.stocks = await response.json();
                                }
                            } catch (err) {
                                console.error('Failed to refresh stocks:', err);
                            }
                            renderMainLayout();
                        });
                    },
                    onViewHistory: (stock) => {
                        openPartyItemHistoryModal(stock, state);
                    }
                });
            };
        }

        // Other charges button
        const chargesBtn = document.getElementById('btn-other-charges');
        if (chargesBtn) {
            chargesBtn.onclick = () => {
                openOtherChargesModal(state, {
                    onAddCharge: (charge) => addOtherCharge(state, charge),
                    onRemoveCharge: (idx) => removeOtherCharge(state, idx),
                    onUpdateCharge: (idx, charge) => updateOtherCharge(state, idx, charge),
                    formatCurrency,
                    onSave: () => {
                        // Update totals section when charges are saved
                        const totalsSection = document.getElementById('totals-section');
                        if (totalsSection) {
                            totalsSection.innerHTML = renderTotals(state);
                        }
                    }
                });
            };
        }

        // Reset button
        const resetBtn = document.getElementById('btn-reset');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm("Clear current invoice details?")) {
                    clearCart(state);
                    renderMainLayout(isEditMode);
                }
            };
        }

        // Save button
        const saveBtn = document.getElementById('btn-save');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                if (state.cart.length === 0) {
                    showToast('Cannot save an empty invoice. Please add items to the cart.', 'error');
                    return;
                }

                if (!state.selectedParty) {
                    showToast('Please select a party before saving the invoice.', 'error');
                    return;
                }
                
                try {
                    // Show confirmation dialog for edit mode
                    if (isEditMode) {
                        const confirmed = confirm(
                            '⚠️ Edit Bill Confirmation\n\n' +
                            'Editing this bill will:\n' +
                            '• Update stock quantities (return old quantities, deduct new ones)\n' +
                            '• Recalculate GST and totals\n' +
                            '• Update accounting ledger entries\n\n' +
                            'This action cannot be undone. Continue?'
                        );
                        
                        if (!confirmed) {
                            return;
                        }
                    }

                    const billData = {
                        meta: state.meta,
                        party: state.selectedParty,
                        cart: state.cart,
                        otherCharges: state.otherCharges,
                        consignee: state.selectedConsignee
                    };
                    
                    const method = isEditMode ? 'PUT' : 'POST';
                    const url = isEditMode 
                        ? `/api/inventory/sales/bills/${editBillId}`
                        : '/api/inventory/sales/bills';
                    
                    const response = await fetch(url, {
                        method: method,
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(billData)
                    });
                    
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || `HTTP ${response.status}`);
                    }
                    
                    const result = await response.json();
                    console.log('Bill operation response:', result);
                    
                    const successMessage = isEditMode 
                        ? `Bill updated successfully! Bill No: ${result.billNo || state.meta.billNo}`
                        : `Invoice saved successfully! Bill No: ${result.billNo}`;
                    
                    showToast(successMessage, 'success');
                    
                    if (isEditMode) {
                        // For edit mode, redirect back to sales report after short delay
                        setTimeout(() => {
                            window.router.navigate('inventory/sls/rpt');
                        }, 1500);
                    } else {
                        // For create mode, export PDF and reset form
                        console.log('Calling exportInvoiceToPDF with billId:', result.id);
                        exportInvoiceToPDF(state, formatCurrency, result.id);
                        
                        // Reset form
                        clearCart(state);
                        await fetchData(state);
                        renderMainLayout(isEditMode);
                    }
                } catch (err) {
                    console.error('Error saving/updating bill:', err);
                    const errorMessage = isEditMode 
                        ? 'Error updating bill: ' + err.message
                        : 'Error saving invoice: ' + err.message;
                    showToast(errorMessage, 'error');
                }
            };
        }

        // Table inputs
        document.querySelectorAll('.tbl-input').forEach(input => {
            input.oninput = (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const field = e.target.dataset.field;
                updateCartItem(state, idx, field, e.target.value);
                
                // Only update the totals section, not the entire items list
                // This preserves focus and prevents re-rendering of all inputs
                const totalsSection = document.getElementById('totals-section');
                if (totalsSection) {
                    totalsSection.innerHTML = renderTotals(state);
                }
                
                // Update the row total for this specific item
                const rowTotalElement = e.target.closest('.flex').querySelector('.row-total');
                if (rowTotalElement) {
                    const item = state.cart[idx];
                    const rowTotal = item.qty * item.rate * (1 - (item.disc || 0) / 100);
                    rowTotalElement.textContent = formatCurrency(rowTotal);
                }
            };
        });

        // Remove buttons
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.dataset.idx);
                removeItemFromCart(state, idx);
                renderMainLayout(isEditMode);
            };
        });

        // Bill type selector
        const billTypeSelector = document.getElementById('billTypeSelector');
        if (billTypeSelector) {
            billTypeSelector.onchange = (e) => {
                state.meta.billType = e.target.value;
                document.getElementById('totals-section').innerHTML = renderTotals(state);
            };
        }

        state.meta.vehicle_no= '';

        // Reverse charge toggle
        const reverseChargeToggle = document.getElementById('reverse-charge-toggle');
        if (reverseChargeToggle) {
            reverseChargeToggle.onchange = (e) => {
                state.meta.reverseCharge = e.target.checked;
                document.getElementById('totals-section').innerHTML = renderTotals(state);
            };
        }

        // Consignee same as bill to toggle
        const consigneeSameToggle = document.getElementById('consignee-same-as-bill-to');
        if (consigneeSameToggle) {
            consigneeSameToggle.onchange = (e) => {
                state.consigneeSameAsBillTo = e.target.checked;
                if (e.target.checked) {
                    populateConsigneeFromBillTo(state);
                }
                renderMainLayout(isEditMode);
            };
        }

        // Reference number input
        const refNoInput = document.getElementById('reference-no');
        if (refNoInput) {
            refNoInput.oninput = (e) => {
                state.meta.referenceNo = e.target.value;
            };
        }

        // Bill date input
        const billDateInput = document.querySelector('input[type="date"]');
        if (billDateInput) {
            billDateInput.oninput = (e) => {
                state.meta.billDate = e.target.value;
            };
        }

        // Consignee details input listeners
        const consigneeNameInput = document.getElementById('consignee-name');
        if (consigneeNameInput) {
            consigneeNameInput.oninput = (e) => {
                if (!state.selectedConsignee) state.selectedConsignee = {};
                state.selectedConsignee.name = e.target.value;
            };
        }

        const consigneeAddressInput = document.getElementById('consignee-address');
        if (consigneeAddressInput) {
            consigneeAddressInput.oninput = (e) => {
                if (!state.selectedConsignee) state.selectedConsignee = {};
                state.selectedConsignee.address = e.target.value;
            };
        }

        const consigneeGstinInput = document.getElementById('consignee-gstin');
        if (consigneeGstinInput) {
            consigneeGstinInput.oninput = (e) => {
                if (!state.selectedConsignee) state.selectedConsignee = {};
                state.selectedConsignee.gstin = e.target.value;
            };
        }

        const consigneeStateInput = document.getElementById('consignee-state');
        if (consigneeStateInput) {
            consigneeStateInput.oninput = (e) => {
                if (!state.selectedConsignee) state.selectedConsignee = {};
                state.selectedConsignee.state = e.target.value;
            };
        }

        const consigneePinInput = document.getElementById('consignee-pin');
        if (consigneePinInput) {
            consigneePinInput.oninput = (e) => {
                if (!state.selectedConsignee) state.selectedConsignee = {};
                state.selectedConsignee.pin = e.target.value;
            };
        }

        const consigneeContactInput = document.getElementById('consignee-contact');
        if (consigneeContactInput) {
            consigneeContactInput.oninput = (e) => {
                if (!state.selectedConsignee) state.selectedConsignee = {};
                state.selectedConsignee.contact = e.target.value;
            };
        }

        const consigneeInstructionsInput = document.getElementById('consignee-delivery-instructions');
        if (consigneeInstructionsInput) {
            consigneeInstructionsInput.oninput = (e) => {
                if (!state.selectedConsignee) state.selectedConsignee = {};
                state.selectedConsignee.deliveryInstructions = e.target.value;
            };
        }

        // Vehicle number input
        const vehicleNoInput = document.getElementById('vehicle-no');
        if (vehicleNoInput) {
            vehicleNoInput.oninput = (e) => {
                state.meta.vehicleNo = e.target.value;
            };
        }

        // Narration input
        const narrationInput = document.getElementById('narration');
        if (narrationInput) {
            narrationInput.oninput = (e) => {
                state.meta.narration = e.target.value;
            };
        }

        // Dispatch through input
        const dispatchThroughInput = document.getElementById('dispatch-through');
        if (dispatchThroughInput) {
            dispatchThroughInput.oninput = (e) => {
                state.meta.dispatchThrough = e.target.value;
            };
        }
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (!container || container.classList.contains('hidden')) return;
        
        if (e.key === 'F2') {
            e.preventDefault();
            const addBtn = document.getElementById('btn-add-item');
            if (addBtn) addBtn.click();
        } else if (e.key === 'F3') {
            e.preventDefault();
            const selectPartyBtn = document.getElementById('btn-select-party');
            const changePartyBtn = document.getElementById('btn-change-party');
            if (selectPartyBtn) {
                selectPartyBtn.click();
            } else if (changePartyBtn) {
                changePartyBtn.click();
            }
        } else if (e.key === 'F4') {
            e.preventDefault();
            const chargesBtn = document.getElementById('btn-other-charges');
            if (chargesBtn) chargesBtn.click();
        }
    });
}
