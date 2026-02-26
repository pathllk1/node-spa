/**
 * CART MANAGEMENT MODULE
 * Handles cart operations: add items, remove items, update quantities
 */

export function addItemToCart(state, stockItem) {
    const existing = state.cart.find(i => i.stockId === stockItem.id && i.batch === stockItem.batch);

    if (existing) {
        existing.qty += 1;
    } else {
        state.cart.push({
            stockId: stockItem.id,
            item: stockItem.item,
            narration: '',
            batch: stockItem.batch,
            oem: stockItem.oem,
            hsn: stockItem.hsn,
            qty: 1,
            uom: stockItem.uom,
            rate: parseFloat(stockItem.rate),
            grate: parseFloat(stockItem.grate),
            disc: 0
        });
    }
}

export function addItemToCartWithOverrides(state, stockItem, overrides = {}) {
    const existing = state.cart.find(i => i.stockId === stockItem.id && i.batch === stockItem.batch);
    const resolvedRate = overrides.rate !== undefined ? parseFloat(overrides.rate) : parseFloat(stockItem.rate);
    const resolvedDisc = overrides.disc !== undefined ? parseFloat(overrides.disc) : 0;

    if (existing) {
        existing.qty += 1;
        if (!isNaN(resolvedRate)) existing.rate = resolvedRate;
        if (!isNaN(resolvedDisc)) existing.disc = resolvedDisc;
    } else {
        state.cart.push({
            stockId: stockItem.id,
            item: stockItem.item,
            narration: '',
            batch: stockItem.batch,
            oem: stockItem.oem,
            hsn: stockItem.hsn,
            qty: 1,
            uom: stockItem.uom,
            rate: isNaN(resolvedRate) ? parseFloat(stockItem.rate) : resolvedRate,
            grate: parseFloat(stockItem.grate),
            disc: isNaN(resolvedDisc) ? 0 : resolvedDisc
        });
    }
}

export function removeItemFromCart(state, index) {
    state.cart.splice(index, 1);
}

export function updateCartItem(state, index, field, value) {
    if (state.cart[index]) {
        let val = parseFloat(value);
        if (isNaN(val) || val < 0) val = 0;
        state.cart[index][field] = val;
    }
}

export function updateCartItemNarration(state, index, narration) {
    if (state.cart[index]) {
        state.cart[index].narration = narration;
    }
}

export function clearCart(state) {
    state.cart = [];
    state.selectedParty = null;
    state.historyCache = {};
    state.otherCharges = [];
    state.selectedConsignee = null;  // FIX: Clear consignee data as well
    state.consigneeSameAsBillTo = true;  // FIX: Reset the toggle to default state
}
