/**
 * OTHER CHARGES MANAGEMENT MODULE
 * Handles adding, removing, updating, and rendering other charges
 */

import { formatCurrency } from './utils.js';

export function addOtherCharge(state, charge) {
    if (charge.gstRate === undefined) {
        charge.gstRate = 0;
    }
    
    if (state.gstEnabled !== false) {
        charge.gstAmount = (charge.amount * charge.gstRate) / 100;
    } else {
        charge.gstAmount = 0;
    }
    
    state.otherCharges.push(charge);
}

export function removeOtherCharge(state, index) {
    state.otherCharges.splice(index, 1);
}

export function updateOtherCharge(state, index, charge) {
    if (state.gstEnabled !== false) {
        charge.gstAmount = (charge.amount * (charge.gstRate || 0)) / 100;
    } else {
        charge.gstAmount = 0;
    }
    
    state.otherCharges[index] = charge;
}

export function getTotalOtherCharges(state) {
    return state.otherCharges.reduce((sum, charge) => {
        return sum + (parseFloat(charge.amount) || 0);
    }, 0);
}

export function renderOtherChargesList(state) {
    if (state.otherCharges.length === 0) {
        return `<tr><td colspan="6" class="p-3 text-center text-gray-400 italic">No other charges added</td></tr>`;
    }
    
    return state.otherCharges.map((charge, index) => {
        const gstEnabled = state.gstEnabled !== undefined ? state.gstEnabled : true;
        const gstAmount = gstEnabled ? (charge.amount * (charge.gstRate || 0)) / 100 : 0;
        const totalAmount = charge.amount + gstAmount;
        return `
            <tr class="hover:bg-blue-50 transition-colors">
                <td class="p-3 font-medium">${charge.name}</td>
                <td class="p-3 text-gray-500">${charge.hsnSac || ''}</td>
                <td class="p-3 text-gray-500">${charge.type}</td>
                <td class="p-3 text-right font-bold text-gray-800">${formatCurrency(charge.amount)}</td>
                <td class="p-3 text-right font-bold text-gray-800">${(charge.gstRate || 0)}%</td>
                <td class="p-3 text-center">
                    <button class="btn-remove-charge text-red-600 hover:text-red-800 transition-colors font-bold text-lg leading-none" data-index="${index}">&times;</button>
                </td>
            </tr>
            <tr class="hover:bg-blue-50 transition-colors bg-gray-50">
                <td class="p-1 text-right text-gray-500 text-xs" colspan="3">GST (${(charge.gstRate || 0)}%):</td>
                <td class="p-1 text-right text-gray-500 text-xs">${formatCurrency(gstAmount)}</td>
                <td class="p-1 text-right text-gray-500 text-xs font-bold">Total:</td>
                <td class="p-1 text-right text-gray-800 text-xs font-bold">${formatCurrency(totalAmount)}</td>
            </tr>`;
    }).join('');
}
