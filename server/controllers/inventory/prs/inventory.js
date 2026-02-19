const turso = require('../../../../config/turso');
const { verifyFirmAccess, verifyFirmOwnership, addFirmId } = require('../../../../middleware/firmMiddleware');
const { getNextBillNumber, getCurrentFinancialYear, getNextBillNumberPreview, getCurrentSequence } = require('../../../../utils/billNumberGenerator');

// Helper to get current ISO time
const now = () => new Date().toISOString();

const getActorUsername = (req) => (req && req.user && req.user.username ? req.user.username : null);

const normalizeValue = (value) => {
    if (typeof value === 'bigint') return Number(value);
    if (Array.isArray(value)) return value.map(normalizeValue);
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = normalizeValue(v);
        return out;
    }
    return value;
};

const normalizeRow = (row) => normalizeValue(row);
const normalizeRows = (rows) => (Array.isArray(rows) ? rows.map(normalizeRow) : []);

exports.renderStocksPage = async (req, res) => {
    try {
        let firmName = '';
        if (req.user && req.user.firm_id) {
            const firmQuery = await turso.execute({
                sql: 'SELECT name FROM firms WHERE id = ?',
                args: [req.user.firm_id]
            });
            const firm = firmQuery.rows[0];
            firmName = firm ? firm.name : '';
        }
        
        res.render('inventory/stocks', { 
            title: 'Stock Management', 
            user: { 
                ...req.user, 
                firm_name: firmName 
            } || { username: 'Guest', firm_name: '' } 
        });
    } catch (error) {
        console.error('Error rendering stocks page:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
};

exports.renderPurchasePage = async (req, res) => {
    try {
        let firmName = '';
        if (req.user && req.user.firm_id) {
            const firmQuery = await turso.execute({
                sql: 'SELECT name FROM firms WHERE id = ?',
                args: [req.user.firm_id]
            });
            const firm = firmQuery.rows[0];
            firmName = firm ? firm.name : '';
        }

        res.render('inventory/purchase', { 
            title: 'Purchase', 
            user: { 
                ...req.user, 
                firm_name: firmName 
            } || { username: 'Guest', firm_name: '' } 
        });
    } catch (error) {
        console.error('Error rendering purchase page:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
};

exports.renderBillsPage = async (req, res) => {
    try {
        let firmName = '';
        if (req.user && req.user.firm_id) {
            const firmQuery = await turso.execute({
                sql: 'SELECT name FROM firms WHERE id = ?',
                args: [req.user.firm_id]
            });
            const firm = firmQuery.rows[0];
            firmName = firm ? firm.name : '';
        }
        
        res.render('inventory/bills', { 
            title: 'Inventory Bills', 
            user: { 
                ...req.user, 
                firm_name: firmName 
            } || { username: 'Guest', firm_name: '' } 
        });
    } catch (error) {
        console.error('Error rendering bills page:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
};

exports.renderSalesReportPage = async (req, res) => {
    try {
        let firmName = '';
        if (req.user && req.user.firm_id) {
            const firmQuery = await turso.execute({
                sql: 'SELECT name FROM firms WHERE id = ?',
                args: [req.user.firm_id]
            });
            const firm = firmQuery.rows[0];
            firmName = firm ? firm.name : '';
        }
        
        res.render('inventory/sales-report', { 
            title: 'Sales Report', 
            user: { 
                ...req.user, 
                firm_name: firmName 
            } || { username: 'Guest', firm_name: '' } 
        });
    } catch (error) {
        console.error('Error rendering sales report page:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
};

exports.getAllStocks = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const stocksQuery = await turso.execute({
            sql: 'SELECT * FROM stocks WHERE firm_id = ? ORDER BY created_at DESC',
            args: [req.user.firm_id]
        });
        const stocks = normalizeRows(stocksQuery.rows);
        
        const stocksWithBatches = stocks.map(stock => {
            return {
                ...stock,
                batches: stock.batches ? JSON.parse(stock.batches) : []
            };
        });
        
        res.json(stocksWithBatches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getPartyItemHistory = async (req, res) => {
    try {
        const partyId = parseInt(req.query.partyId);
        const stockId = parseInt(req.query.stockId);
        const limit = req.query.limit === 'all' ? null : Math.min(parseInt(req.query.limit) || 10, 500);

        if (!partyId || !stockId) {
            return res.status(400).json({ error: 'partyId and stockId are required' });
        }

        let query = `
            SELECT 
                sr.id as reg_id,
                sr.stock_id,
                sr.item,
                sr.batch,
                sr.hsn,
                sr.qty,
                sr.uom,
                sr.rate,
                sr.grate,
                sr.disc,
                sr.total,
                sr.bno,
                sr.bdate,
                sr.created_at,
                b.id as bill_id,
                b.party_id,
                b.firm,
                b.usern
            FROM stock_reg sr
            JOIN bills b ON b.id = sr.bill_id
            WHERE b.party_id = ?
              AND sr.stock_id = ?
              AND sr.type = 'PURCHASE'
            ORDER BY COALESCE(sr.bdate, b.bdate, sr.created_at) DESC
        `;
        
        const params = [partyId, stockId];
        
        if (limit !== null) {
            query += ' LIMIT ?';
            params.push(limit);
        }

        const result = await turso.execute({
            sql: query,
            args: params
        });
        const rows = normalizeRows(result.rows);
        res.json({ partyId, stockId, rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createStock = async (req, res) => {
    try {
        let { item, pno, batch, oem, hsn, qty, uom, rate, grate, mrp, expiryDate, batches } = req.body;

        if ((!batch && !qty && !rate && !mrp && !expiryDate) && batches) {
            try {
                const parsed = Array.isArray(batches) ? batches : JSON.parse(batches);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const b0 = parsed[0] || {};
                    batch = b0.batch ?? batch;
                    qty = b0.qty ?? qty;
                    rate = b0.rate ?? rate;
                    mrp = b0.mrp ?? mrp;
                    expiryDate = b0.expiry ?? expiryDate;
                    batches = parsed;
                }
            } catch (e) {
            }
        }

        const normalizedBatches = (() => {
            if (!batches) return null;
            try {
                const parsed = Array.isArray(batches) ? batches : JSON.parse(batches);
                return Array.isArray(parsed) ? parsed : null;
            } catch (e) {
                return null;
            }
        })();

        const actorUsername = getActorUsername(req);
        if (!actorUsername) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const existingStockQuery = await turso.execute({
            sql: 'SELECT * FROM stocks WHERE item = ? AND firm_id = ?',
            args: [item, req.user.firm_id]
        });
        const existingStock = existingStockQuery.rows[0];
        
        if (existingStock) {
            let existingBatches = existingStock.batches ? JSON.parse(existingStock.batches) : [];
            const incomingBatches = normalizedBatches;

            if (incomingBatches && incomingBatches.length > 0) {
                const b0 = incomingBatches[0] || {};
                batch = b0.batch ?? batch;
                qty = b0.qty ?? qty;
                rate = b0.rate ?? rate;
                mrp = b0.mrp ?? mrp;
                expiryDate = b0.expiry ?? expiryDate;
            }

            const existingBatchIndex = existingBatches.findIndex(b => b.batch === batch);

            if (existingBatchIndex !== -1) {
                existingBatches[existingBatchIndex].qty += parseFloat(qty);
                if (mrp !== undefined && mrp !== null && mrp !== '') existingBatches[existingBatchIndex].mrp = parseFloat(mrp);
                if (expiryDate) existingBatches[existingBatchIndex].expiry = expiryDate;
                if (rate !== undefined && rate !== null && rate !== '') existingBatches[existingBatchIndex].rate = parseFloat(rate);
            } else {
                existingBatches.push({
                    batch: batch || null,
                    qty: parseFloat(qty),
                    rate: parseFloat(rate),
                    expiry: expiryDate || null,
                    mrp: mrp ? parseFloat(mrp) : null
                });
            }

            const newTotalQty = existingBatches.reduce((sum, b) => sum + b.qty, 0);
            const newTotal = newTotalQty * parseFloat(rate);
            
            await turso.execute({
                sql: `
                    UPDATE stocks 
                    SET qty = ?, total = ?, mrp = ?, batches = ?, user = ?, updated_at = ?
                    WHERE item = ? AND firm_id = ?
                `,
                args: [
                    newTotalQty,
                    newTotal,
                    mrp ? parseFloat(mrp) : null,
                    JSON.stringify(existingBatches),
                    actorUsername,
                    now(),
                    item,
                    req.user.firm_id
                ]
            });
            
            res.json({ id: Number(existingStock.id), message: 'Stock batch updated successfully' });
        } else {
            const batchesToStore = (normalizedBatches && normalizedBatches.length > 0)
                ? normalizedBatches
                : [{
                    batch: batch || null,
                    qty: parseFloat(qty),
                    rate: parseFloat(rate),
                    expiry: expiryDate || null,
                    mrp: mrp ? parseFloat(mrp) : null
                }];
            
            const total = parseFloat(qty) * parseFloat(rate);

            const result = await turso.execute({
                sql: `
                    INSERT INTO stocks (item, pno, oem, hsn, qty, uom, rate, grate, total, mrp, batches, user, created_at, updated_at, firm_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    item,
                    pno || null,
                    oem || null,
                    hsn,
                    parseFloat(qty),
                    uom,
                    parseFloat(rate),
                    parseFloat(grate),
                    total,
                    mrp ? parseFloat(mrp) : null,
                    JSON.stringify(batchesToStore),
                    actorUsername,
                    now(),
                    now(),
                    req.user.firm_id
                ]
            });

            res.json({ id: Number(result.lastInsertRowid), message: 'Stock added successfully' });
        }
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        let { item, pno, batch, oem, hsn, qty, uom, rate, grate, mrp, expiryDate, batches: incomingBatches } = req.body;

        const actorUsername = getActorUsername(req);
        if (!actorUsername) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const currentStockQuery = await turso.execute({
            sql: 'SELECT * FROM stocks WHERE id = ? AND firm_id = ?',
            args: [id, req.user.firm_id]
        });
        const currentStock = currentStockQuery.rows[0];
        if (!currentStock) {
            return res.status(404).json({ error: 'Stock not found or does not belong to your firm' });
        }
        
        let batches = currentStock.batches ? JSON.parse(currentStock.batches) : [];

        if (incomingBatches) {
            try {
                const parsed = Array.isArray(incomingBatches) ? incomingBatches : JSON.parse(incomingBatches);
                if (Array.isArray(parsed)) {
                    batches = parsed;
                }
            } catch (e) {
            }

            const b0 = Array.isArray(batches) && batches.length > 0 ? (batches[0] || {}) : null;
            if (b0) {
                if (!batch && (b0.batch !== undefined)) batch = b0.batch;
                if (!qty && (b0.qty !== undefined)) qty = b0.qty;
                if (!rate && (b0.rate !== undefined)) rate = b0.rate;
                if (!mrp && (b0.mrp !== undefined)) mrp = b0.mrp;
                if (!expiryDate && (b0.expiry !== undefined)) expiryDate = b0.expiry;
            }
        }

        if (!incomingBatches && batch) {
            const batchIndex = batches.findIndex(b => b.batch === batch);
            if (batchIndex !== -1) {
                batches[batchIndex].qty = parseFloat(qty);
                if (rate) batches[batchIndex].rate = parseFloat(rate);
                if (expiryDate) batches[batchIndex].expiry = expiryDate;
                if (mrp) batches[batchIndex].mrp = parseFloat(mrp);
            } else {
                batches.push({
                    batch: batch,
                    qty: parseFloat(qty),
                    rate: parseFloat(rate),
                    expiry: expiryDate || null,
                    mrp: mrp ? parseFloat(mrp) : null
                });
            }
        } else if (!incomingBatches) {
            if (batches.length > 0) {
                batches[0].qty = parseFloat(qty);
                if (rate) batches[0].rate = parseFloat(rate);
                if (expiryDate) batches[0].expiry = expiryDate;
                if (mrp) batches[0].mrp = parseFloat(mrp);
            } else {
                batches.push({
                    batch: null,
                    qty: parseFloat(qty),
                    rate: parseFloat(rate),
                    expiry: expiryDate || null,
                    mrp: mrp ? parseFloat(mrp) : null
                });
            }
        }
        
        const newTotalQty = batches.reduce((sum, b) => sum + b.qty, 0);
        const effectiveRate = parseFloat(rate || currentStock.rate || 0);
        const newTotal = newTotalQty * effectiveRate;
        
        await turso.execute({
            sql: `
                UPDATE stocks SET 
                    item = ?, pno = ?, oem = ?, hsn = ?, 
                    qty = ?, uom = ?, rate = ?, grate = ?, total = ?, 
                    mrp = ?, batches = ?, user = ?, updated_at = ?
                WHERE id = ? AND firm_id = ?
            `,
            args: [
                item,
                pno || null,
                oem || null,
                hsn,
                newTotalQty,
                uom,
                effectiveRate,
                parseFloat(grate),
                newTotal,
                mrp ? parseFloat(mrp) : null,
                JSON.stringify(batches),
                actorUsername,
                now(),
                id,
                req.user.firm_id
            ]
        });

        res.json({ message: 'Stock updated successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteStock = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const result = await turso.execute({
            sql: 'DELETE FROM stocks WHERE id = ? AND firm_id = ?',
            args: [id, req.user.firm_id]
        });
        
        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Stock not found or does not belong to your firm' });
        }
        
        res.json({ message: 'Stock deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllParties = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const partiesQuery = await turso.execute({
            sql: 'SELECT * FROM parties WHERE firm_id = ? ORDER BY created_at DESC',
            args: [req.user.firm_id]
        });
        res.json(normalizeRows(partiesQuery.rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createParty = async (req, res) => {
    try {
        const { firm, gstin, contact, state, state_code, addr, pin, pan } = req.body;

        const actorUsername = getActorUsername(req);
        if (!actorUsername) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const result = await turso.execute({
            sql: `
                INSERT INTO parties (firm, gstin, contact, state, state_code, addr, pin, pan, usern, supply, created_at, updated_at, firm_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                firm,
                gstin || 'UNREGISTERED',
                contact || null,
                state || '',
                state_code || null,
                addr || null,
                pin || null,
                pan || null,
                actorUsername,
                state || '',
                now(),
                now(),
                req.user.firm_id
            ]
        });

        res.json({ id: Number(result.lastInsertRowid), message: 'Party created successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.createBill = async (req, res) => {
    const { meta, party, cart, otherCharges } = req.body; 

    const actorUsername = getActorUsername(req);
    if (!actorUsername) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.user || !req.user.firm_id) {
        return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    if (!cart || cart.length === 0) {
        return res.status(400).json({ error: "Cart cannot be empty" });
    }
    
    const requestedBillNo = typeof meta.billNo === 'string' ? meta.billNo.trim() : '';
    if (requestedBillNo) {
        try {
            const existingBillNoQuery = await turso.execute({
                sql: 'SELECT id FROM bills WHERE bno = ? AND firm_id = ? LIMIT 1',
                args: [requestedBillNo, req.user.firm_id]
            });
            if (existingBillNoQuery.rows && existingBillNoQuery.rows[0]) {
                return res.status(400).json({ error: 'Bill number already exists. Please use a unique bill number.' });
            }
            meta.billNo = requestedBillNo;
        } catch (error) {
            console.error(`[CREATE_BILL] Failed to validate manual bill number:`, error.message);
            return res.status(500).json({ error: `Failed to validate bill number: ${error.message}` });
        }
    } else {
        let billNo;
        try {
            billNo = await getNextBillNumber(Number(req.user.firm_id));
            console.log(`[CREATE_BILL] Generated bill number: ${billNo}`);
        } catch (error) {
            console.error(`[CREATE_BILL] Failed to generate bill number:`, error.message);
            return res.status(500).json({ error: `Failed to generate bill number: ${error.message}` });
        }
        meta.billNo = billNo;
    }

    let gstEnabled = true;
    try {
        const firmGstSettingQuery = await turso.execute({
            sql: 'SELECT setting_value FROM firm_settings WHERE firm_id = ? AND setting_key = ?',
            args: [req.user.firm_id, 'gst_enabled']
        });
        const firmGstSetting = firmGstSettingQuery.rows[0];
        
        if (firmGstSetting) {
            gstEnabled = firmGstSetting.setting_value === 'true';
        } else {
            const gstSettingQuery = await turso.execute({
                sql: 'SELECT setting_value FROM settings WHERE setting_key = ?',
                args: ['gst_enabled']
            });
            const gstSetting = gstSettingQuery.rows[0];
            gstEnabled = gstSetting ? gstSetting.setting_value === 'true' : true;
        }
    } catch (error) {
        console.warn('Error fetching GST settings, defaulting to enabled:', error.message);
        gstEnabled = true;
    }

    let gtot = 0;
    let totalTax = 0;

    cart.forEach(item => {
        const lineVal = item.qty * item.rate * (1 - (item.disc || 0)/100);
        if (gstEnabled) {
            const lineTax = lineVal * (item.grate / 100);
            totalTax += lineTax;
        }
        gtot += lineVal;
    });

    let otherChargesTotal = 0;
    let otherChargesGstTotal = 0;
    
    if (otherCharges && otherCharges.length > 0) {
        otherCharges.forEach(charge => {
            const chargeAmount = parseFloat(charge.amount) || 0;
            otherChargesTotal += chargeAmount;
            
            if (gstEnabled) {
                const chargeGstRate = parseFloat(charge.gstRate) || 0;
                const chargeGstAmount = (chargeAmount * chargeGstRate) / 100;
                otherChargesGstTotal += chargeGstAmount;
            }
        });
    }
    
    gtot = gtot + otherChargesTotal;
    
    let cgst = 0, sgst = 0, igst = 0;
    
    if (gstEnabled && meta.billType === 'intra-state') {
        cgst = (totalTax / 2) + (otherChargesGstTotal / 2);
        sgst = (totalTax / 2) + (otherChargesGstTotal / 2);
    } else if (gstEnabled) {
        igst = totalTax + otherChargesGstTotal;
    }
    
    let ntot = gtot + (meta.reverseCharge ? 0 : totalTax + otherChargesGstTotal);
    const roundedNtot = Math.round(ntot);
    const rof = (roundedNtot - ntot).toFixed(2);
    ntot = roundedNtot;

    const supplyState = party.state || 'Local';

    try {
        const batchResults = await turso.batch([
            {
                sql: `
                    INSERT INTO bills (
                        bno, bdate, supply, addr, gstin, state, pin, state_code,
                        gtot, ntot, rof, btype, usern, firm, 
                        party_id, oth_chg_json, order_no, vehicle_no, dispatch_through, narration, created_at, updated_at, reverse_charge,
                        cgst, sgst, igst, firm_id
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?
                    )
                `,
                args: [
                    meta.billNo, meta.billDate, supplyState, party.addr || '', party.gstin || 'UNREGISTERED',
                    party.state || '', party.pin || null, party.state_code || null,
                    gtot, ntot, rof, meta.billType ? meta.billType.toUpperCase() : 'PURCHASE', actorUsername, party.firm,
                    party.id || null, otherCharges && otherCharges.length > 0 ? JSON.stringify(otherCharges) : null,
                    meta.referenceNo || null, meta.vehicleNo || null, meta.dispatchThrough || null, meta.narration || null,
                    now(), now(), meta.reverseCharge || 0,
                    cgst, sgst, igst, req.user.firm_id
                ]
            }
        ]);

        const billId = Number(batchResults[0].lastInsertRowid);

        for (const item of cart) {
            const lineTotal = item.qty * item.rate * (1 - (item.disc || 0)/100);

            const stockQuery = await turso.execute({
                sql: 'SELECT * FROM stocks WHERE id = ? AND firm_id = ?',
                args: [item.stockId, req.user.firm_id]
            });
            const stockRecord = stockQuery.rows[0];
            if (!stockRecord) {
                throw new Error(`Stock record not found for ID: ${item.stockId} or does not belong to your firm`);
            }
            
            let batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
            
            let batchIndex = -1;
            if (item.batch === null || item.batch === undefined || item.batch === '') {
                batchIndex = batches.findIndex(b => b.batch === null || b.batch === undefined || b.batch === '');
            } else {
                batchIndex = batches.findIndex(b => b.batch === item.batch);
            }
            
            if (batchIndex === -1) {
                batches.push({
                    batch: item.batch || null,
                    qty: 0,
                    rate: item.rate,
                    expiry: null,
                    mrp: null
                });
                batchIndex = batches.length - 1;
            }
            
            batches[batchIndex].qty += item.qty;
            
            const newTotalQty = batches.reduce((sum, b) => sum + b.qty, 0);
            
            await turso.execute({
                sql: `
                    UPDATE stocks 
                    SET qty = ?, batches = ?, user = ?, updated_at = ?
                    WHERE id = ? AND firm_id = ?
                `,
                args: [
                    newTotalQty, JSON.stringify(batches), actorUsername, now(),
                    item.stockId, req.user.firm_id
                ]
            });

            await turso.execute({
                sql: `
                    INSERT INTO stock_reg (
                        type, bno, bdate, supply, item, item_narration, batch, hsn, 
                        qty, uom, rate, grate, disc, total, 
                        stock_id, bill_id, user, firm, created_at, updated_at, qtyh, firm_id
                    ) VALUES (
                        'PURCHASE', ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, 0, ?
                    )
                `,
                args: [
                    meta.billNo, meta.billDate, supplyState, item.item, item.narration || null, item.batch || null, item.hsn,
                    item.qty, item.uom, item.rate, item.grate, item.disc || 0, lineTotal,
                    item.stockId, billId, actorUsername, party.firm, now(), now(), req.user.firm_id
                ]
            });
        }

        const ledgerBase = {
            voucher_id: billId,
            voucher_type: 'PURCHASE',
            voucher_no: meta.billNo,
            bill_id: billId,
            transaction_date: meta.billDate,
            created_by: actorUsername,
            firm_id: req.user.firm_id,
            created_at: now(),
            updated_at: now()
        };

        await turso.execute({
            sql: `
                INSERT INTO ledger (
                    voucher_id, voucher_type, voucher_no, account_head, account_type,
                    debit_amount, credit_amount, narration, bill_id, party_id,
                    tax_type, tax_rate, transaction_date, created_by, firm_id,
                    created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?
                )
            `,
            args: [
                ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no, party.firm, 'CREDITOR',
                0, ntot, `Purchase Bill No: ${meta.billNo}`, ledgerBase.bill_id, party.id || null,
                null, null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                ledgerBase.created_at, ledgerBase.updated_at
            ]
        });

        if (cgst > 0) {
            await turso.execute({
                sql: `
                    INSERT INTO ledger (
                        voucher_id, voucher_type, voucher_no, account_head, account_type,
                        debit_amount, credit_amount, narration, bill_id, party_id,
                        tax_type, tax_rate, transaction_date, created_by, firm_id,
                        created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?
                    )
                `,
                args: [
                    ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no, 'CGST', 'TAX',
                    cgst, 0, `CGST on Bill No: ${meta.billNo}`, ledgerBase.bill_id, null,
                    'CGST', null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                    ledgerBase.created_at, ledgerBase.updated_at
                ]
            });
        }
        if (sgst > 0) {
            await turso.execute({
                sql: `
                    INSERT INTO ledger (
                        voucher_id, voucher_type, voucher_no, account_head, account_type,
                        debit_amount, credit_amount, narration, bill_id, party_id,
                        tax_type, tax_rate, transaction_date, created_by, firm_id,
                        created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?
                    )
                `,
                args: [
                    ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no, 'SGST', 'TAX',
                    sgst, 0, `SGST on Bill No: ${meta.billNo}`, ledgerBase.bill_id, null,
                    'SGST', null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                    ledgerBase.created_at, ledgerBase.updated_at
                ]
            });
        }
        if (igst > 0) {
            await turso.execute({
                sql: `
                    INSERT INTO ledger (
                        voucher_id, voucher_type, voucher_no, account_head, account_type,
                        debit_amount, credit_amount, narration, bill_id, party_id,
                        tax_type, tax_rate, transaction_date, created_by, firm_id,
                        created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?
                    )
                `,
                args: [
                    ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no, 'IGST', 'TAX',
                    igst, 0, `IGST on Bill No: ${meta.billNo}`, ledgerBase.bill_id, null,
                    'IGST', null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                    ledgerBase.created_at, ledgerBase.updated_at
                ]
            });
        }

        if (Math.abs(parseFloat(rof)) > 0) {
            const rofVal = parseFloat(rof);
            await turso.execute({
                sql: `
                    INSERT INTO ledger (
                        voucher_id, voucher_type, voucher_no, account_head, account_type,
                        debit_amount, credit_amount, narration, bill_id, party_id,
                        tax_type, tax_rate, transaction_date, created_by, firm_id,
                        created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?
                    )
                `,
                args: [
                    ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no, 'Round Off', 'INDIRECT EXPENSE',
                    rofVal > 0 ? rofVal : 0, rofVal < 0 ? Math.abs(rofVal) : 0, `Round off on Bill No: ${meta.billNo}`, 
                    ledgerBase.bill_id, null,
                    null, null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                    ledgerBase.created_at, ledgerBase.updated_at
                ]
            });
        }

        if (otherCharges && otherCharges.length > 0) {
            for (const charge of otherCharges) {
                const chargeAmount = parseFloat(charge.amount) || 0;
                if (chargeAmount > 0) {
                    await turso.execute({
                        sql: `
                            INSERT INTO ledger (
                                voucher_id, voucher_type, voucher_no, account_head, account_type,
                                debit_amount, credit_amount, narration, bill_id, party_id,
                                tax_type, tax_rate, transaction_date, created_by, firm_id,
                                created_at, updated_at
                            ) VALUES (
                                ?, ?, ?, ?, ?,
                                ?, ?, ?, ?, ?,
                                ?, ?, ?, ?, ?,
                                ?, ?
                            )
                        `,
                        args: [
                            ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no,
                            charge.name || charge.type || 'Other Charges', 'EXPENSE',
                            chargeAmount, 0, `${charge.name || charge.type || 'Other Charges'} on Bill No: ${meta.billNo}`,
                            ledgerBase.bill_id, null,
                            null, null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                            ledgerBase.created_at, ledgerBase.updated_at
                        ]
                    });
                }
            }
        }

        const taxableItemsTotal = cart.reduce((sum, item) => sum + (item.qty * item.rate * (1 - (item.disc || 0)/100)), 0);
        await turso.execute({
            sql: `
                INSERT INTO ledger (
                    voucher_id, voucher_type, voucher_no, account_head, account_type,
                    debit_amount, credit_amount, narration, bill_id, party_id,
                    tax_type, tax_rate, transaction_date, created_by, firm_id,
                    created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?
                )
            `,
            args: [
                ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no, 'Purchase', 'EXPENSE',
                taxableItemsTotal, 0, `Purchase on Bill No: ${meta.billNo}`, ledgerBase.bill_id, null,
                null, null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                ledgerBase.created_at, ledgerBase.updated_at
            ]
        });

        res.json({ message: "Bill saved successfully", billId });
    } catch (err) {
        console.error("Transaction Error:", err);
        res.status(500).json({ error: "Failed to save bill: " + err.message });
    }
};

exports.getBillById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        if (!id) {
            return res.status(400).json({ error: 'Bill ID is required' });
        }
        
        const billQuery = await turso.execute({
            sql: `
                SELECT 
                    b.*, 
                    sr.type as transactionType
                FROM bills b
                LEFT JOIN (
                    SELECT bill_id, type, MIN(id) as min_id 
                    FROM stock_reg 
                    GROUP BY bill_id
                ) sr ON b.id = sr.bill_id
                WHERE b.id = ? AND b.firm_id = ?
            `,
            args: [id, req.user.firm_id]
        });
        let bill = normalizeRow(billQuery.rows[0]);
        
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found or does not belong to your firm' });
        }
        
        if (bill.oth_chg_json) {
            try {
                bill.otherCharges = JSON.parse(bill.oth_chg_json);
            } catch (e) {
                console.warn('Failed to parse other charges for bill', bill.id, e.message);
                bill.otherCharges = [];
            }
        } else {
            bill.otherCharges = [];
        }
        
        bill.reverseCharge = bill.reverse_charge || false;
        
        bill.cgst = bill.cgst || 0;
        bill.sgst = bill.sgst || 0;
        bill.igst = bill.igst || 0;
        
        try {
            const firmGstSettingQuery = await turso.execute({
                sql: 'SELECT setting_value FROM firm_settings WHERE firm_id = ? AND setting_key = ?',
                args: [req.user.firm_id, 'gst_enabled']
            });
            const firmGstSetting = firmGstSettingQuery.rows[0];
            
            if (firmGstSetting) {
                bill.gstEnabled = firmGstSetting.setting_value === 'true';
            } else {
                const gstSettingQuery = await turso.execute({
                    sql: 'SELECT setting_value FROM settings WHERE setting_key = ?',
                    args: ['gst_enabled']
                });
                const gstSetting = gstSettingQuery.rows[0];
                bill.gstEnabled = gstSetting ? gstSetting.setting_value === 'true' : true;
            }
        } catch (error) {
            console.warn('Error fetching GST settings for bill, defaulting to enabled:', error.message);
            bill.gstEnabled = true;
        }
        
        bill.transactionType = bill.transactionType ? 
            (bill.transactionType === 'SALE' ? 'SALES' : 
             bill.transactionType === 'PURCHASE' ? 'PURCHASE' : 
             bill.transactionType) : 'PURCHASE';
        
        const itemsQuery = await turso.execute({
            sql: 'SELECT *, item_narration FROM stock_reg WHERE bill_id = ? AND firm_id = ? ORDER BY created_at',
            args: [id, req.user.firm_id]
        });
        bill.items = normalizeRows(itemsQuery.rows);
        
        res.json(bill);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllBills = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const billsQuery = await turso.execute({
            sql: `
                SELECT 
                    b.*, 
                    sr.type as transactionType
                FROM bills b
                LEFT JOIN (
                    SELECT bill_id, type, MIN(id) as min_id 
                    FROM stock_reg 
                    GROUP BY bill_id
                ) sr ON b.id = sr.bill_id
                WHERE b.firm_id = ?
                ORDER BY b.created_at DESC
            `,
            args: [req.user.firm_id]
        });
        const bills = normalizeRows(billsQuery.rows);
        
        let gstEnabled = true;
        try {
            const firmGstSettingQuery = await turso.execute({
                sql: 'SELECT setting_value FROM firm_settings WHERE firm_id = ? AND setting_key = ?',
                args: [req.user.firm_id, 'gst_enabled']
            });
            const firmGstSetting = firmGstSettingQuery.rows[0];
            
            if (firmGstSetting) {
                gstEnabled = firmGstSetting.setting_value === 'true';
            } else {
                const gstSettingQuery = await turso.execute({
                    sql: 'SELECT setting_value FROM settings WHERE setting_key = ?',
                    args: ['gst_enabled']
                });
                const gstSetting = gstSettingQuery.rows[0];
                gstEnabled = gstSetting ? gstSetting.setting_value === 'true' : true;
            }
        } catch (error) {
            console.warn('Error fetching GST settings for bills, defaulting to enabled:', error.message);
            gstEnabled = true;
        }
        
        const processedBills = bills.map(bill => {
            if (bill.status === 'CANCELLED' || bill.status === 'DELETED') {
                return {
                    id: bill.id,
                    bno: bill.bno,
                    bdate: bill.bdate,
                    status: bill.status,
                    cancellation_reason: bill.cancellation_reason,
                    cancelled_at: bill.cancelled_at,
                    firm_id: bill.firm_id,
                    supply: '***',
                    addr: '***',
                    gstin: '***',
                    state: '***',
                    gtot: 0,
                    ntot: 0,
                    rof: 0,
                    cgst: 0,
                    sgst: 0,
                    igst: 0,
                    usern: bill.usern,
                    firm: '***',
                    otherCharges: [],
                    items: []
                };
            }

            if (bill.oth_chg_json) {
                try {
                    bill.otherCharges = JSON.parse(bill.oth_chg_json);
                } catch (e) {
                    console.warn('Failed to parse other charges for bill', bill.id, e.message);
                    bill.otherCharges = [];
                }
            } else {
                bill.otherCharges = [];
            }
            
            bill.reverseCharge = bill.reverse_charge || false;
            
            bill.cgst = bill.cgst || 0;
            bill.sgst = bill.sgst || 0;
            bill.igst = bill.igst || 0;
            
            bill.gstEnabled = gstEnabled;
            
            bill.transactionType = bill.transactionType ? 
                (bill.transactionType === 'SALE' ? 'SALES' : 
                 bill.transactionType === 'PURCHASE' ? 'PURCHASE' : 
                 bill.transactionType) : 'PURCHASE';
            
            return bill;
        });
        
        res.json(processedBills);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getStockBatches = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const stockQuery = await turso.execute({
            sql: 'SELECT * FROM stocks WHERE id = ? AND firm_id = ?',
            args: [id, req.user.firm_id]
        });
        const stock = normalizeRow(stockQuery.rows[0]);
        if (!stock) {
            return res.status(404).json({ error: 'Stock not found or does not belong to your firm' });
        }
        
        const batches = stock.batches ? JSON.parse(stock.batches) : [];
        
        res.json({
            id: stock.id,
            item: stock.item,
            batches: batches
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getOtherChargesTypes = async (req, res) => {
    try {
        const query = `SELECT DISTINCT json_extract(oth_chg_json, '$[0].type') as type,
                                  json_extract(oth_chg_json, '$[0].name') as name,
                                  json_extract(oth_chg_json, '$[0].hsnSac') as hsnSac,
                                  json_extract(oth_chg_json, '$[0].gstRate') as gstRate
                           FROM bills 
                           WHERE oth_chg_json IS NOT NULL 
                           AND oth_chg_json != 'null'
                           AND oth_chg_json != ''
                           ORDER BY json_extract(oth_chg_json, '$[0].type')`;
        
        const result = await turso.execute({ sql: query });
        const results = normalizeRows(result.rows);
        
        const uniqueCharges = [];
        const seen = new Set();
        
        results.forEach(row => {
            if (row.type) {
                const key = `${row.type}-${row.name || ''}-${row.hsnSac || ''}-${row.gstRate || ''}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueCharges.push({
                        type: row.type,
                        name: row.name || '',
                        hsnSac: row.hsnSac || '',
                        gstRate: row.gstRate ? parseFloat(row.gstRate) : 0
                    });
                }
            }
        });
        
        res.json(uniqueCharges);
    } catch (err) {
        console.error('Error fetching other charges types:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getNextBillNumber = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const firmId = req.user.firm_id;
        const financialYear = getCurrentFinancialYear();
        
        const nextBillNo = await getNextBillNumberPreview(firmId, financialYear);
        const seqInfo = await getCurrentSequence(firmId, financialYear);
        
        console.log(`[GET_NEXT_BILL_INFO] Next available for Firm ${firmId}: ${nextBillNo}`);
        
        res.json({ 
            nextBillNo: nextBillNo,
            nextSequence: seqInfo.next_sequence,
            financialYear: financialYear,
            currentSequence: seqInfo.current_sequence,
            format: 'F{FIRM_ID}-{SEQUENCE:4d}/{FINANCIAL_YEAR}',
            note: 'This is for display only, actual number generated when bill is saved'
        });
    } catch (error) {
        console.error('[GET_NEXT_BILL_INFO] Error:', error.message);
        res.status(500).json({ error: `Failed to get bill number info: ${error.message}` });
    }
};

exports.updateBill = async (req, res) => {
    const { meta, party, cart, otherCharges } = req.body;
    const { id } = req.params;

    const actorUsername = getActorUsername(req);
    if (!actorUsername) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.user || !req.user.firm_id) {
        return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    if (!cart || cart.length === 0) {
        return res.status(400).json({ error: "Cart cannot be empty" });
    }

    let gstEnabled = true;
    try {
        const firmGstSettingQuery = await turso.execute({
            sql: 'SELECT setting_value FROM firm_settings WHERE firm_id = ? AND setting_key = ?',
            args: [req.user.firm_id, 'gst_enabled']
        });
        const firmGstSetting = firmGstSettingQuery.rows[0];
        
        if (firmGstSetting) {
            gstEnabled = firmGstSetting.setting_value === 'true';
        } else {
            const gstSettingQuery = await turso.execute({
                sql: 'SELECT setting_value FROM settings WHERE setting_key = ?',
                args: ['gst_enabled']
            });
            const gstSetting = gstSettingQuery.rows[0];
            gstEnabled = gstSetting ? gstSetting.setting_value === 'true' : true;
        }
    } catch (error) {
        console.warn('Error fetching GST settings for update bill, defaulting to enabled:', error.message);
        gstEnabled = true;
    }

    let gtot = 0;
    let totalTax = 0;

    cart.forEach(item => {
        const lineVal = item.qty * item.rate * (1 - (item.disc || 0)/100);
        if (gstEnabled) {
            const lineTax = lineVal * (item.grate / 100);
            totalTax += lineTax;
        }
        gtot += lineVal;
    });

    let otherChargesTotal = 0;
    let otherChargesGstTotal = 0;
    
    if (otherCharges && otherCharges.length > 0) {
        otherCharges.forEach(charge => {
            const chargeAmount = parseFloat(charge.amount) || 0;
            otherChargesTotal += chargeAmount;
            
            if (gstEnabled) {
                const chargeGstRate = parseFloat(charge.gstRate) || 0;
                const chargeGstAmount = (chargeAmount * chargeGstRate) / 100;
                otherChargesGstTotal += chargeGstAmount;
            }
        });
    }
    
    gtot = gtot + otherChargesTotal;
    
    let cgst = 0, sgst = 0, igst = 0;
    
    if (gstEnabled && meta.billType === 'intra-state') {
        cgst = (totalTax / 2) + (otherChargesGstTotal / 2);
        sgst = (totalTax / 2) + (otherChargesGstTotal / 2);
    } else if (gstEnabled) {
        igst = totalTax + otherChargesGstTotal;
    }
    
    let ntot = gtot + (meta.reverseCharge ? 0 : totalTax + otherChargesGstTotal);
    const roundedNtot = Math.round(ntot);
    const rof = (roundedNtot - ntot).toFixed(2);
    ntot = roundedNtot;
    const supplyState = party.state || 'Local';

    const existingBillQuery = await turso.execute({
        sql: 'SELECT * FROM bills WHERE id = ? AND firm_id = ?',
        args: [id, req.user.firm_id]
    });
    const existingBill = existingBillQuery.rows[0];
    if (!existingBill) {
        return res.status(404).json({ error: 'Bill not found or does not belong to your firm' });
    }
    
    if (meta.billNo && meta.billNo !== existingBill.bno) {
        console.warn(`[SECURITY] Attempt to change bill number from ${existingBill.bno} to ${meta.billNo} by user ${actorUsername}`);
        return res.status(403).json({ error: 'Bill number cannot be changed. A bill is identified by its unique number.' });
    }
    
    meta.billNo = existingBill.bno;

    const existingItemsQuery = await turso.execute({
        sql: 'SELECT * FROM stock_reg WHERE bill_id = ? AND firm_id = ?',
        args: [id, req.user.firm_id]
    });
    const existingItems = normalizeRows(existingItemsQuery.rows);

    try {
        for (const existingItem of existingItems) {
            const stockQuery = await turso.execute({
                sql: 'SELECT * FROM stocks WHERE id = ? AND firm_id = ?',
                args: [existingItem.stock_id, req.user.firm_id]
            });
            const stockRecord = stockQuery.rows[0];
            if (!stockRecord) {
                throw new Error(`Stock record not found for ID: ${existingItem.stock_id} or does not belong to your firm`);
            }
            
            let batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
            
            let batchIndex = -1;
            if (existingItem.batch === null || existingItem.batch === undefined || existingItem.batch === '') {
                batchIndex = batches.findIndex(b => b.batch === null || b.batch === undefined || b.batch === '');
            } else {
                batchIndex = batches.findIndex(b => b.batch === existingItem.batch);
            }
            
            if (batchIndex !== -1) {
                batches[batchIndex].qty += existingItem.qty;
                const newTotalQty = batches.reduce((sum, b) => sum + b.qty, 0);
                
                await turso.execute({
                    sql: `
                        UPDATE stocks 
                        SET qty = ?, batches = ?, user = ?, updated_at = ?
                        WHERE id = ? AND firm_id = ?
                    `,
                    args: [
                        newTotalQty, JSON.stringify(batches), actorUsername, now(),
                        existingItem.stock_id, req.user.firm_id
                    ]
                });
            }
        }
        
        await turso.execute({
            sql: `
                UPDATE bills SET
                    bno = ?, bdate = ?, supply = ?, addr = ?, gstin = ?, state = ?, pin = ?, state_code = ?,
                    gtot = ?, ntot = ?, btype = ?, usern = ?, firm = ?,
                    party_id = ?, oth_chg_json = ?, order_no = ?, vehicle_no = ?, 
                    dispatch_through = ?, narration = ?, updated_at = ?, 
                    reverse_charge = ?, cgst = ?, sgst = ?, igst = ?
                WHERE id = ? AND firm_id = ?
            `,
            args: [
                meta.billNo, meta.billDate, supplyState, party.addr || '', party.gstin || 'UNREGISTERED',
                party.state || '', party.pin || null, party.state_code || null,
                gtot, ntot, meta.billType ? meta.billType.toUpperCase() : 'PURCHASE', actorUsername, party.firm,
                party.id || null, otherCharges && otherCharges.length > 0 ? JSON.stringify(otherCharges) : null,
                meta.referenceNo || null, meta.vehicleNo || null, meta.dispatchThrough || null,
                meta.narration || null, now(),
                meta.reverseCharge || 0,
                cgst, sgst, igst,
                id, req.user.firm_id
            ]
        });

        await turso.execute({
            sql: 'DELETE FROM stock_reg WHERE bill_id = ? AND firm_id = ?',
            args: [id, req.user.firm_id]
        });

        for (const item of cart) {
            const lineTotal = item.qty * item.rate * (1 - (item.disc || 0)/100);

            const stockQuery = await turso.execute({
                sql: 'SELECT * FROM stocks WHERE id = ? AND firm_id = ?',
                args: [item.stockId, req.user.firm_id]
            });
            const stockRecord = stockQuery.rows[0];
            if (!stockRecord) {
                throw new Error(`Stock record not found for ID: ${item.stockId} or does not belong to your firm`);
            }
            
            let batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
            
            let batchIndex = -1;
            if (item.batch === null || item.batch === undefined || item.batch === '') {
                batchIndex = batches.findIndex(b => b.batch === null || b.batch === undefined || b.batch === '');
            } else {
                batchIndex = batches.findIndex(b => b.batch === item.batch);
            }
            
            if (batchIndex === -1) {
                throw new Error(`Batch ${item.batch} not found for item ${item.item}`);
            }
            
            batches[batchIndex].qty -= item.qty;
            if (batches[batchIndex].qty < 0) {
                throw new Error(`Insufficient quantity in batch ${item.batch} for item ${item.item}`);
            }
            
            const newTotalQty = batches.reduce((sum, b) => sum + b.qty, 0);
            
            await turso.execute({
                sql: `
                    UPDATE stocks 
                    SET qty = ?, batches = ?, user = ?, updated_at = ?
                    WHERE id = ? AND firm_id = ?
                `,
                args: [
                    newTotalQty, JSON.stringify(batches), actorUsername, now(),
                    item.stockId, req.user.firm_id
                ]
            });

            await turso.execute({
                sql: `
                    INSERT INTO stock_reg (
                        type, bno, bdate, supply, item, item_narration, batch, hsn, 
                        qty, uom, rate, grate, disc, total, 
                        stock_id, bill_id, user, firm, created_at, updated_at, qtyh, firm_id
                    ) VALUES (
                        'PURCHASE', ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, 0, ?
                    )
                `,
                args: [
                    meta.billNo, meta.billDate, supplyState, item.item, item.narration || null, item.batch || null, item.hsn,
                    item.qty, item.uom, item.rate, item.grate, item.disc || 0, lineTotal,
                    item.stockId, id, actorUsername, party.firm, now(), now(), req.user.firm_id
                ]
            });
        }

        await turso.execute({
            sql: 'DELETE FROM ledger WHERE voucher_id = ? AND voucher_type = ? AND firm_id = ?',
            args: [id, 'SALES', req.user.firm_id]
        });

        const ledgerBase = {
            voucher_id: id,
            voucher_type: 'SALES',
            voucher_no: meta.billNo,
            bill_id: id,
            transaction_date: meta.billDate,
            created_by: actorUsername,
            firm_id: req.user.firm_id,
            created_at: now(),
            updated_at: now()
        };

        await turso.execute({
            sql: `
                INSERT INTO ledger (
                    voucher_id, voucher_type, voucher_no, account_head, account_type,
                    debit_amount, credit_amount, narration, bill_id, party_id,
                    tax_type, tax_rate, transaction_date, created_by, firm_id,
                    created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?
                )
            `,
            args: [
                ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no, party.firm, 'DEBTOR',
                ntot, 0, `Sales Bill No: ${meta.billNo} (Updated)`, ledgerBase.bill_id, party.id || null,
                null, null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                ledgerBase.created_at, ledgerBase.updated_at
            ]
        });

        if (cgst > 0) {
            await turso.execute({
                sql: `
                    INSERT INTO ledger (
                        voucher_id, voucher_type, voucher_no, account_head, account_type,
                        debit_amount, credit_amount, narration, bill_id, party_id,
                        tax_type, tax_rate, transaction_date, created_by, firm_id,
                        created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?
                    )
                `,
                args: [
                    ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no, 'CGST', 'TAX',
                    0, cgst, `CGST on Bill No: ${meta.billNo} (Updated)`, ledgerBase.bill_id, null,
                    'CGST', null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                    ledgerBase.created_at, ledgerBase.updated_at
                ]
            });
        }
        if (sgst > 0) {
            await turso.execute({
                sql: `
                    INSERT INTO ledger (
                        voucher_id, voucher_type, voucher_no, account_head, account_type,
                        debit_amount, credit_amount, narration, bill_id, party_id,
                        tax_type, tax_rate, transaction_date, created_by, firm_id,
                        created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?
                    )
                `,
                args: [
                    ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no, 'SGST', 'TAX',
                    0, sgst, `SGST on Bill No: ${meta.billNo} (Updated)`, ledgerBase.bill_id, null,
                    'SGST', null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                    ledgerBase.created_at, ledgerBase.updated_at
                ]
            });
        }
        if (igst > 0) {
            await turso.execute({
                sql: `
                    INSERT INTO ledger (
                        voucher_id, voucher_type, voucher_no, account_head, account_type,
                        debit_amount, credit_amount, narration, bill_id, party_id,
                        tax_type, tax_rate, transaction_date, created_by, firm_id,
                        created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?
                    )
                `,
                args: [
                    ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no, 'IGST', 'TAX',
                    0, igst, `IGST on Bill No: ${meta.billNo} (Updated)`, ledgerBase.bill_id, null,
                    'IGST', null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                    ledgerBase.created_at, ledgerBase.updated_at
                ]
            });
        }

        if (Math.abs(parseFloat(rof)) > 0) {
            const rofVal = parseFloat(rof);
            await turso.execute({
                sql: `
                    INSERT INTO ledger (
                        voucher_id, voucher_type, voucher_no, account_head, account_type,
                        debit_amount, credit_amount, narration, bill_id, party_id,
                        tax_type, tax_rate, transaction_date, created_by, firm_id,
                        created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?
                    )
                `,
                args: [
                    ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no, 'Round Off', 'INDIRECT EXPENSE',
                    rofVal > 0 ? rofVal : 0, rofVal < 0 ? Math.abs(rofVal) : 0, `Round off on Bill No: ${meta.billNo} (Updated)`, 
                    ledgerBase.bill_id, null,
                    null, null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                    ledgerBase.created_at, ledgerBase.updated_at
                ]
            });
        }

        if (otherCharges && otherCharges.length > 0) {
            for (const charge of otherCharges) {
                const chargeAmount = parseFloat(charge.amount) || 0;
                if (chargeAmount > 0) {
                    await turso.execute({
                        sql: `
                            INSERT INTO ledger (
                                voucher_id, voucher_type, voucher_no, account_head, account_type,
                                debit_amount, credit_amount, narration, bill_id, party_id,
                                tax_type, tax_rate, transaction_date, created_by, firm_id,
                                created_at, updated_at
                            ) VALUES (
                                ?, ?, ?, ?, ?,
                                ?, ?, ?, ?, ?,
                                ?, ?, ?, ?, ?,
                                ?, ?
                            )
                        `,
                        args: [
                            ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no,
                            charge.name || charge.type || 'Other Charges', 'INCOME',
                            0, chargeAmount, `${charge.name || charge.type || 'Other Charges'} on Bill No: ${meta.billNo} (Updated)`,
                            ledgerBase.bill_id, null,
                            null, null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                            ledgerBase.created_at, ledgerBase.updated_at
                        ]
                    });
                }
            }
        }

        const taxableItemsTotal = cart.reduce((sum, item) => sum + (item.qty * item.rate * (1 - (item.disc || 0)/100)), 0);
        await turso.execute({
            sql: `
                INSERT INTO ledger (
                    voucher_id, voucher_type, voucher_no, account_head, account_type,
                    debit_amount, credit_amount, narration, bill_id, party_id,
                    tax_type, tax_rate, transaction_date, created_by, firm_id,
                    created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?
                )
            `,
            args: [
                ledgerBase.voucher_id, ledgerBase.voucher_type, ledgerBase.voucher_no, 'Sales', 'INCOME',
                0, taxableItemsTotal, `Sales on Bill No: ${meta.billNo} (Updated)`, ledgerBase.bill_id, null,
                null, null, ledgerBase.transaction_date, ledgerBase.created_by, ledgerBase.firm_id,
                ledgerBase.created_at, ledgerBase.updated_at
            ]
        });

        res.json({ message: "Bill updated successfully", billId: Number(id) });
    } catch (err) {
        console.error("Transaction Error:", err);
        res.status(500).json({ error: "Failed to update bill: " + err.message });
    }
};

exports.lookupGST = async (req, res) => {
    const { gstin } = req.query;

    if (!gstin) {
        return res.status(400).json({ error: 'GSTIN is required' });
    }

    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    const url = `https://powerful-gstin-tool.p.rapidapi.com/v1/gstin/${gstin}/details`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': 'powerful-gstin-tool.p.rapidapi.com'
            }
        });

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('GST API Error:', error);
        res.status(500).json({ error: 'Failed to fetch GST details' });
    }
};

exports.renderStockMovementsPage = async (req, res) => {
    try {
        let firmName = '';
        if (req.user && req.user.firm_id) {
            const firmQuery = await turso.execute({
                sql: 'SELECT name FROM firms WHERE id = ?',
                args: [req.user.firm_id]
            });
            const firm = firmQuery.rows[0];
            firmName = firm ? firm.name : '';
        }
        
        res.render('inventory/stock-movements', { 
            title: 'Stock Movement Tracking', 
            user: { 
                ...req.user, 
                firm_name: firmName 
            } || { username: 'Guest', firm_name: '' } 
        });
    } catch (error) {
        console.error('Error rendering stock movements page:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
};

exports.getStockMovements = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const { 
            startDate, 
            endDate, 
            stockId, 
            type, 
            batch, 
            page = 1, 
            limit = 50,
            search 
        } = req.query;

        let query = `
            SELECT 
                sr.id,
                sr.type,
                sr.bno,
                sr.bdate,
                sr.item,
                sr.batch,
                sr.qty,
                sr.uom,
                sr.rate,
                sr.total,
                sr.user,
                sr.firm,
                sr.created_at,
                s.item as stock_item_name,
                b.bno as bill_number
            FROM stock_reg sr
            LEFT JOIN stocks s ON sr.stock_id = s.id
            LEFT JOIN bills b ON sr.bill_id = b.id
            WHERE sr.firm_id = ?
        `;
        const params = [req.user.firm_id];

        if (startDate) {
            query += ` AND sr.created_at >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND sr.created_at <= ?`;
            params.push(endDate);
        }
        if (stockId) {
            query += ` AND sr.stock_id = ?`;
            params.push(stockId);
        }
        if (type) {
            query += ` AND sr.type = ?`;
            params.push(type);
        }
        if (batch) {
            query += ` AND sr.batch = ?`;
            params.push(batch);
        }
        if (search) {
            query += ` AND (sr.item LIKE ? OR s.item LIKE ? OR sr.bno LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ` ORDER BY sr.created_at DESC`;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const movementsQuery = await turso.execute({
            sql: query,
            args: params
        });
        const movements = normalizeRows(movementsQuery.rows);

        let countQuery = `
            SELECT COUNT(*) as count
            FROM stock_reg sr
            LEFT JOIN stocks s ON sr.stock_id = s.id
            LEFT JOIN bills b ON sr.bill_id = b.id
            WHERE sr.firm_id = ?
        `;
        const countParams = [req.user.firm_id];

        if (startDate) {
            countQuery += ` AND sr.created_at >= ?`;
            countParams.push(startDate);
        }
        if (endDate) {
            countQuery += ` AND sr.created_at <= ?`;
            countParams.push(endDate);
        }
        if (stockId) {
            countQuery += ` AND sr.stock_id = ?`;
            countParams.push(stockId);
        }
        if (type) {
            countQuery += ` AND sr.type = ?`;
            countParams.push(type);
        }
        if (batch) {
            countQuery += ` AND sr.batch = ?`;
            countParams.push(batch);
        }
        if (search) {
            countQuery += ` AND (sr.item LIKE ? OR s.item LIKE ? OR sr.bno LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        const countResult = await turso.execute({
            sql: countQuery,
            args: countParams
        });
        const totalCount = normalizeRow(countResult.rows[0] || {}).count || 0;

        res.json({
            movements,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error fetching stock movements:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getCurrentUserFirmName = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const firmQuery = await turso.execute({
            sql: 'SELECT name, address FROM firms WHERE id = ?',
            args: [req.user.firm_id]
        });
        const firm = firmQuery.rows[0];
        
        if (!firm) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        
        res.json({ 
            firmName: firm.name,
            address: firm.address || ''
        });
    } catch (err) {
        console.error('Error fetching firm name:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getStockMovementsByStock = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const stockCheckQuery = await turso.execute({
            sql: 'SELECT id FROM stocks WHERE id = ? AND firm_id = ?',
            args: [id, req.user.firm_id]
        });
        const stockCheck = stockCheckQuery.rows[0];
        if (!stockCheck) {
            return res.status(404).json({ error: 'Stock not found or does not belong to your firm' });
        }

        const { startDate, endDate, type, batch, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT 
                sr.id,
                sr.type,
                sr.bno,
                sr.bdate,
                sr.item,
                sr.batch,
                sr.qty,
                sr.uom,
                sr.rate,
                sr.total,
                sr.user,
                sr.firm,
                sr.created_at,
                b.bno as bill_number
            FROM stock_reg sr
            LEFT JOIN bills b ON sr.bill_id = b.id
            WHERE sr.stock_id = ? AND sr.firm_id = ?
        `;
        const params = [id, req.user.firm_id];

        if (startDate) {
            query += ` AND sr.created_at >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND sr.created_at <= ?`;
            params.push(endDate);
        }
        if (type) {
            query += ` AND sr.type = ?`;
            params.push(type);
        }
        if (batch) {
            query += ` AND sr.batch = ?`;
            params.push(batch);
        }

        query += ` ORDER BY sr.created_at DESC`;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const movementsQuery = await turso.execute({
            sql: query,
            args: params
        });
        const movements = normalizeRows(movementsQuery.rows);

        let countQuery = `
            SELECT COUNT(*) as count
            FROM stock_reg sr
            LEFT JOIN bills b ON sr.bill_id = b.id
            WHERE sr.stock_id = ? AND sr.firm_id = ? 
        `;
        const countParams = [id, req.user.firm_id];

        if (startDate) {
            countQuery += ` AND sr.created_at >= ?`;
            countParams.push(startDate);
        }
        if (endDate) {
            countQuery += ` AND sr.created_at <= ?`;
            countParams.push(endDate);
        }
        if (type) {
            countQuery += ` AND sr.type = ?`;
            countParams.push(type);
        }
        if (batch) {
            countQuery += ` AND sr.batch = ?`;
            countParams.push(batch);
        }

        const countResult = await turso.execute({
            sql: countQuery,
            args: countParams
        });
        const totalCount = normalizeRow(countResult.rows[0] || {}).count || 0;

        res.json({
            movements,
            stockId: Number(id),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error fetching stock movements by stock:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.createStockMovement = async (req, res) => {
    try {
        const { type, stockId, batch, qty, uom, rate, total, description, referenceNumber } = req.body;

        if (!type || !stockId || !qty || !uom) {
            return res.status(400).json({ error: 'Type, stockId, qty, and uom are required' });
        }

        const validTypes = ['RECEIPT', 'TRANSFER', 'ADJUSTMENT', 'OPENING'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid movement type. Must be one of: RECEIPT, TRANSFER, ADJUSTMENT, OPENING' });
        }

        const actorUsername = getActorUsername(req);
        if (!actorUsername) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const stockQuery = await turso.execute({
            sql: 'SELECT * FROM stocks WHERE id = ? AND firm_id = ?',
            args: [stockId, req.user.firm_id]
        });
        const stock = normalizeRow(stockQuery.rows[0]);
        if (!stock) {
            return res.status(404).json({ error: 'Stock not found or does not belong to your firm' });
        }

        const calculatedTotal = total || (qty * (rate || 0));

        const movementResult = await turso.execute({
            sql: `
                INSERT INTO stock_reg (
                    type, bno, bdate, supply, item, item_narration, batch, hsn, 
                    qty, uom, rate, grate, disc, total, 
                    stock_id, bill_id, user, firm, created_at, updated_at, qtyh, firm_id
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?
                )
            `,
            args: [
                type,
                referenceNumber || null,
                new Date().toISOString().split('T')[0],
                'INTERNAL',
                stock.item,
                description || null,
                batch || null,
                stock.hsn,
                Math.abs(qty),
                uom,
                rate || 0,
                stock.grate || 0,
                0,
                calculatedTotal,
                stockId,
                null,
                actorUsername,
                stock.firm || 'Internal',
                now(),
                now(),
                0,
                req.user.firm_id
            ]
        });

        let newQty = (stock.qty || 0) + Math.abs(qty);
        
        if (type === 'PURCHASE') {
            newQty = (stock.qty || 0) - Math.abs(qty);
        }

        await turso.execute({
            sql: `
                UPDATE stocks 
                SET qty = ?, user = ?, updated_at = ?
                WHERE id = ? AND firm_id = ?
            `,
            args: [
                newQty,
                actorUsername,
                now(),
                stockId,
                req.user.firm_id
            ]
        });

        const qtyCheck = await turso.execute({
            sql: 'SELECT qty FROM stocks WHERE id = ? AND firm_id = ?',
            args: [stockId, req.user.firm_id]
        });

        res.json({ 
            message: 'Stock movement recorded successfully', 
            movementId: Number(movementResult.lastInsertRowid),
            newQuantity: normalizeRow(qtyCheck.rows[0] || {}).qty || newQty
        });
    } catch (err) {
        console.error('Error creating stock movement:', err);
        res.status(500).json({ error: 'Failed to record stock movement: ' + err.message });
    }
};

exports.cancelBill = async (req, res) => {
    const { id } = req.params;
    const { cancellation_reason, action } = req.body;
    const status = action === 'delete' ? 'DELETED' : 'CANCELLED';

    const actorUsername = getActorUsername(req);
    if (!actorUsername) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.user || !req.user.firm_id) {
        return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    try {
        const billQuery = await turso.execute({
            sql: 'SELECT * FROM bills WHERE id = ? AND firm_id = ?',
            args: [id, req.user.firm_id]
        });
        const bill = normalizeRow(billQuery.rows[0]);
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found or does not belong to your firm' });
        }

        if (bill.status !== 'ACTIVE') {
            return res.status(400).json({ error: `Bill is already ${bill.status}` });
        }

        const itemsQuery = await turso.execute({
            sql: 'SELECT * FROM stock_reg WHERE bill_id = ? AND firm_id = ?',
            args: [id, req.user.firm_id]
        });
        const items = normalizeRows(itemsQuery.rows);

        for (const item of items) {
            const stockQuery = await turso.execute({
                sql: 'SELECT * FROM stocks WHERE id = ? AND firm_id = ?',
                args: [item.stock_id, req.user.firm_id]
            });
            const stockRecord = stockQuery.rows[0];
            if (!stockRecord) {
                console.warn(`Stock record not found for item ${item.item} (ID: ${item.stock_id}) during cancellation. Skipping stock restoration for this item.`);
                continue;
            }

            let batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
            
            let batchIndex = -1;
            if (item.batch === null || item.batch === undefined || item.batch === '') {
                batchIndex = batches.findIndex(b => b.batch === null || b.batch === undefined || b.batch === '');
            } else {
                batchIndex = batches.findIndex(b => b.batch === item.batch);
            }

            if (batchIndex !== -1) {
                batches[batchIndex].qty += item.qty;
                const newTotalQty = batches.reduce((sum, b) => sum + b.qty, 0);
                
                await turso.execute({
                    sql: `
                        UPDATE stocks 
                        SET qty = ?, batches = ?, user = ?, updated_at = ?
                        WHERE id = ? AND firm_id = ?
                    `,
                    args: [
                        newTotalQty,
                        JSON.stringify(batches),
                        actorUsername,
                        now(),
                        item.stock_id,
                        req.user.firm_id
                    ]
                });
            }
        }

        await turso.execute({
            sql: 'DELETE FROM ledger WHERE voucher_id = ? AND voucher_type = ? AND firm_id = ?',
            args: [id, 'SALES', req.user.firm_id]
        });

        await turso.execute({
            sql: `
                UPDATE bills SET 
                    status = ?, 
                    cancellation_reason = ?, 
                    cancelled_at = ?, 
                    cancelled_by = ?,
                    updated_at = ?
                WHERE id = ? AND firm_id = ?
            `,
            args: [
                status,
                cancellation_reason || `Bill ${status.toLowerCase()} by user`,
                now(),
                req.user.id,
                now(),
                id,
                req.user.firm_id
            ]
        });

        res.json({ message: `Bill ${status.toLowerCase()} successfully` });
    } catch (err) {
        console.error("Cancellation Error:", err.message);
        res.status(500).json({ error: "Failed to cancel bill: " + err.message });
    }
};

exports.getPartyBalance = async (req, res) => {
    try {
        const { partyId } = req.params;
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const partyQuery = await turso.execute({
            sql: 'SELECT * FROM parties WHERE id = ? AND firm_id = ?',
            args: [partyId, req.user.firm_id]
        });
        const party = normalizeRow(partyQuery.rows[0]);
        
        if (!party) {
            return res.status(404).json({ error: 'Party not found or does not belong to your firm' });
        }
        
        const balanceQuery = `
            SELECT 
                SUM(debit_amount) as total_debit,
                SUM(credit_amount) as total_credit,
                (SUM(credit_amount) - SUM(debit_amount)) as balance
            FROM ledger 
            WHERE firm_id = ? AND account_head = ?
        `;
        
        const balanceResult = await turso.execute({
            sql: balanceQuery,
            args: [req.user.firm_id, party.firm]
        });
        const balanceRow = normalizeRow(balanceResult.rows[0] || {});
        const balance = balanceRow.balance || 0;
        
        res.json({
            partyId: party.id,
            partyName: party.firm,
            balance: balance,
            balanceFormatted: new Intl.NumberFormat('en-IN', { 
                style: 'currency', 
                currency: 'INR' 
            }).format(Math.abs(balance)),
            balanceType: balance >= 0 ? 'Credit' : 'Debit'
        });
    } catch (err) {
        console.error('Error fetching party balance:', err);
        res.status(500).json({ error: err.message });
    }
};
