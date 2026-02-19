const turso = require('../../../../config/turso');
const slsController = require('../sls/inventory');
const {
    getNextBillNumber,
    getCurrentFinancialYear,
    getNextBillNumberPreview,
    getCurrentSequence
} = require('../../../../utils/billNumberGenerator');

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

// Shared endpoints - reuse existing inventory controllers
exports.getAllStocks = slsController.getAllStocks;
exports.createStock = slsController.createStock;
exports.updateStock = slsController.updateStock;
exports.deleteStock = slsController.deleteStock;
exports.getStockBatches = slsController.getStockBatches;

exports.getAllParties = slsController.getAllParties;
exports.createParty = slsController.createParty;
exports.getPartyBalance = slsController.getPartyBalance;
exports.getPartyItemHistory = slsController.getPartyItemHistory;

exports.getOtherChargesTypes = slsController.getOtherChargesTypes;
exports.lookupGST = slsController.lookupGST;

exports.getStockMovements = slsController.getStockMovements;
exports.getStockMovementsByStock = slsController.getStockMovementsByStock;
exports.createStockMovement = slsController.createStockMovement;

exports.getCurrentUserFirmName = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const firmQuery = await turso.execute({
            sql: 'SELECT name, address FROM firms WHERE id = ?',
            args: [req.user.firm_id]
        });

        const firm = firmQuery.rows && firmQuery.rows[0] ? normalizeRow(firmQuery.rows[0]) : null;
        if (!firm) {
            return res.json({ firmName: '', address: '' });
        }

        return res.json({
            firmName: firm.name || '',
            address: firm.address || ''
        });
    } catch (error) {
        console.error('Error fetching firm name:', error);
        return res.status(500).json({ error: error.message });
    }
};

exports.getAllDeliveryNotes = async (req, res) => {
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
                WHERE b.firm_id = ? AND b.btype = 'DELIVERY_NOTE'
                ORDER BY b.created_at DESC
            `,
            args: [req.user.firm_id]
        });

        const bills = normalizeRows(billsQuery.rows);
        return res.json(bills);
    } catch (error) {
        console.error('Error fetching delivery notes:', error);
        return res.status(500).json({ error: error.message });
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

        res.json({
            nextBillNo: nextBillNo,
            nextSequence: seqInfo.next_sequence,
            financialYear: financialYear,
            currentSequence: seqInfo.current_sequence,
            format: 'F{FIRM_ID}-{SEQUENCE:4d}/{FINANCIAL_YEAR}',
            note: 'This is for display only, actual number generated when bill is saved'
        });
    } catch (error) {
        console.error('[DLN_GET_NEXT_BILL_INFO] Error:', error.message);
        res.status(500).json({ error: `Failed to get bill number info: ${error.message}` });
    }
};

exports.getAllBills = exports.getAllDeliveryNotes;

exports.getBillById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
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
                WHERE b.id = ? AND b.firm_id = ? AND b.btype = 'DELIVERY_NOTE'
            `,
            args: [id, req.user.firm_id]
        });

        let bill = billQuery.rows && billQuery.rows[0] ? normalizeRow(billQuery.rows[0]) : null;
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found or does not belong to your firm' });
        }
        
        // Add consignee information to the bill object
        if (bill) {
            bill.consignee = {
                name: bill.consignee_name,
                gstin: bill.consignee_gstin,
                address: bill.consignee_address,
                state: bill.consignee_state,
                pin: bill.consignee_pin,
                stateCode: bill.consignee_state_code
            };
        }

        if (bill.oth_chg_json) {
            try {
                bill.otherCharges = JSON.parse(bill.oth_chg_json);
            } catch (e) {
                bill.otherCharges = [];
            }
        } else {
            bill.otherCharges = [];
        }

        bill.reverseCharge = bill.reverse_charge || false;
        bill.cgst = bill.cgst || 0;
        bill.sgst = bill.sgst || 0;
        bill.igst = bill.igst || 0;

        const itemsQuery = await turso.execute({
            sql: 'SELECT *, item_narration FROM stock_reg WHERE bill_id = ? AND firm_id = ? ORDER BY created_at',
            args: [id, req.user.firm_id]
        });
        bill.items = normalizeRows(itemsQuery.rows);

        return res.json(bill);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.createBill = async (req, res) => {
    const { meta, party, cart, otherCharges, consignee } = req.body;

    const actorUsername = getActorUsername(req);
    if (!actorUsername) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.user || !req.user.firm_id) {
        return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    if (!cart || cart.length === 0) {
        return res.status(400).json({ error: 'Cart cannot be empty' });
    }

    const requestedBillNo = typeof meta.billNo === 'string' ? meta.billNo.trim() : '';
    if (requestedBillNo) {
        const existingBillNoQuery = await turso.execute({
            sql: 'SELECT id FROM bills WHERE bno = ? AND firm_id = ? LIMIT 1',
            args: [requestedBillNo, req.user.firm_id]
        });
        if (existingBillNoQuery.rows && existingBillNoQuery.rows[0]) {
            return res.status(400).json({ error: 'Bill number already exists. Please use a unique bill number.' });
        }
        meta.billNo = requestedBillNo;
    } else {
        meta.billNo = await getNextBillNumber(Number(req.user.firm_id));
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
        gstEnabled = true;
    }

    let gtot = 0;
    let totalTax = 0;

    cart.forEach(item => {
        const lineVal = item.qty * item.rate * (1 - (item.disc || 0) / 100);
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
        const billInsert = await turso.execute({
            sql: `
                INSERT INTO bills (
                    bno, bdate, supply, addr, gstin, state, pin, state_code,
                    gtot, ntot, rof, btype, usern, firm,
                    party_id, oth_chg_json, order_no, vehicle_no, dispatch_through, narration, created_at, updated_at, reverse_charge,
                    cgst, sgst, igst, firm_id,
                    consignee_name, consignee_gstin, consignee_address, consignee_state, consignee_pin, consignee_state_code
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?
                )
            `,
            args: [
                meta.billNo, meta.billDate, supplyState, party.addr || '', party.gstin || 'UNREGISTERED',
                party.state || '', party.pin || null, party.state_code || null,
                gtot, ntot, rof, 'DELIVERY_NOTE', actorUsername, party.firm,
                party.id || null, otherCharges && otherCharges.length > 0 ? JSON.stringify(otherCharges) : null,
                meta.referenceNo || null, meta.vehicleNo || null, meta.dispatchThrough || null, meta.narration || null,
                now(), now(), meta.reverseCharge ? 1 : 0,
                cgst, sgst, igst, req.user.firm_id,
                // Consignee details
                consignee?.name || null, consignee?.gstin || null, consignee?.address || null, 
                consignee?.state || null, consignee?.pin || null, consignee?.stateCode || null
            ]
        });

        const billId = Number(billInsert.lastInsertRowid);

        for (const item of cart) {
            const lineTotal = item.qty * item.rate * (1 - (item.disc || 0) / 100);

            const stockQuery = await turso.execute({
                sql: 'SELECT * FROM stocks WHERE id = ? AND firm_id = ?',
                args: [item.stockId, req.user.firm_id]
            });
            const stockRecord = stockQuery.rows && stockQuery.rows[0] ? normalizeRow(stockQuery.rows[0]) : null;
            if (!stockRecord) {
                throw new Error(`Stock record not found for ID: ${item.stockId} or does not belong to your firm`);
            }

            const batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
            let batchIndex = -1;
            if (item.batch) {
                batchIndex = batches.findIndex(b => b.batch === item.batch);
            } else {
                batchIndex = batches.findIndex(b => !b.batch);
            }
            if (batchIndex === -1) {
                throw new Error(`Batch ${item.batch} not found for item ${item.item}`);
            }

            batches[batchIndex].qty = (Number(batches[batchIndex].qty) || 0) - (Number(item.qty) || 0);
            if (batches[batchIndex].qty < 0) {
                throw new Error(`Insufficient quantity in batch ${item.batch} for item ${item.item}`);
            }

            const newTotalQty = batches.reduce((sum, b) => sum + (Number(b.qty) || 0), 0);

            await turso.execute({
                sql: `
                    UPDATE stocks
                    SET qty = ?, batches = ?, user = ?, updated_at = ?
                    WHERE id = ? AND firm_id = ?
                `,
                args: [newTotalQty, JSON.stringify(batches), actorUsername, now(), item.stockId, req.user.firm_id]
            });

            await turso.execute({
                sql: `
                    INSERT INTO stock_reg (
                        type, bno, bdate, supply, item, item_narration, batch, hsn,
                        qty, uom, rate, grate, disc, total,
                        stock_id, bill_id, user, firm, created_at, updated_at, qtyh, firm_id
                    ) VALUES (
                        'DELIVERY_NOTE', ?, ?, ?, ?, ?, ?, ?,
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

        return res.json({ message: 'Bill saved successfully', billId });
    } catch (err) {
        console.error('Transaction Error:', err);
        return res.status(500).json({ error: 'Failed to save bill: ' + err.message });
    }
};

exports.updateBill = async (req, res) => {
    const { meta, party, cart, otherCharges, consignee } = req.body;
    const { id } = req.params;

    const actorUsername = getActorUsername(req);
    if (!actorUsername) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.user || !req.user.firm_id) {
        return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    if (!cart || cart.length === 0) {
        return res.status(400).json({ error: 'Cart cannot be empty' });
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
        gstEnabled = true;
    }

    let gtot = 0;
    let totalTax = 0;

    cart.forEach(item => {
        const lineVal = item.qty * item.rate * (1 - (item.disc || 0) / 100);
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
        sql: 'SELECT * FROM bills WHERE id = ? AND firm_id = ? AND btype = ?',
        args: [id, req.user.firm_id, 'DELIVERY_NOTE']
    });
    const existingBill = existingBillQuery.rows && existingBillQuery.rows[0] ? normalizeRow(existingBillQuery.rows[0]) : null;
    if (!existingBill) {
        return res.status(404).json({ error: 'Bill not found or does not belong to your firm' });
    }

    if (meta.billNo && meta.billNo !== existingBill.bno) {
        return res.status(403).json({ error: 'Bill number cannot be changed. A bill is identified by its unique number.' });
    }
    meta.billNo = existingBill.bno;

    const existingItemsQuery = await turso.execute({
        sql: 'SELECT * FROM stock_reg WHERE bill_id = ? AND firm_id = ?',
        args: [id, req.user.firm_id]
    });
    const existingItems = normalizeRows(existingItemsQuery.rows);

    try {
        // Restore stock (add back previously delivered qty)
        for (const existingItem of existingItems) {
            const stockQuery = await turso.execute({
                sql: 'SELECT * FROM stocks WHERE id = ? AND firm_id = ?',
                args: [existingItem.stock_id, req.user.firm_id]
            });
            const stockRecord = stockQuery.rows && stockQuery.rows[0] ? normalizeRow(stockQuery.rows[0]) : null;
            if (!stockRecord) continue;

            const batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
            let batchIndex = -1;
            if (existingItem.batch) {
                batchIndex = batches.findIndex(b => b.batch === existingItem.batch);
            } else {
                batchIndex = batches.findIndex(b => !b.batch);
            }
            if (batchIndex === -1) {
                batches.push({ batch: existingItem.batch || null, qty: 0, rate: existingItem.rate, expiry: null, mrp: null });
                batchIndex = batches.length - 1;
            }

            batches[batchIndex].qty = (Number(batches[batchIndex].qty) || 0) + (Number(existingItem.qty) || 0);
            const newTotalQty = batches.reduce((sum, b) => sum + (Number(b.qty) || 0), 0);

            await turso.execute({
                sql: `
                    UPDATE stocks
                    SET qty = ?, batches = ?, user = ?, updated_at = ?
                    WHERE id = ? AND firm_id = ?
                `,
                args: [newTotalQty, JSON.stringify(batches), actorUsername, now(), existingItem.stock_id, req.user.firm_id]
            });
        }

        // Update bill header
        await turso.execute({
            sql: `
                UPDATE bills SET
                    bno = ?, bdate = ?, supply = ?, addr = ?, gstin = ?, state = ?, pin = ?, state_code = ?,
                    gtot = ?, ntot = ?, rof = ?, btype = ?, usern = ?, firm = ?,
                    party_id = ?, oth_chg_json = ?, order_no = ?, vehicle_no = ?, dispatch_through = ?, narration = ?,
                    updated_at = ?, reverse_charge = ?, cgst = ?, sgst = ?, igst = ?,
                    consignee_name = ?, consignee_gstin = ?, consignee_address = ?, consignee_state = ?, consignee_pin = ?, consignee_state_code = ?
                WHERE id = ? AND firm_id = ?
            `,
            args: [
                meta.billNo, meta.billDate, supplyState, party.addr || '', party.gstin || 'UNREGISTERED',
                party.state || '', party.pin || null, party.state_code || null,
                gtot, ntot, rof, 'DELIVERY_NOTE', actorUsername, party.firm,
                party.id || null, otherCharges && otherCharges.length > 0 ? JSON.stringify(otherCharges) : null,
                meta.referenceNo || null, meta.vehicleNo || null, meta.dispatchThrough || null, meta.narration || null,
                now(), meta.reverseCharge ? 1 : 0,
                cgst, sgst, igst,
                // Consignee details
                consignee?.name || null, consignee?.gstin || null, consignee?.address || null, 
                consignee?.state || null, consignee?.pin || null, consignee?.stateCode || null,
                id, req.user.firm_id
            ]
        });

        await turso.execute({
            sql: 'DELETE FROM stock_reg WHERE bill_id = ? AND firm_id = ?',
            args: [id, req.user.firm_id]
        });

        // Apply new delivery note stock deduction
        for (const item of cart) {
            const lineTotal = item.qty * item.rate * (1 - (item.disc || 0) / 100);

            const stockQuery = await turso.execute({
                sql: 'SELECT * FROM stocks WHERE id = ? AND firm_id = ?',
                args: [item.stockId, req.user.firm_id]
            });
            const stockRecord = stockQuery.rows && stockQuery.rows[0] ? normalizeRow(stockQuery.rows[0]) : null;
            if (!stockRecord) {
                throw new Error(`Stock record not found for ID: ${item.stockId} or does not belong to your firm`);
            }

            const batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
            let batchIndex = -1;
            if (item.batch) {
                batchIndex = batches.findIndex(b => b.batch === item.batch);
            } else {
                batchIndex = batches.findIndex(b => !b.batch);
            }
            if (batchIndex === -1) {
                throw new Error(`Batch ${item.batch} not found for item ${item.item}`);
            }

            batches[batchIndex].qty = (Number(batches[batchIndex].qty) || 0) - (Number(item.qty) || 0);
            if (batches[batchIndex].qty < 0) {
                throw new Error(`Insufficient quantity in batch ${item.batch} for item ${item.item}`);
            }

            const newTotalQty = batches.reduce((sum, b) => sum + (Number(b.qty) || 0), 0);

            await turso.execute({
                sql: `
                    UPDATE stocks
                    SET qty = ?, batches = ?, user = ?, updated_at = ?
                    WHERE id = ? AND firm_id = ?
                `,
                args: [newTotalQty, JSON.stringify(batches), actorUsername, now(), item.stockId, req.user.firm_id]
            });

            await turso.execute({
                sql: `
                    INSERT INTO stock_reg (
                        type, bno, bdate, supply, item, item_narration, batch, hsn,
                        qty, uom, rate, grate, disc, total,
                        stock_id, bill_id, user, firm, created_at, updated_at, qtyh, firm_id
                    ) VALUES (
                        'DELIVERY_NOTE', ?, ?, ?, ?, ?, ?, ?,
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

        return res.json({ message: 'Bill updated successfully', billId: Number(id) });
    } catch (err) {
        console.error('Transaction Error:', err);
        return res.status(500).json({ error: 'Failed to update bill: ' + err.message });
    }
};

exports.cancelBill = async (req, res) => {
    const { id } = req.params;

    const actorUsername = getActorUsername(req);
    if (!actorUsername) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.user || !req.user.firm_id) {
        return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    try {
        const billQuery = await turso.execute({
            sql: 'SELECT * FROM bills WHERE id = ? AND firm_id = ? AND btype = ?',
            args: [id, req.user.firm_id, 'DELIVERY_NOTE']
        });
        const bill = billQuery.rows && billQuery.rows[0] ? normalizeRow(billQuery.rows[0]) : null;
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

        // Restore stock (add back delivered quantities)
        for (const item of items) {
            const stockQuery = await turso.execute({
                sql: 'SELECT * FROM stocks WHERE id = ? AND firm_id = ?',
                args: [item.stock_id, req.user.firm_id]
            });
            const stockRecord = stockQuery.rows && stockQuery.rows[0] ? normalizeRow(stockQuery.rows[0]) : null;
            if (!stockRecord) continue;

            const batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
            let batchIndex = -1;
            if (item.batch) {
                batchIndex = batches.findIndex(b => b.batch === item.batch);
            } else {
                batchIndex = batches.findIndex(b => !b.batch);
            }
            if (batchIndex === -1) {
                batches.push({ batch: item.batch || null, qty: 0, rate: item.rate, expiry: null, mrp: null });
                batchIndex = batches.length - 1;
            }

            batches[batchIndex].qty = (Number(batches[batchIndex].qty) || 0) + (Number(item.qty) || 0);
            const newTotalQty = batches.reduce((sum, b) => sum + (Number(b.qty) || 0), 0);

            await turso.execute({
                sql: `
                    UPDATE stocks
                    SET qty = ?, batches = ?, user = ?, updated_at = ?
                    WHERE id = ? AND firm_id = ?
                `,
                args: [newTotalQty, JSON.stringify(batches), actorUsername, now(), item.stock_id, req.user.firm_id]
            });
        }

        await turso.execute({
            sql: `
                UPDATE bills
                SET status = 'CANCELLED', cancelled_at = ?, cancellation_reason = ?, updated_at = ?
                WHERE id = ? AND firm_id = ?
            `,
            args: [now(), 'Cancelled', now(), id, req.user.firm_id]
        });

        return res.json({ message: 'Bill cancelled successfully', billId: Number(id) });
    } catch (error) {
        console.error('Error cancelling delivery note:', error);
        return res.status(500).json({ error: error.message });
    }
};
