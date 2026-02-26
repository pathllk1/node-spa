/**
 * UTILITY FUNCTIONS MODULE
 * Common helper functions used across the SLS system
 */

export const formatCurrency = (num) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num || 0);

export const getHistoryCacheKey = (partyId, stockId) => `${partyId}:${stockId}`;

export function populateConsigneeFromBillTo(state) {
    if (state.selectedParty) {
        state.selectedConsignee = {
            name: state.selectedParty.firm,
            address: state.selectedParty.addr,
            gstin: state.selectedParty.gstin,
            state: state.selectedParty.state,
            pin: state.selectedParty.pin || '',
            contact: state.selectedParty.contact || '',
            deliveryInstructions: ''
        };
        updateConsigneeDisplay(state);
    }
}

export function updateConsigneeDisplay(state) {
    const nameEl = document.getElementById('consignee-name');
    const addressEl = document.getElementById('consignee-address');
    const gstinEl = document.getElementById('consignee-gstin');
    const stateEl = document.getElementById('consignee-state');
    const pinEl = document.getElementById('consignee-pin');
    const contactEl = document.getElementById('consignee-contact');
    const instructionsEl = document.getElementById('consignee-delivery-instructions');
    
    if (state.selectedConsignee) {
        if (nameEl) nameEl.value = state.selectedConsignee.name || '';
        if (addressEl) addressEl.value = state.selectedConsignee.address || '';
        if (gstinEl) gstinEl.value = state.selectedConsignee.gstin || '';
        if (stateEl) stateEl.value = state.selectedConsignee.state || '';
        if (pinEl) pinEl.value = state.selectedConsignee.pin || '';
        if (contactEl) contactEl.value = state.selectedConsignee.contact || '';
        if (instructionsEl) instructionsEl.value = state.selectedConsignee.deliveryInstructions || '';
    } else {
        if (nameEl) nameEl.value = '';
        if (addressEl) addressEl.value = '';
        if (gstinEl) gstinEl.value = '';
        if (stateEl) stateEl.value = '';
        if (pinEl) pinEl.value = '';
        if (contactEl) contactEl.value = '';
        if (instructionsEl) instructionsEl.value = '';
    }
}

export function numToIndianRupees(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scales = ['', 'Thousand', 'Lakh', 'Crore'];

    function convertGroup(num) {
        if (num === 0) return '';
        if (num < 10) return ones[num];
        if (num < 20) return teens[num - 10];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
        return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convertGroup(num % 100) : '');
    }

    if (num === 0) return 'Zero';
    
    let result = '';
    let scaleIndex = 0;
    
    while (num > 0) {
        const group = num % (scaleIndex === 1 ? 100 : 1000);
        if (group !== 0) {
            result = convertGroup(group) + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : '') + (result ? ' ' + result : '');
        }
        num = Math.floor(num / (scaleIndex === 1 ? 100 : 1000));
        scaleIndex++;
    }
    
    return result + ' Rupees Only';
}
