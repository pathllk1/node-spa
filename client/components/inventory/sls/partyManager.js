/**
 * PARTY MANAGEMENT MODULE
 * Handles party selection, creation, and GST lookup
 */

export function formatPowerfulGSTINAddress(partyData) {
    if (!partyData || !partyData.place_of_business_principal) return '';

    const addr = partyData.place_of_business_principal.address;
    if (!addr) return '';

    const parts = [];

    if (addr.door_num) parts.push(addr.door_num);
    if (addr.building_name) parts.push(addr.building_name);
    if (addr.floor_num) parts.push(addr.floor_num);
    if (addr.street) parts.push(addr.street);
    if (addr.location) parts.push(addr.location);
    if (addr.city) parts.push(addr.city);
    if (addr.district) parts.push(addr.district);

    return parts.filter(p => p && p.toString().trim()).join(', ');
}

export function extractPowerfulGSTINPinCode(partyData) {
    if (!partyData || !partyData.place_of_business_principal) return '';

    const addr = partyData.place_of_business_principal.address;
    if (!addr || !addr.pin_code) return '';

    const pinStr = addr.pin_code.toString().trim();
    if (/^\d{6}$/.test(pinStr)) {
        return pinStr;
    }

    return '';
}

export function populatePartyFromRapidAPI(partyData, gstin) {
    console.log('Processing GST Data:', partyData);

    const tradeName = partyData.trade_name || '';
    const legalName = partyData.legal_name || '';
    const displayName = tradeName || legalName;

    if (!displayName) {
        alert('No valid company name found in API response.');
        return;
    }

    const address = formatPowerfulGSTINAddress(partyData) || '';
    const pinCode = extractPowerfulGSTINPinCode(partyData) || '';
    
    let stateName = '';
    if (partyData.place_of_business_principal?.address?.state) {
        stateName = partyData.place_of_business_principal.address.state;
    } else {
        stateName = partyData.state_jurisdiction || '';
    }
    stateName = String(stateName || '').trim();
    if (stateName.includes(' - ')) {
        stateName = stateName.split(' - ')[0].trim();
    }

    // Populate UI
    if(document.getElementById('new-party-firm')) 
        document.getElementById('new-party-firm').value = displayName;

    if(document.getElementById('new-party-addr')) 
        document.getElementById('new-party-addr').value = address;

    if(document.getElementById('new-party-state')) 
        document.getElementById('new-party-state').value = stateName;

    if(document.getElementById('new-party-pin')) 
        document.getElementById('new-party-pin').value = pinCode;

    if(gstin && gstin.length >= 2) {
        const scInput = document.getElementById('new-party-state-code');
        if(scInput) scInput.value = gstin.substring(0, 2);
    }

    if(gstin && gstin.length >= 12) {
        const panInput = document.getElementById('new-party-pan');
        if(panInput) panInput.value = gstin.substring(2, 12);
    }
}

export async function fetchPartyByGST(buttonElement) {
    const gstinInput = document.getElementById('new-party-gstin');
    const gstin = gstinInput?.value?.trim();

    if (!gstin || gstin.length !== 15) {
        alert('Please enter a valid 15-character GSTIN');
        return;
    }

    const fetchButton = buttonElement;
    const originalText = fetchButton.innerHTML;
    fetchButton.innerHTML = '⏳';
    fetchButton.disabled = true;

    try {
        const response = await fetch('/api/inventory/sales/gst-lookup', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gstin })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const partyData = data.data || data;
        populatePartyFromRapidAPI(partyData, gstin);

        fetchButton.innerHTML = '✔';
        setTimeout(() => fetchButton.innerHTML = originalText, 1500);

    } catch (error) {
        console.error('GST Lookup Error:', error);
        alert('Failed to fetch details. ' + (error.message || 'Server error'));
        fetchButton.innerHTML = originalText;
    } finally {
        fetchButton.disabled = false;
    }
}
