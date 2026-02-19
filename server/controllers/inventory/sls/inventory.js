import { Stock, Party, Bill, StockReg, Ledger, Settings, FirmSettings, Firm, db } from '../../../utils/db.js';
import { getNextBillNumber, previewNextBillNumber } from '../../../utils/billNumberGenerator.js';

// Helper to get current ISO time
const now = () => new Date().toISOString();

const getActorUsername = (req) => (req && req.user && req.user.username ? req.user.username : null);

// --- STOCKS API ---

export const getAllStocks = (req, res) => {
    try {
        // Check if user has firm access
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const stocks = Stock.getByFirm.all(req.user.firm_id);
        
        // Parse batches JSON for each stock
        const stocksWithBatches = stocks.map(stock => ({
            ...stock,
            batches: stock.batches ? JSON.parse(stock.batches) : []
        }));
        
        res.json(stocksWithBatches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getPartyItemHistory = (req, res) => {
    try {
        const partyId = parseInt(req.query.partyId);
        const stockId = parseInt(req.query.stockId);
        const limit = req.query.limit === 'all' ? null : Math.min(parseInt(req.query.limit) || 10, 500);

        if (!partyId || !stockId) {
            return res.status(400).json({ error: 'partyId and stockId are required' });
        }

        // Use raw SQL for complex join query
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
              AND sr.type = 'SALE'
            ORDER BY COALESCE(sr.bdate, b.bdate, sr.created_at) DESC
        `;
        
        const params = [partyId, stockId];
        
        if (limit !== null) {
            query += ' LIMIT ?';
            params.push(limit);
        }

        const rows = db.prepare(query).all(...params);
        
        res.json({ partyId, stockId, rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const createStock = (req, res) => {
    try {
        console.log('[CREATE_STOCK] User:', req.user);
        console.log('[CREATE_STOCK] User firm_id:', req.user?.firm_id);
        
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
                // ignore JSON parse issues
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
        
        // Check if user has firm access
        if (!req.user || !req.user.firm_id) {
            console.error('[CREATE_STOCK] User not associated with firm:', req.user);
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        // Check if item already exists in the same firm
        const existingStock = Stock.getByItem.get(req.user.firm_id, item);
        
        if (existingStock) {
            // Item exists in this firm, update batches JSON
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

            // Check if batch already exists
            const existingBatchIndex = existingBatches.findIndex(b => b.batch === batch);

            if (existingBatchIndex !== -1) {
                // Update existing batch
                existingBatches[existingBatchIndex].qty += parseFloat(qty);
                if (mrp !== undefined && mrp !== null && mrp !== '') existingBatches[existingBatchIndex].mrp = parseFloat(mrp);
                if (expiryDate) existingBatches[existingBatchIndex].expiry = expiryDate;
                if (rate !== undefined && rate !== null && rate !== '') existingBatches[existingBatchIndex].rate = parseFloat(rate);
            } else {
                // Add new batch
                existingBatches.push({
                    batch: batch || null,
                    qty: parseFloat(qty),
                    rate: parseFloat(rate),
                    expiry: expiryDate || null,
                    mrp: mrp ? parseFloat(mrp) : null
                });
            }

            // Calculate new total quantity
            const newTotalQty = existingBatches.reduce((sum, b) => sum + b.qty, 0);
            const newTotal = newTotalQty * parseFloat(rate);
            
            // Update the stock record
            Stock.update.run(
                item,
                pno || null,
                oem || null,
                hsn,
                newTotalQty,
                uom,
                parseFloat(rate),
                parseFloat(grate),
                newTotal,
                mrp ? parseFloat(mrp) : null,
                JSON.stringify(existingBatches),
                actorUsername,
                existingStock.id,
                req.user.firm_id
            );
            
            res.json({ id: existingStock.id, message: 'Stock batch updated successfully' });
        } else {
            // Item doesn't exist in this firm, create new record with batch
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

            const firmId = Number(req.user.firm_id); 

        // 1. Create a clean object mapping specifically to your @parameters in db.js
        const stockData = {
            firm_id: firmId,
            item: item,
            pno: pno || null,
            oem: oem || null,
            hsn: hsn,
            qty: parseFloat(qty) || 0,
            uom: uom || 'PCS',
            rate: parseFloat(rate) || 0,
            grate: parseFloat(grate) || 0,
            total: (parseFloat(qty) || 0) * (parseFloat(rate) || 0),
            mrp: mrp ? parseFloat(mrp) : null,
            batches: JSON.stringify(batchesToStore), // Ensure this is stringified
            user: actorUsername
        };

            const stockParams = [
                req.user.firm_id,           // firm_id
                item,                       // item
                pno || null,                // pno
                oem || null,                // oem
                hsn,                        // hsn
                parseFloat(qty),            // qty
                uom,                        // uom
                parseFloat(rate),           // rate
                parseFloat(grate),          // grate
                total,                      // total
                mrp ? parseFloat(mrp) : null, // mrp
                JSON.stringify(batchesToStore), // batches
                actorUsername               // user
            ];


            const result = Stock.create.run(stockParams);

            console.log('[CREATE_STOCK] Stock created successfully:', result);
            res.json({ id: result.lastInsertRowid, message: 'Stock added successfully' });
        }
    } catch (err) {
        console.error('[CREATE_STOCK] Error:', err.message);
        console.error('[CREATE_STOCK] Error details:', err);
        res.status(400).json({ error: err.message });
    }
};

export const updateStock = (req, res) => {
    try {
        const { id } = req.params;
        let { item, pno, batch, oem, hsn, qty, uom, rate, grate, mrp, expiryDate, batches: incomingBatches } = req.body;

        const actorUsername = getActorUsername(req);
        if (!actorUsername) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Check if user has firm access
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        // Get the current stock record
        const currentStock = Stock.getById.get(id, req.user.firm_id);
        if (!currentStock) {
            return res.status(404).json({ error: 'Stock not found or does not belong to your firm' });
        }
        
        // Parse existing batches
        let batches = currentStock.batches ? JSON.parse(currentStock.batches) : [];

        // If UI sent batches JSON (new batch system), prefer it
        if (incomingBatches) {
            try {
                const parsed = Array.isArray(incomingBatches) ? incomingBatches : JSON.parse(incomingBatches);
                if (Array.isArray(parsed)) {
                    batches = parsed;
                }
            } catch (e) {
                // ignore parse errors
            }

            // Derive convenience fields when missing
            const b0 = Array.isArray(batches) && batches.length > 0 ? (batches[0] || {}) : null;
            if (b0) {
                if (!batch && (b0.batch !== undefined)) batch = b0.batch;
                if (!qty && (b0.qty !== undefined)) qty = b0.qty;
                if (!rate && (b0.rate !== undefined)) rate = b0.rate;
                if (!mrp && (b0.mrp !== undefined)) mrp = b0.mrp;
                if (!expiryDate && (b0.expiry !== undefined)) expiryDate = b0.expiry;
            }
        }

        // If batch is specified, update that specific batch
        if (!incomingBatches && batch) {
            const batchIndex = batches.findIndex(b => b.batch === batch);
            if (batchIndex !== -1) {
                // Update existing batch
                batches[batchIndex].qty = parseFloat(qty);
                if (rate) batches[batchIndex].rate = parseFloat(rate);
                if (expiryDate) batches[batchIndex].expiry = expiryDate;
                if (mrp) batches[batchIndex].mrp = parseFloat(mrp);
            } else {
                // If batch doesn't exist in the array, add it
                batches.push({
                    batch: batch,
                    qty: parseFloat(qty),
                    rate: parseFloat(rate),
                    expiry: expiryDate || null,
                    mrp: mrp ? parseFloat(mrp) : null
                });
            }
        } else if (!incomingBatches) {
            // If no batch specified, update the first batch or add as non-batched
            if (batches.length > 0) {
                batches[0].qty = parseFloat(qty);
                if (rate) batches[0].rate = parseFloat(rate);
                if (expiryDate) batches[0].expiry = expiryDate;
                if (mrp) batches[0].mrp = parseFloat(mrp);
            } else {
                // Add as non-batched entry
                batches.push({
                    batch: null,
                    qty: parseFloat(qty),
                    rate: parseFloat(rate),
                    expiry: expiryDate || null,
                    mrp: mrp ? parseFloat(mrp) : null
                });
            }
        }
        
        // Calculate new total quantity
        const newTotalQty = batches.reduce((sum, b) => sum + b.qty, 0);
        const effectiveRate = parseFloat(rate || currentStock.rate || 0);
        const newTotal = newTotalQty * effectiveRate;
        
        Stock.update.run(
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
            id,
            req.user.firm_id
        );

        res.json({ message: 'Stock updated successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

export const deleteStock = (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if user has firm access
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        // First, check if the stock exists and belongs to the user's firm
        const existingStock = Stock.getById.get(id, req.user.firm_id);
        
        if (!existingStock) {
            return res.status(404).json({ error: 'Stock not found or does not belong to your firm' });
        }
        
        // Perform the deletion
        const result = Stock.delete.run(id, req.user.firm_id);
        
        // For Turso compatibility, we rely on the existence check above
        // rather than result.changes which may not be reliable in Turso
        res.json({ message: 'Stock deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- PARTIES API ---

export const getAllParties = (req, res) => {
    try {
        // Check if user has firm access
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const parties = Party.getByFirm.all(req.user.firm_id);
        res.json(parties);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const createParty = (req, res) => {
    try {
        const { firm, gstin, contact, state, state_code, addr, pin, pan } = req.body;

        const actorUsername = getActorUsername(req);
        if (!actorUsername) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Check if user has firm access
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }
        
        const result = Party.create.run(
            req.user.firm_id,
            firm,
            gstin || 'UNREGISTERED',
            contact || null,
            state || '',
            state_code || null,
            addr || null,
            pin || null,
            pan || null,
            actorUsername,
            state || ''
        );

        // Fetch and return the created party with all fields
        const newParty = Party.getById.get(result.lastInsertRowid, req.user.firm_id);
        
        res.json({ 
            id: newParty.id,
            firm: newParty.firm,
            gstin: newParty.gstin,
            contact: newParty.contact,
            state: newParty.state,
            state_code: newParty.state_code,
            addr: newParty.addr,
            pin: newParty.pin,
            pan: newParty.pan,
            message: 'Party created successfully' 
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};


// --- BILLS API (Sales Transaction) ---

export const createBill = async (req, res) => {
    // Expects: { meta: {}, party: {}, cart: [], otherCharges: [], consignee: {}, user: '' }
    const { meta, party, cart, otherCharges, consignee } = req.body; 

    const actorUsername = getActorUsername(req);
    if (!actorUsername) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has firm access
    if (!req.user || !req.user.firm_id) {
        return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    if (!cart || cart.length === 0) {
        return res.status(400).json({ error: "Cart cannot be empty" });
    }
    
    // Generate bill number server-side only when bill is actually saved
    let billNo;
    try {
        billNo = await getNextBillNumber(req.user.firm_id);
        console.log(`[CREATE_BILL] Generated bill number: ${billNo}`);
    } catch (error) {
        console.error(`[CREATE_BILL] Failed to generate bill number:`, error.message);
        return res.status(500).json({ error: `Failed to generate bill number: ${error.message}` });
    }
    
    // Set the generated bill number
    meta.billNo = billNo;

    // Check GST status to determine if tax calculations should be performed
    let gstEnabled = true;
    try {
        const firmGstSetting = FirmSettings.getByFirmAndKey.get(req.user.firm_id, 'gst_enabled');
        
        if (firmGstSetting) {
            // Use firm-specific setting
            gstEnabled = firmGstSetting.setting_value === 'true';
        } else {
            // Fall back to global setting if no firm-specific setting exists
            const gstSetting = Settings.getByKey.get('gst_enabled');
            gstEnabled = gstSetting ? gstSetting.setting_value === 'true' : true; // Default to true if not found
        }
    } catch (error) {
        // If there's an error fetching GST settings, default to enabled
        console.warn('Error fetching GST settings, defaulting to enabled:', error.message);
        gstEnabled = true;
    }

    // 1. Calculate Header Totals
    let gtot = 0; // Taxable Total (items + other charges)
    let totalTax = 0; // Tax on items only

    cart.forEach(item => {
        const lineVal = item.qty * item.rate * (1 - (item.disc || 0)/100);
        if (gstEnabled) {
            const lineTax = lineVal * (item.grate / 100);
            totalTax += lineTax;
        }
        gtot += lineVal;
    });

    // Calculate other charges total and their GST
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
    
    // According to Indian GST Standards (when GST is enabled):
    // gtot = taxable value of items + other charges (total taxable amount)
    gtot = gtot + otherChargesTotal;
    
    // Calculate tax amounts for CGST/SGST or IGST based on supply type (only when GST is enabled)
    let cgst = 0, sgst = 0, igst = 0;
    
    if (gstEnabled && meta.billType === 'intra-state') {
        cgst = (totalTax / 2) + (otherChargesGstTotal / 2); // CGST on items + other charges
        sgst = (totalTax / 2) + (otherChargesGstTotal / 2); // SGST on items + other charges
    } else if (gstEnabled) {
        igst = totalTax + otherChargesGstTotal; // IGST on items + other charges
    }
    
    // For reverse charge, tax is calculated but not added to ntot (grand total)
    // The tax liability shifts to the recipient
    // When GST is disabled, tax values are 0, so ntot = gtot only
    let ntot = gtot + (meta.reverseCharge ? 0 : totalTax + otherChargesGstTotal); // Grand Total
    const roundedNtot = Math.round(ntot);
    const rof = (roundedNtot - ntot).toFixed(2);
    ntot = roundedNtot;
    try {
        // Get firm name for the bill
        const firmRecord = Firm.getById.get(req.user.firm_id);
        const firmName = firmRecord ? firmRecord.name : '';

        // A. Insert Bill Header
        const billResult = Bill.create.run(
            req.user.firm_id,
            meta.billNo,
            meta.billDate,
            party.firm,
            party.addr || '',
            party.gstin || 'UNREGISTERED',
            party.state || '',
            party.pin || null,
            party.state_code || null,
            gtot,
            ntot,
            rof,
            meta.billType ? meta.billType.toUpperCase() : 'SALES',
            actorUsername,
            firmName,
            party.id || null,
            otherCharges && otherCharges.length > 0 ? JSON.stringify(otherCharges) : null,
            meta.referenceNo || null,
            meta.vehicleNo || null,
            meta.dispatchThrough || null,
            meta.narration || null,
            meta.reverseCharge || 0,
            cgst,
            sgst,
            igst,
            consignee?.name || null,
            consignee?.gstin || null,
            consignee?.address || null,
            consignee?.state || null,
            consignee?.pin || null,
            consignee?.stateCode || null
        );

        const billId = billResult.lastInsertRowid;

        // Process each item in the cart
        for (const item of cart) {
            const lineTotal = item.qty * item.rate * (1 - (item.disc || 0)/100);

            // Get the stock record to update the specific batch
            const stockRecord = Stock.getById.get(item.stockId, req.user.firm_id);
            if (!stockRecord) {
                throw new Error(`Stock record not found for ID: ${item.stockId} or does not belong to your firm`);
            }
            
            // Verify firm_id matches (multi-firm safety check)
            if (stockRecord.firm_id !== req.user.firm_id) {
                throw new Error(`Stock does not belong to your firm`);
            }
            
            // Parse existing batches
            let batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
            
            // Find the specific batch to deduct from
            // If item.batchIndex is provided, use it (preferred for accuracy)
            // Otherwise, match by batch value
            let batchIndex = -1;
            
            if (item.batchIndex !== undefined && item.batchIndex !== null) {
                // Use the batch index if provided (most accurate)
                batchIndex = parseInt(item.batchIndex);
                if (batchIndex < 0 || batchIndex >= batches.length) {
                    throw new Error(`Invalid batch index ${item.batchIndex} for item ${item.item}`);
                }
            } else {
                // Match by batch value
                // For null/empty batches, match the first one with null/empty value
                if (item.batch === null || item.batch === undefined || item.batch === '') {
                    // Find first batch with null/empty value
                    batchIndex = batches.findIndex(b => !b.batch || b.batch === '');
                } else {
                    // Find batch with matching batch value
                    batchIndex = batches.findIndex(b => b.batch === item.batch);
                }
            }
            
            if (batchIndex === -1) {
                const batchDisplay = item.batch || '(No Batch)';
                throw new Error(`Batch "${batchDisplay}" not found for item ${item.item}`);
            }
            
            // Verify sufficient quantity in the batch
            const requestedQty = parseFloat(item.qty);
            if (batches[batchIndex].qty < requestedQty) {
                const batchDisplay = item.batch || '(No Batch)';
                throw new Error(`Insufficient quantity in batch "${batchDisplay}". Available: ${batches[batchIndex].qty}, Requested: ${requestedQty}`);
            }
            
            // Update the specific batch quantity
            batches[batchIndex].qty -= requestedQty;
            
            // Calculate new total quantity
            const newTotalQty = batches.reduce((sum, b) => sum + b.qty, 0);
            
            // Update the stock record with new batches and total quantity
            Stock.update.run(
                stockRecord.item,
                stockRecord.pno,
                stockRecord.oem,
                stockRecord.hsn,
                newTotalQty,
                stockRecord.uom,
                stockRecord.rate,
                stockRecord.grate,
                newTotalQty * stockRecord.rate,
                stockRecord.mrp,
                JSON.stringify(batches),
                actorUsername,
                item.stockId,
                req.user.firm_id
            );

            // Insert the stock movement record
            StockReg.create.run(
                req.user.firm_id,
                'SALE',
                meta.billNo,
                meta.billDate,
                party.firm,
                item.item,
                item.narration || null,
                item.batch || null,
                item.hsn,
                item.qty,
                item.uom,
                item.rate,
                item.grate,
                item.disc || 0,
                lineTotal,
                item.stockId,
                billId,
                actorUsername,
                party.firm,
                0
            );
        }

        // D. Ledger Postings
        const ledgerBase = {
            voucher_id: billId,
            voucher_type: 'SALES',
            voucher_no: meta.billNo,
            bill_id: billId,
            transaction_date: meta.billDate,
            created_by: actorUsername,
            firm_id: req.user.firm_id,
            created_at: now(),
            updated_at: now()
        };

        // 1. Party DR Post
        Ledger.create.run(
            ledgerBase.firm_id,
            ledgerBase.voucher_id,
            ledgerBase.voucher_type,
            ledgerBase.voucher_no,
            party.firm,
            'DEBTOR',
            ntot,
            0,
            `Sales Bill No: ${meta.billNo}`,
            ledgerBase.bill_id,
            party.id || null,
            null,
            null,
            ledgerBase.transaction_date,
            ledgerBase.created_by
        );

        // 2. GST Posts
        if (cgst > 0) {
            Ledger.create.run(
                ledgerBase.firm_id,
                ledgerBase.voucher_id,
                ledgerBase.voucher_type,
                ledgerBase.voucher_no,
                'CGST Payable',
                'LIABILITY',
                0,
                cgst,
                `CGST on Sales Bill No: ${meta.billNo}`,
                ledgerBase.bill_id,
                null,
                'CGST',
                9,
                ledgerBase.transaction_date,
                ledgerBase.created_by
            );
        }
        if (sgst > 0) {
            Ledger.create.run(
                ledgerBase.firm_id,
                ledgerBase.voucher_id,
                ledgerBase.voucher_type,
                ledgerBase.voucher_no,
                'SGST Payable',
                'LIABILITY',
                0,
                sgst,
                `SGST on Sales Bill No: ${meta.billNo}`,
                ledgerBase.bill_id,
                null,
                'SGST',
                9,
                ledgerBase.transaction_date,
                ledgerBase.created_by
            );
        }
        if (igst > 0) {
            Ledger.create.run(
                ledgerBase.firm_id,
                ledgerBase.voucher_id,
                ledgerBase.voucher_type,
                ledgerBase.voucher_no,
                'IGST Payable',
                'LIABILITY',
                0,
                igst,
                `IGST on Sales Bill No: ${meta.billNo}`,
                ledgerBase.bill_id,
                null,
                'IGST',
                18,
                ledgerBase.transaction_date,
                ledgerBase.created_by
            );
        }

        // 3. Round Off Post
        if (Math.abs(parseFloat(rof)) > 0) {
            const rofVal = parseFloat(rof);
            Ledger.create.run(
                ledgerBase.firm_id,
                ledgerBase.voucher_id,
                ledgerBase.voucher_type,
                ledgerBase.voucher_no,
                'Round Off',
                'EXPENSE',
                rofVal > 0 ? rofVal : 0,
                rofVal < 0 ? Math.abs(rofVal) : 0,
                `Round Off on Sales Bill No: ${meta.billNo}`,
                ledgerBase.bill_id,
                null,
                null,
                null,
                ledgerBase.transaction_date,
                ledgerBase.created_by
            );
        }

        // 4. Other Charges Posts
        if (otherCharges && otherCharges.length > 0) {
            otherCharges.forEach(charge => {
                const chargeAmount = parseFloat(charge.amount) || 0;
                if (chargeAmount > 0) {
                    Ledger.create.run(
                        ledgerBase.firm_id,
                        ledgerBase.voucher_id,
                        ledgerBase.voucher_type,
                        ledgerBase.voucher_no,
                        charge.type || 'Other Charges',
                        'INCOME',
                        0,
                        chargeAmount,
                        `${charge.type} on Sales Bill No: ${meta.billNo}`,
                        ledgerBase.bill_id,
                        null,
                        null,
                        null,
                        ledgerBase.transaction_date,
                        ledgerBase.created_by
                    );
                }
            });
        }

        // 5. Sales Account Post (To balance the ledger)
        const taxableItemsTotal = cart.reduce((sum, item) => sum + (item.qty * item.rate * (1 - (item.disc || 0)/100)), 0);
        Ledger.create.run(
            ledgerBase.firm_id,
            ledgerBase.voucher_id,
            ledgerBase.voucher_type,
            ledgerBase.voucher_no,
            'Sales',
            'INCOME',
            0,
            taxableItemsTotal + otherChargesTotal,
            `Sales Bill No: ${meta.billNo}`,
            ledgerBase.bill_id,
            null,
            null,
            null,
            ledgerBase.transaction_date,
            ledgerBase.created_by
        );

        res.json({ id: billId, billNo: meta.billNo, message: 'Bill created successfully' });
    } catch (err) {
        console.error('Error creating bill:', err);
        res.status(400).json({ error: err.message });
    }
};


export const getBillById = (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const bill = Bill.getById.get(id, req.user.firm_id);
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        // Get bill items from stock_reg table
        const items = db.prepare('SELECT * FROM stock_reg WHERE bill_id = ? AND firm_id = ? ORDER BY created_at').all(id, req.user.firm_id);

        // Parse other charges JSON
        const otherCharges = bill.oth_chg_json ? JSON.parse(bill.oth_chg_json) : [];

        res.json({
            ...bill,
            items,
            otherCharges
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getAllBills = (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const bills = Bill.getByFirm.all(req.user.firm_id);

        // Parse other charges JSON for each bill
        const billsWithCharges = bills.map(bill => ({
            ...bill,
            otherCharges: bill.oth_chg_json ? JSON.parse(bill.oth_chg_json) : []
        }));

        res.json(billsWithCharges);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const updateBill = async (req, res) => {
    try {
        const { id } = req.params;
        const { meta, party, cart, otherCharges, consignee } = req.body;

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

        // Get the existing bill
        const existingBill = Bill.getById.get(id, req.user.firm_id);
        if (!existingBill) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        // Prevent bill number changes
        if (meta.billNo && meta.billNo !== existingBill.bno) {
            return res.status(400).json({ error: 'Bill number cannot be changed' });
        }

        // Get existing bill items to restore stock quantities
        const existingItems = db.prepare('SELECT * FROM stock_reg WHERE bill_id = ? AND firm_id = ?').all(id, req.user.firm_id);

        // Restore old stock quantities
        for (const existingItem of existingItems) {
            const stockRecord = Stock.getById.get(existingItem.stock_id, req.user.firm_id);
            if (stockRecord) {
                let batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
                
                // Find and update the batch - use same logic as createBill
                let batchIndex = -1;
                if (!existingItem.batch || existingItem.batch === '') {
                    // Find first batch with null/empty value
                    batchIndex = batches.findIndex(b => !b.batch || b.batch === '');
                } else {
                    batchIndex = batches.findIndex(b => b.batch === existingItem.batch);
                }
                
                if (batchIndex !== -1) {
                    batches[batchIndex].qty += existingItem.qty;
                } else {
                    // If batch not found, create it (shouldn't happen in normal flow)
                    batches.push({
                        batch: existingItem.batch || null,
                        qty: existingItem.qty,
                        rate: existingItem.rate,
                        expiry: null,
                        mrp: null
                    });
                }
                
                const newTotalQty = batches.reduce((sum, b) => sum + b.qty, 0);
                
                Stock.update.run(
                    stockRecord.item,
                    stockRecord.pno,
                    stockRecord.oem,
                    stockRecord.hsn,
                    newTotalQty,
                    stockRecord.uom,
                    stockRecord.rate,
                    stockRecord.grate,
                    newTotalQty * stockRecord.rate,
                    stockRecord.mrp,
                    JSON.stringify(batches),
                    actorUsername,
                    existingItem.stock_id,
                    req.user.firm_id
                );
            }
        }

        // Calculate new totals (same as createBill)
        let gstEnabled = true;
        try {
            const firmGstSetting = FirmSettings.getByFirmAndKey.get(req.user.firm_id, 'gst_enabled');
            gstEnabled = firmGstSetting ? firmGstSetting.setting_value === 'true' : true;
        } catch (error) {
            gstEnabled = true;
        }

        let gtot = 0, totalTax = 0;
        cart.forEach(item => {
            const lineVal = item.qty * item.rate * (1 - (item.disc || 0)/100);
            if (gstEnabled) {
                const lineTax = lineVal * (item.grate / 100);
                totalTax += lineTax;
            }
            gtot += lineVal;
        });

        let otherChargesTotal = 0, otherChargesGstTotal = 0;
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

        // Update Bill Header
        Bill.update.run(
            existingBill.bno,
            meta.billDate,
            party.state || 'Local',
            party.addr || '',
            party.gstin || 'UNREGISTERED',
            party.state || '',
            party.pin || null,
            party.state_code || null,
            gtot,
            ntot,
            rof,
            meta.billType ? meta.billType.toUpperCase() : 'SALES',
            actorUsername,
            party.firm,
            party.id || null,
            otherCharges && otherCharges.length > 0 ? JSON.stringify(otherCharges) : null,
            meta.referenceNo || null,
            meta.vehicleNo || null,
            meta.dispatchThrough || null,
            meta.narration || null,
            meta.reverseCharge || 0,
            cgst,
            sgst,
            igst,
            consignee?.name || null,
            consignee?.gstin || null,
            consignee?.address || null,
            consignee?.state || null,
            consignee?.pin || null,
            consignee?.stateCode || null,
            id,
            req.user.firm_id
        );

        // Delete existing stock_reg entries
        db.prepare('DELETE FROM stock_reg WHERE bill_id = ? AND firm_id = ?').run(id, req.user.firm_id);

        // Process new items
        for (const item of cart) {
            const lineTotal = item.qty * item.rate * (1 - (item.disc || 0)/100);

            const stockRecord = Stock.getById.get(item.stockId, req.user.firm_id);
            if (!stockRecord) {
                throw new Error(`Stock record not found for ID: ${item.stockId}`);
            }

            // Verify firm_id matches (multi-firm safety check)
            if (stockRecord.firm_id !== req.user.firm_id) {
                throw new Error(`Stock does not belong to your firm`);
            }

            let batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
            let batchIndex = -1;
            
            // Use same batch matching logic as createBill
            if (item.batchIndex !== undefined && item.batchIndex !== null) {
                // Use the batch index if provided (most accurate)
                batchIndex = parseInt(item.batchIndex);
                if (batchIndex < 0 || batchIndex >= batches.length) {
                    throw new Error(`Invalid batch index ${item.batchIndex} for item ${item.item}`);
                }
            } else {
                // Match by batch value
                if (!item.batch || item.batch === '') {
                    // Find first batch with null/empty value
                    batchIndex = batches.findIndex(b => !b.batch || b.batch === '');
                } else {
                    batchIndex = batches.findIndex(b => b.batch === item.batch);
                }
            }

            if (batchIndex === -1) {
                const batchDisplay = item.batch || '(No Batch)';
                throw new Error(`Batch "${batchDisplay}" not found for item ${item.item}`);
            }

            // Verify sufficient quantity in the batch
            const requestedQty = parseFloat(item.qty);
            if (batches[batchIndex].qty < requestedQty) {
                const batchDisplay = item.batch || '(No Batch)';
                throw new Error(`Insufficient quantity in batch "${batchDisplay}". Available: ${batches[batchIndex].qty}, Requested: ${requestedQty}`);
            }

            batches[batchIndex].qty -= requestedQty;

            const newTotalQty = batches.reduce((sum, b) => sum + b.qty, 0);

            Stock.update.run(
                stockRecord.item,
                stockRecord.pno,
                stockRecord.oem,
                stockRecord.hsn,
                newTotalQty,
                stockRecord.uom,
                stockRecord.rate,
                stockRecord.grate,
                newTotalQty * stockRecord.rate,
                stockRecord.mrp,
                JSON.stringify(batches),
                actorUsername,
                item.stockId,
                req.user.firm_id
            );

            StockReg.create.run(
                req.user.firm_id,
                'SALE',
                existingBill.bno,
                meta.billDate,
                party.state || 'Local',
                item.item,
                item.narration || null,
                item.batch || null,
                item.hsn,
                item.qty,
                item.uom,
                item.rate,
                item.grate,
                item.disc || 0,
                lineTotal,
                item.stockId,
                id,
                actorUsername,
                party.firm,
                0
            );
        }

        // Delete old ledger entries
        db.prepare('DELETE FROM ledger WHERE voucher_id = ? AND voucher_type = ? AND firm_id = ?').run(id, 'SALES', req.user.firm_id);

        // Create new ledger entries (same as createBill)
        const ledgerBase = {
            voucher_id: id,
            voucher_type: 'SALES',
            voucher_no: existingBill.bno,
            bill_id: id,
            transaction_date: meta.billDate,
            created_by: actorUsername,
            firm_id: req.user.firm_id,
            created_at: now(),
            updated_at: now()
        };

        // Party DR Post
        Ledger.create.run(
            ledgerBase.firm_id,
            ledgerBase.voucher_id,
            ledgerBase.voucher_type,
            ledgerBase.voucher_no,
            party.firm,
            'DEBTOR',
            ntot,
            0,
            `Sales Bill No: ${existingBill.bno}`,
            ledgerBase.bill_id,
            party.id || null,
            null,
            null,
            ledgerBase.transaction_date,
            ledgerBase.created_by
        );

        // GST Posts
        if (cgst > 0) {
            Ledger.create.run(
                ledgerBase.firm_id,
                ledgerBase.voucher_id,
                ledgerBase.voucher_type,
                ledgerBase.voucher_no,
                'CGST Payable',
                'LIABILITY',
                0,
                cgst,
                `CGST on Sales Bill No: ${existingBill.bno}`,
                ledgerBase.bill_id,
                null,
                'CGST',
                9,
                ledgerBase.transaction_date,
                ledgerBase.created_by
            );
        }
        if (sgst > 0) {
            Ledger.create.run(
                ledgerBase.firm_id,
                ledgerBase.voucher_id,
                ledgerBase.voucher_type,
                ledgerBase.voucher_no,
                'SGST Payable',
                'LIABILITY',
                0,
                sgst,
                `SGST on Sales Bill No: ${existingBill.bno}`,
                ledgerBase.bill_id,
                null,
                'SGST',
                9,
                ledgerBase.transaction_date,
                ledgerBase.created_by
            );
        }
        if (igst > 0) {
            Ledger.create.run(
                ledgerBase.firm_id,
                ledgerBase.voucher_id,
                ledgerBase.voucher_type,
                ledgerBase.voucher_no,
                'IGST Payable',
                'LIABILITY',
                0,
                igst,
                `IGST on Sales Bill No: ${existingBill.bno}`,
                ledgerBase.bill_id,
                null,
                'IGST',
                18,
                ledgerBase.transaction_date,
                ledgerBase.created_by
            );
        }

        // Sales Account Post
        const taxableItemsTotal = cart.reduce((sum, item) => sum + (item.qty * item.rate * (1 - (item.disc || 0)/100)), 0);
        Ledger.create.run(
            ledgerBase.firm_id,
            ledgerBase.voucher_id,
            ledgerBase.voucher_type,
            ledgerBase.voucher_no,
            'Sales',
            'INCOME',
            0,
            taxableItemsTotal + otherChargesTotal,
            `Sales Bill No: ${existingBill.bno}`,
            ledgerBase.bill_id,
            null,
            null,
            null,
            ledgerBase.transaction_date,
            ledgerBase.created_by
        );

        res.json({ message: 'Bill updated successfully' });
    } catch (err) {
        console.error('Error updating bill:', err);
        res.status(400).json({ error: err.message });
    }
};

export const cancelBill = (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const actorUsername = getActorUsername(req);
        if (!actorUsername) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const bill = Bill.getById.get(id, req.user.firm_id);
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        if (bill.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Bill is already cancelled' });
        }

        // Get bill items
        const items = db.prepare('SELECT * FROM stock_reg WHERE bill_id = ? AND firm_id = ?').all(id, req.user.firm_id);

        // Restore stock quantities
        for (const item of items) {
            const stockRecord = Stock.getById.get(item.stock_id, req.user.firm_id);
            if (stockRecord) {
                let batches = stockRecord.batches ? JSON.parse(stockRecord.batches) : [];
                const batchIndex = batches.findIndex(b => b.batch === item.batch);
                if (batchIndex !== -1) {
                    batches[batchIndex].qty += item.qty;
                } else {
                    batches.push({
                        batch: item.batch,
                        qty: item.qty,
                        rate: item.rate,
                        expiry: null,
                        mrp: null
                    });
                }
                const newTotalQty = batches.reduce((sum, b) => sum + b.qty, 0);

                Stock.update.run(
                    stockRecord.item,
                    stockRecord.pno,
                    stockRecord.oem,
                    stockRecord.hsn,
                    newTotalQty,
                    stockRecord.uom,
                    stockRecord.rate,
                    stockRecord.grate,
                    newTotalQty * stockRecord.rate,
                    stockRecord.mrp,
                    JSON.stringify(batches),
                    actorUsername,
                    item.stock_id,
                    req.user.firm_id
                );
            }
        }

        // Delete ledger entries
        db.prepare('DELETE FROM ledger WHERE voucher_id = ? AND voucher_type = ? AND firm_id = ?').run(id, 'SALES', req.user.firm_id);

        // Update bill status
        Bill.updateStatus.run(
            'CANCELLED',
            reason || null,
            now(),
            req.user.id,
            id,
            req.user.firm_id
        );

        res.json({ message: 'Bill cancelled successfully' });
    } catch (err) {
        console.error('Error cancelling bill:', err);
        res.status(500).json({ error: err.message });
    }
};


// --- STOCK MOVEMENTS API ---

export const getStockBatches = (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const stock = Stock.getById.get(id, req.user.firm_id);
        if (!stock) {
            return res.status(404).json({ error: 'Stock not found' });
        }

        const batches = stock.batches ? JSON.parse(stock.batches) : [];
        res.json({ id, item: stock.item, batches });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getStockMovements = (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const { type, batchFilter, searchTerm, page = 1, limit = 50, partyId, stockId } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let query = `
            SELECT sr.*, s.item as stock_item, b.bdate as bill_date, p.firm as party_name
            FROM stock_reg sr
            LEFT JOIN stocks s ON s.id = sr.stock_id
            LEFT JOIN bills b ON b.id = sr.bill_id
            LEFT JOIN parties p ON p.id = b.party_id
            WHERE sr.firm_id = ?
        `;
        
        const params = [req.user.firm_id];

        // Filter by party if provided
        if (partyId) {
            query += ` AND b.party_id = ?`;
            params.push(partyId);
        }

        // Filter by stock if provided
        if (stockId) {
            query += ` AND sr.stock_id = ?`;
            params.push(stockId);
        }

        if (type) {
            query += ` AND sr.type = ?`;
            params.push(type);
        }

        if (batchFilter) {
            query += ` AND sr.batch = ?`;
            params.push(batchFilter);
        }

        if (searchTerm) {
            query += ` AND (sr.item LIKE ? OR sr.bno LIKE ?)`;
            params.push(`%${searchTerm}%`, `%${searchTerm}%`);
        }

        query += ` ORDER BY sr.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const rows = db.prepare(query).all(...params);
        res.json({ page: parseInt(page), limit: parseInt(limit), rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getStockMovementsByStock = (req, res) => {
    try {
        const { stockId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const rows = db.prepare(`
            SELECT * FROM stock_reg 
            WHERE stock_id = ? AND firm_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(stockId, req.user.firm_id, parseInt(limit), offset);

        res.json({ stockId, page: parseInt(page), limit: parseInt(limit), rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const createStockMovement = (req, res) => {
    try {
        const { type, stockId, batch, qty, uom, rate, total, description, referenceNumber } = req.body;

        // Validate required fields
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

        const stock = Stock.getById.get(stockId, req.user.firm_id);
        if (!stock) {
            return res.status(404).json({ error: 'Stock not found or does not belong to your firm' });
        }

        // Calculate total if not provided
        const calculatedTotal = total || (qty * (rate || 0));

        // Insert the stock movement record
        StockReg.create.run(
            req.user.firm_id,
            type,
            referenceNumber || null,
            new Date().toISOString().split('T')[0],
            'INTERNAL',
            stock.item,
            description || null,
            batch || null,
            stock.hsn,
            Math.abs(parseFloat(qty)),
            uom,
            rate || 0,
            stock.grate || 0,
            0,
            calculatedTotal,
            stockId,
            null,
            actorUsername,
            stock.firm || 'Internal',
            0
        );

        // Update the stock quantity based on movement type
        let newQty = (stock.qty || 0) + Math.abs(parseFloat(qty));

        Stock.update.run(
            stock.item,
            stock.pno,
            stock.oem,
            stock.hsn,
            newQty,
            uom || stock.uom,
            rate || stock.rate,
            stock.grate,
            newQty * (rate || stock.rate),
            stock.mrp,
            stock.batches,
            actorUsername,
            stockId,
            req.user.firm_id
        );

        res.json({ message: `Stock movement (${type}) created successfully` });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// --- UTILITY ENDPOINTS ---

export const getOtherChargesTypes = (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        // Get all bills with other charges for this firm
        const rows = db.prepare(`
            SELECT oth_chg_json
            FROM bills
            WHERE firm_id = ? AND oth_chg_json IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 100
        `).all(req.user.firm_id);

        // Parse and extract unique charges
        const chargesMap = new Map();
        
        rows.forEach(row => {
            try {
                const charges = JSON.parse(row.oth_chg_json);
                if (Array.isArray(charges)) {
                    charges.forEach(charge => {
                        // Use charge name as key to avoid duplicates
                        const key = charge.name || charge.type;
                        if (key && !chargesMap.has(key)) {
                            chargesMap.set(key, {
                                name: charge.name || charge.type,
                                type: charge.type || 'other',
                                hsnSac: charge.hsnSac || '',
                                gstRate: charge.gstRate || 0
                            });
                        }
                    });
                }
            } catch (e) {
                console.warn('Error parsing oth_chg_json:', e);
            }
        });

        // Convert map to array
        const charges = Array.from(chargesMap.values());
        res.json({ charges });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getNextBillNumberPreviewEndpoint = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const billNo = previewNextBillNumber(req.user.firm_id, 'SALES');
        res.json({ nextBillNumber: billNo });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getCurrentUserFirmName = (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const firm = db.prepare('SELECT name, address FROM firms WHERE id = ?').get(req.user.firm_id);
        
        if (!firm) {
            return res.status(404).json({ error: 'Firm not found' });
        }

        res.json(firm);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getPartyBalance = (req, res) => {
    try {
        const { partyId } = req.params;

        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const result = db.prepare(`
            SELECT 
                SUM(CASE WHEN account_type = 'DEBTOR' THEN debit_amount ELSE 0 END) as total_debit,
                SUM(CASE WHEN account_type = 'DEBTOR' THEN credit_amount ELSE 0 END) as total_credit
            FROM ledger
            WHERE firm_id = ? AND party_id = ?
        `).get(req.user.firm_id, partyId);

        const balance = (result.total_debit || 0) - (result.total_credit || 0);
        res.json({ partyId, balance, debit: result.total_debit || 0, credit: result.total_credit || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const lookupGST = async (req, res) => {
    // Accept GSTIN from either query params (GET) or body (POST)
    const gstin = req.query.gstin || req.body?.gstin;

    if (!gstin) {
        return res.status(400).json({ error: 'GSTIN is required' });
    }

    // RAPID API CONFIG (Keep your secrets on the server!)
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
        
        // Pass the data back to your frontend
        res.json(data);

    } catch (error) {
        console.error('GST API Error:', error);
        res.status(500).json({ error: 'Failed to fetch GST details' });
    }
};
