/**
 * LAYOUT RENDERER MODULE
 * Handles main UI layout rendering and component display
 */

import { formatCurrency } from './utils.js';
import { renderOtherChargesList } from './otherChargesManager.js';

export function renderItemsList(state) {
    if (state.cart.length === 0) {
        return `
        <div class="absolute inset-0 flex flex-col items-center justify-center text-gray-300 select-none pointer-events-none">
            <svg class="w-16 h-16 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            <p class="text-sm font-medium text-gray-400">Your cart is empty</p>
            <p class="text-xs text-gray-400 mt-1">Quick Actions: <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F2</kbd> Add Items | <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F3</kbd> Select Party | <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F4</kbd> Other Charges</p>
        </div>`;
    }

    return state.cart.map((item, index) => {
        const rowTotal = item.qty * item.rate * (1 - (item.disc || 0) / 100);
        return `
        <div class="flex items-center border-b border-gray-100 text-xs text-gray-700 hover:bg-blue-50 transition-colors h-10 group bg-white">
            <div class="p-2 w-10 text-center text-gray-400 font-mono">${index + 1}</div>
            <div class="p-2 flex-1 font-medium truncate flex flex-col justify-center">
                <span class="text-gray-800">${item.item}</span>
                <span class="text-[10px] text-gray-400 font-normal">Batch: ${item.batch || '-'} | OEM: ${item.oem || '-'}</span>
            </div>
            <div class="p-2 w-20 text-gray-500 border-l border-transparent group-hover:border-blue-100">${item.hsn}</div>
            
            <div class="p-1 w-16 border-l border-transparent group-hover:border-blue-100">
                <input type="number" min="0" step="0.01" data-idx="${index}" data-field="qty" value="${item.qty}" class="tbl-input w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 font-semibold text-blue-700">
            </div>
            
            <div class="p-2 w-12 text-center text-gray-500 text-[10px] border-l border-transparent group-hover:border-blue-100">${item.uom}</div>
            
            <div class="p-1 w-24 border-l border-transparent group-hover:border-blue-100">
                <input type="number" min="0" step="0.01" data-idx="${index}" data-field="rate" value="${item.rate}" class="tbl-input w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1">
            </div>
            
            <div class="p-1 w-16 border-l border-transparent group-hover:border-blue-100">
                <input type="number" min="0" max="100" step="0.01" data-idx="${index}" data-field="disc" value="${item.disc}" class="tbl-input w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 placeholder-gray-300" placeholder="0">
            </div>
            
            <div class="p-2 w-16 text-right text-gray-600 border-l border-transparent group-hover:border-blue-100">${item.grate}%</div>
            <div class="p-2 w-28 text-right font-bold text-gray-800 row-total border-l border-transparent group-hover:border-blue-100 bg-gray-50/50 group-hover:bg-transparent">${formatCurrency(rowTotal)}</div>
            
            <div class="p-2 w-10 text-center border-l border-transparent group-hover:border-blue-100">
                <button data-idx="${index}" class="btn-remove text-gray-300 hover:text-red-500 transition-colors font-bold text-lg leading-none">&times;</button>
            </div>
        </div>
        <div class="flex items-center border-b border-gray-100 text-xs text-gray-700 h-8 group bg-white pl-20 pr-2">
            <div class="flex-1 text-[10px] text-gray-500 uppercase tracking-wide">Item Narration</div>
            <div class="flex-1 p-1 border-l border-transparent group-hover:border-blue-100">
                <input type="text" data-idx="${index}" data-field="narration" value="${item.narration || ''}" class="w-full text-xs bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1" placeholder="Add narration for this item">
            </div>
        </div>
        `;
    }).join('');
}

export function renderTotals(state) {
    const gstEnabled = state.gstEnabled !== undefined ? state.gstEnabled : true;
    
    let totalTaxable = 0;
    let totalTaxAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    state.cart.forEach(item => {
        const lineValue = item.qty * item.rate * (1 - (item.disc || 0) / 100);
        if (gstEnabled) {
            const lineTax = lineValue * (item.grate / 100);
            totalTaxAmount += lineTax;
        }
        totalTaxable += lineValue;
    });

    if (gstEnabled && state.meta.billType === 'intra-state') {
        cgstAmount = totalTaxAmount / 2;
        sgstAmount = totalTaxAmount / 2;
    } else if (gstEnabled) {
        igstAmount = totalTaxAmount;
    }
    
    let otherChargesGstTotal = 0;
    let otherChargesSubtotal = 0;
    state.otherCharges.forEach(charge => {
        const chargeAmount = parseFloat(charge.amount) || 0;
        otherChargesSubtotal += chargeAmount;
        
        if (gstEnabled) {
            const chargeGstRate = parseFloat(charge.gstRate) || 0;
            const chargeGstAmount = (chargeAmount * chargeGstRate) / 100;
            otherChargesGstTotal += chargeGstAmount;
        }
    });
    
    let finalCgstAmount = gstEnabled && state.meta.billType === 'intra-state' ? cgstAmount + (otherChargesGstTotal / 2) : 0;
    let finalSgstAmount = gstEnabled && state.meta.billType === 'intra-state' ? sgstAmount + (otherChargesGstTotal / 2) : 0;
    let finalIgstAmount = gstEnabled && state.meta.billType !== 'intra-state' ? igstAmount + otherChargesGstTotal : 0;
    
    if (state.meta.reverseCharge && gstEnabled) {
        finalCgstAmount = 0;
        finalSgstAmount = 0;
        finalIgstAmount = 0;
    }
    
    const grandTotal = totalTaxable + (gstEnabled && state.meta.reverseCharge ? 0 : totalTaxAmount) + otherChargesSubtotal + (gstEnabled && state.meta.reverseCharge ? 0 : otherChargesGstTotal);

    return `
    <div class="flex justify-between items-start">
        <div class="text-[11px] text-gray-400 space-y-1">
            <div class="flex gap-4">
                <span>Total Items: <b class="text-gray-600">${state.cart.length}</b></span>
                <span>Total Quantity: <b class="text-gray-600">${state.cart.reduce((a, b) => a + Number(b.qty), 0).toFixed(2)}</b></span>
            </div>
            ${state.meta.reverseCharge ? '<div class="text-red-600 font-bold mt-1">REVERSE CHARGE APPLIES</div>' : ''}
            <div class="text-gray-400 italic mt-2">* Rates are inclusive of discounts before tax</div>
        </div>

        <div class="flex gap-10 text-xs">
            <div class="text-right space-y-1.5 text-gray-500 font-medium">
                <div>Taxable Value</div>
                ${state.meta.billType === 'intra-state'
                ? `<div>CGST Output</div><div>SGST Output</div>`
                : `<div>IGST Output</div>`
            }
                ${state.otherCharges.length > 0 ? `<div>Other Charges</div>` : ''}
                <div class="pt-2 mt-2 border-t border-gray-200 font-bold text-gray-700">Grand Total</div>
            </div>

            <div class="text-right space-y-1.5 font-mono font-bold text-gray-800">
                <div>${formatCurrency(totalTaxable)}</div>
                ${state.meta.billType === 'intra-state'
                ? `<div class="text-gray-600">${formatCurrency(finalCgstAmount)}</div><div class="text-gray-600">${formatCurrency(finalSgstAmount)}</div>`
                : `<div class="text-gray-600">${formatCurrency(finalIgstAmount)}</div>`
            }
                ${state.otherCharges.length > 0 ? `<div class="text-gray-600">${formatCurrency(otherChargesSubtotal)}</div>` : ''}
                <div class="pt-2 mt-2 border-t border-gray-200 font-bold text-lg text-blue-700 leading-none">
                    ${formatCurrency(grandTotal)}
                </div>
            </div>
        </div>
    </div>
    `;
}

export async function renderPartyCard(state) {
    if (state.selectedParty) {
        let balanceInfo = null;
        try {
            const response = await fetch(`/api/inventory/sales/party-balance/${state.selectedParty.id}`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                balanceInfo = {
                    balance: data.balance || 0,
                    balanceType: data.balance >= 0 ? 'Credit' : 'Debit',
                    balanceFormatted: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Math.abs(data.balance || 0))
                };
            } else {
                balanceInfo = { balance: 0, balanceType: 'Credit', balanceFormatted: '₹0.00' };
            }
        } catch (error) {
            console.error('Error fetching party balance:', error);
            balanceInfo = { balance: 0, balanceType: 'Credit', balanceFormatted: '₹0.00' };
        }
        
        if (state.consigneeSameAsBillTo) {
            const { populateConsigneeFromBillTo } = await import('./utils.js');
            populateConsigneeFromBillTo(state);
        }
        
        return `
            <div class="group bg-blue-50 p-3 rounded border border-blue-200 shadow-sm">
                <div>
                    <div class="flex justify-between items-start">
                        <h3 class="font-bold text-sm text-blue-900 truncate flex-1" title="${state.selectedParty.firm}">${state.selectedParty.firm}</h3>
                        <button id="btn-change-party" class="text-[10px] text-blue-600 hover:text-blue-800 font-bold bg-white p-1.5 rounded shadow-sm border border-gray-200 hover:border-blue-300 whitespace-nowrap ml-2" title="Change Party">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                    </div>
                    <p class="text-[11px] text-gray-600 truncate mt-1">${state.selectedParty.addr}</p>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="bg-blue-100 text-blue-800 text-[10px] font-mono px-2 py-0.5 rounded border border-blue-200">GST: ${state.selectedParty.gstin}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="${balanceInfo.balance >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-[10px] font-mono px-2 py-0.5 rounded border ${balanceInfo.balance >= 0 ? 'border-green-200' : 'border-red-200'}">
                            BAL: ${balanceInfo.balanceType} ${balanceInfo.balanceFormatted}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }
    return `
        <button id="btn-select-party" class="w-full py-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 group">
            <span class="text-2xl group-hover:scale-110 transition-transform font-light">+</span>
            <span class="text-xs font-semibold uppercase tracking-wide">Select Party</span>
        </button>
    `;
}
