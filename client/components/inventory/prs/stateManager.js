/**
 * STATE MANAGEMENT MODULE
 * Handles global state initialization, data fetching, and state updates
 */

export function createInitialState() {
    return {
        stocks:                [],
        parties:               [],
        cart:                  [],
        selectedParty:         null,
        selectedConsignee:     null,
        consigneeSameAsBillTo: true,
        historyCache:          {},
        meta: {
            billNo:          '',
            billDate:        new Date().toISOString().split('T')[0],
            billType:        'intra-state',
            reverseCharge:   false,
            referenceNo:     '',
            vehicleNo:       '',
            dispatchThrough: '',
            narration:       '',
        },
        otherCharges:    [],
        currentFirmName: 'Your Company Name',
        gstEnabled:      true,
    };
}

export async function fetchCurrentUserFirmName(state) {
    try {
        const response = await fetch('/api/inventory/purchase/current-firm', {
            method:      'GET',
            credentials: 'same-origin',
            headers:     { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success && data.data?.name) {
            state.currentFirmName      = data.data.name;
            window.currentUserFirmName = data.data.name;
        } else if (!data.success) {
            throw new Error(data.error || 'Failed to fetch firm name');
        }
    } catch (error) {
        console.warn('Could not fetch firm name:', error.message);
        state.currentFirmName = 'Your Company Name';
    }
}

export async function fetchNextBillNumber(state) {
    try {
        const response = await fetch('/api/inventory/purchase/next-bill-number', {
            method:      'GET',
            credentials: 'same-origin',
            headers:     { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success && data.nextBillNumber) {
            state.meta.billNo = data.nextBillNumber;
        } else if (!data.success) {
            throw new Error(data.error || 'Failed to fetch bill number');
        } else {
            state.meta.billNo = 'Will be generated on save';
        }
    } catch (error) {
        console.warn('Could not fetch bill number:', error.message);
        state.meta.billNo = 'Will be generated on save';
    }
}

export async function loadExistingBillData(state, billId) {
    // FIX: Removed all [LOAD_BILL_DATA] console.logs — 15+ debug statements
    // cluttered production logs with internal data structures.
    try {
        const response = await fetch(`/api/inventory/purchase/bills/${billId}`, {
            method:      'GET',
            credentials: 'same-origin',
            headers:     { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const billData = await response.json();
        if (!billData.success) throw new Error(billData.error || 'Failed to load bill data');

        const bill = billData.data;

        state.meta = {
            billNo:          bill.bno,
            billDate:        bill.bdate,
            billType:        bill.btype ? bill.btype.toLowerCase() : 'intra-state',
            reverseCharge:   Boolean(bill.reverse_charge),
            referenceNo:     bill.order_no         || '',
            vehicleNo:       bill.vehicle_no       || '',
            dispatchThrough: bill.dispatch_through || '',
            narration:       bill.narration        || '',
        };

        if (bill.party_id) {
            state.selectedParty = {
                id:         bill.party_id,
                firm:       bill.supply     || '',
                gstin:      bill.gstin      || '',
                state:      bill.state      || '',
                addr:       bill.addr       || '',
                pin:        bill.pin        || null,
                state_code: bill.state_code || null,
            };
        }

        if (bill.consignee_name || bill.consignee_address) {
            state.selectedConsignee = {
                name:                 bill.consignee_name    || '',
                address:              bill.consignee_address || '',
                gstin:                bill.consignee_gstin   || '',
                state:                bill.consignee_state   || '',
                pin:                  bill.consignee_pin     || '',
                contact:              '',
                deliveryInstructions: '',
            };
            state.consigneeSameAsBillTo = false;
        } else {
            state.consigneeSameAsBillTo = true;
        }

        state.cart = (bill.items || []).map(item => ({
            stockId:   item.stock_id,
            item:      item.item,
            narration: item.item_narration || '',
            batch:     item.batch          || null,
            oem:       item.oem            || '',
            hsn:       item.hsn,
            qty:       parseFloat(item.qty)   || 0,
            uom:       item.uom               || 'PCS',
            rate:      parseFloat(item.rate)  || 0,
            grate:     parseFloat(item.grate) || 0,
            disc:      parseFloat(item.disc)  || 0,
        }));

        state.otherCharges = (bill.otherCharges || []).map(charge => ({
            name:    charge.name   || charge.type || 'Other Charge',
            type:    charge.type   || 'other',
            hsnSac:  charge.hsnSac || '',
            amount:  parseFloat(charge.amount)  || 0,
            gstRate: parseFloat(charge.gstRate) || 0,
        }));

        state.historyCache = {};
        return true;

    } catch (error) {
        console.error('Error loading bill data:', error);
        throw error;
    }
}

export async function fetchData(state) {
    try {
        // Stocks
        const stockResponse = await fetch('/api/inventory/purchase/stocks', {
            method: 'GET', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!stockResponse.ok) {
            console.warn('Failed to fetch stocks:', stockResponse.status);
            state.stocks = [];
        } else {
            const stockData = await stockResponse.json();
            state.stocks = stockData.success && Array.isArray(stockData.data) ? stockData.data : [];
        }

        // Parties
        try {
            const partyResponse = await fetch('/api/inventory/purchase/parties', {
                method: 'GET', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!partyResponse.ok) {
                console.warn('Failed to fetch parties:', partyResponse.status);
                state.parties = [];
            } else {
                const partyData = await partyResponse.json();
                state.parties = partyData.success && Array.isArray(partyData.data) ? partyData.data : [];
            }
        } catch (e) {
            console.warn('Could not fetch parties:', e.message);
            state.parties = [];
        }

        // Bill number preview (non-incrementing)
        if (!state.meta.billNo || state.meta.billNo === 'Will be generated on save') {
            state.meta.billNo = 'Will be generated on save';
            try {
                const previewResponse = await fetch('/api/inventory/purchase/next-bill-number', {
                    method: 'GET', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (previewResponse.ok) {
                    const data = await previewResponse.json();
                    if (data.success && data.nextBillNumber) state.meta.billNo = data.nextBillNumber;
                }
            } catch (e) {
                console.warn('Could not fetch bill number preview:', e.message);
            }
        }

        // GST status
        try {
            const gstResponse = await fetch('/api/settings/system-config/gst-status', {
                method: 'GET', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!gstResponse.ok) {
                console.warn('Failed to fetch GST status:', gstResponse.status);
                state.gstEnabled = true;
            } else {
                const gstData = await gstResponse.json();
                state.gstEnabled = gstData.success ? (gstData.data?.gst_enabled !== false) : true;
            }
        } catch (e) {
            console.warn('Could not fetch GST status:', e.message);
            state.gstEnabled = true;
        }

        return true;
    } catch (err) {
        console.error('Failed to load data:', err);
        throw err;
    }
}