/**
 * STATE MANAGEMENT MODULE
 * Handles global state initialization, data fetching, and state updates
 */

export function createInitialState() {
    return {
        stocks: [],
        parties: [],
        cart: [],
        selectedParty: null,
        selectedConsignee: null,
        consigneeSameAsBillTo: true,
        historyCache: {},
        meta: {
            billNo: '',
            billDate: new Date().toISOString().split('T')[0],
            billType: 'intra-state',
            reverseCharge: false,
            referenceNo: '',
            vehicleNo: '',
            dispatchThrough: '',
            narration: ''
        },
        otherCharges: [],
        currentFirmName: 'Your Company Name',
        gstEnabled: true
    };
}

export async function fetchCurrentUserFirmName(state) {
    try {
        const response = await fetch('/api/inventory/sales/current-firm', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.name) {
            state.currentFirmName = data.name;
            if (window.currentUserFirmName !== data.name) {
                window.currentUserFirmName = data.name;
            }
        }
    } catch (error) {
        console.warn('Could not fetch current user firm name:', error.message);
        state.currentFirmName = 'Your Company Name';
    }
}

export async function fetchNextBillNumber(state) {
    try {
        const response = await fetch('/api/inventory/sales/next-bill-number', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.nextBillNumber) {
            state.meta.billNo = data.nextBillNumber;
        } else {
            state.meta.billNo = 'Will be generated on save';
        }
    } catch (error) {
        console.warn("Could not fetch next bill number:", error.message);
        state.meta.billNo = 'Will be generated on save';
    }
}

export async function loadExistingBillData(state, billId) {
    try {
        console.log('[LOAD_BILL_DATA] Loading bill data for ID:', billId);
        
        const response = await fetch(`/api/inventory/sales/bills/${billId}`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('[LOAD_BILL_DATA] API response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[LOAD_BILL_DATA] API error:', errorData);
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const billData = await response.json();
        console.log('[LOAD_BILL_DATA] Received bill data:', billData);
        console.log('[LOAD_BILL_DATA] Items count:', billData.items?.length || 0);
        console.log('[LOAD_BILL_DATA] Party ID:', billData.party_id);
        
        // Populate state with existing bill data
        state.meta = {
            billNo: billData.bno,
            billDate: billData.bdate,
            billType: billData.btype ? billData.btype.toLowerCase() : 'intra-state',
            reverseCharge: Boolean(billData.reverse_charge),
            referenceNo: billData.order_no || '',
            vehicleNo: billData.vehicle_no || '',
            dispatchThrough: billData.dispatch_through || '',
            narration: billData.narration || ''
        };
        
        console.log('[LOAD_BILL_DATA] Populated meta:', state.meta);
        
        // Set party information
        if (billData.party_id) {
            state.selectedParty = {
                id: billData.party_id,
                firm: billData.supply || '',
                gstin: billData.gstin || '',
                state: billData.state || '',
                addr: billData.addr || '',
                pin: billData.pin || null,
                state_code: billData.state_code || null
            };
            console.log('[LOAD_BILL_DATA] Populated party:', state.selectedParty);
        } else {
            console.warn('[LOAD_BILL_DATA] No party information found');
        }
        
        // Set consignee information
        if (billData.consignee_name || billData.consignee_address) {
            state.selectedConsignee = {
                name: billData.consignee_name || '',
                address: billData.consignee_address || '',
                gstin: billData.consignee_gstin || '',
                state: billData.consignee_state || '',
                pin: billData.consignee_pin || '',
                contact: '',
                deliveryInstructions: ''
            };
            state.consigneeSameAsBillTo = false;
            console.log('[LOAD_BILL_DATA] Populated consignee:', state.selectedConsignee);
        } else {
            state.consigneeSameAsBillTo = true;
            console.log('[LOAD_BILL_DATA] Consignee same as bill to');
        }
        
        // Populate cart with existing items
        state.cart = (billData.items || []).map(item => ({
            stockId: item.stock_id,
            item: item.item,
            narration: item.narration || '',
            batch: item.batch || null,
            oem: item.oem || '',
            hsn: item.hsn,
            qty: parseFloat(item.qty) || 0,
            uom: item.uom || 'PCS',
            rate: parseFloat(item.rate) || 0,
            grate: parseFloat(item.grate) || 0,
            disc: parseFloat(item.disc) || 0
        }));
        
        console.log('[LOAD_BILL_DATA] Populated cart with', state.cart.length, 'items');
        
        // Populate other charges
        state.otherCharges = (billData.otherCharges || []).map(charge => ({
            name: charge.name || charge.type || 'Other Charge',
            type: charge.type || 'other',
            hsnSac: charge.hsnSac || '',
            amount: parseFloat(charge.amount) || 0,
            gstRate: parseFloat(charge.gstRate) || 0
        }));
        
        console.log('[LOAD_BILL_DATA] Populated other charges:', state.otherCharges.length);
        
        // Set history cache to empty for edit mode
        state.historyCache = {};
        
        console.log('[LOAD_BILL_DATA] State populated successfully');
        return true;
        
    } catch (error) {
        console.error('[LOAD_BILL_DATA] Error loading bill data:', error);
        throw error;
    }
}

export async function fetchData(state) {
    try {
        // Fetch Stocks
        const stockResponse = await fetch('/api/inventory/sales/stocks', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (stockResponse.ok) {
            const stockData = await stockResponse.json();
            state.stocks = Array.isArray(stockData) ? stockData : [];
        } else {
            console.warn('Failed to fetch stocks:', stockResponse.status);
            state.stocks = [];
        }

        // Fetch Parties
        try {
            const partyResponse = await fetch('/api/inventory/sales/parties', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (partyResponse.ok) {
                const partyData = await partyResponse.json();
                state.parties = Array.isArray(partyData) ? partyData : [];
            } else {
                console.warn('Failed to fetch parties:', partyResponse.status);
                state.parties = [];
            }
        } catch (e) {
            console.warn("Could not fetch parties:", e.message);
            state.parties = [];
        }

        // Don't fetch bill number on page load - it will be generated when bill is saved
        // This prevents incrementing the sequence every time the page is visited
        // But don't overwrite if already set (e.g., from edit mode)
        if (!state.meta.billNo || state.meta.billNo === 'Will be generated on save') {
            state.meta.billNo = 'Will be generated on save';
            
            // Fetch preview of next bill number (without incrementing sequence)
            try {
                const previewResponse = await fetch('/api/inventory/sales/next-bill-number', {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (previewResponse.ok) {
                    const data = await previewResponse.json();
                    if (data.nextBillNumber) {
                        state.meta.billNo = data.nextBillNumber;
                    }
                }
            } catch (error) {
                console.warn("Could not fetch bill number preview:", error.message);
            }
        }
        
        // Fetch GST status
        try {
            const gstResponse = await fetch('/api/settings/system-config/gst-status', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (gstResponse.ok) {
                const gstData = await gstResponse.json();
                state.gstEnabled = gstData.gst_enabled !== false;
            } else {
                console.warn('Failed to fetch GST status:', gstResponse.status);
                state.gstEnabled = true;
            }
        } catch (e) {
            console.warn("Could not fetch GST status:", e.message);
            state.gstEnabled = true;
        }

        return true;
    } catch (err) {
        console.error("Failed to load data:", err);
        throw err;
    }
}
