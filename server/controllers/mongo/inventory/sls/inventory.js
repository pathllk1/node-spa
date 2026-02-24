import mongoose        from 'mongoose';
import ExcelJS         from 'exceljs';
import { Stock, Party, Bill, StockReg, Ledger, Settings, FirmSettings, Firm, BillSequence }
  from '../../../../models/index.js';

const now              = () => new Date().toISOString();
const getActorUsername = (req) => req?.user?.username ?? null;

/* ── GUARDS ──────────────────────────────────────────────────────────────── */

/**
 * Validate and return firm_id from JWT.
 * Returns the string if valid; writes 400 and returns null otherwise.
 */
function getFirmId(req, res, tag) {
  const raw = req.user?.firm_id;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    console.error(`[${tag}] Invalid firm_id:`, raw);
    res.status(400).json({ success: false, error: 'Invalid or missing firm ID' });
    return null;
  }
  return raw; // string — auto-cast by find/findOne; wrap for aggregate
}

/**
 * Validate a URL param / body field as a MongoDB ObjectId string.
 * Returns the string if valid; writes 400 and returns null otherwise.
 */
function validateObjectId(value, fieldName, res) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    res.status(400).json({ success: false, error: `Invalid ${fieldName}` });
    return null;
  }
  return String(value);
}

/* ── BILL NUMBER GENERATION ──────────────────────────────────────────────── */

async function getNextBillNumber(firmId, type = 'SALES') {
  const d     = new Date();
  const month = d.getMonth() + 1;
  const year  = d.getFullYear();
  const fy    = month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`;

  const prefixMap = { SALES: 'SI', PURCHASE: 'PI', JOURNAL: 'JV', PAYMENT: 'PV', RECEIPT: 'RV' };
  const prefix = prefixMap[type] ?? type.slice(0, 2);

  const seq = await BillSequence.findOneAndUpdate(
    { firm_id: firmId, financial_year: fy, voucher_type: type },
    { $inc: { last_number: 1 } },
    { new: true, upsert: true }
  );

  return `${prefix}/${fy}/${String(seq.last_number).padStart(4, '0')}`;
}

async function previewNextBillNumber(firmId, type = 'SALES') {
  const d     = new Date();
  const month = d.getMonth() + 1;
  const year  = d.getFullYear();
  const fy    = month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`;

  const prefixMap = { SALES: 'SI', PURCHASE: 'PI', JOURNAL: 'JV', PAYMENT: 'PV', RECEIPT: 'RV' };
  const prefix = prefixMap[type] ?? type.slice(0, 2);

  // Peek without incrementing
  const seq = await BillSequence.findOne({ firm_id: firmId, financial_year: fy, voucher_type: type }).lean();
  const nextNum = (seq?.last_number ?? 0) + 1;
  return `${prefix}/${fy}/${String(nextNum).padStart(4, '0')}`;
}

/* ── GST SETTING HELPER ──────────────────────────────────────────────────── */

async function isGstEnabled(firmId) {
  try {
    const firmSetting = await FirmSettings.findOne({ firm_id: firmId, setting_key: 'gst_enabled' }).lean();
    if (firmSetting) return firmSetting.setting_value === 'true';
    const globalSetting = await Settings.findOne({ setting_key: 'gst_enabled' }).lean();
    return globalSetting ? globalSetting.setting_value === 'true' : true;
  } catch {
    return true; // default to enabled on error
  }
}

/* ── LEDGER POSTING HELPER ───────────────────────────────────────────────── */

/**
 * Builds and inserts all ledger entries for a SALES bill.
 * Extracted as a helper so createBill and updateBill share identical posting logic.
 */
async function postSalesLedger({ firmId, billId, billNo, billDate, party, ntot, cgst, sgst, igst,
                                  rof, otherCharges, cart, actorUsername }) {
  const base = {
    firm_id:          firmId,
    voucher_id:       billId,            // ObjectId of the Bill document
    voucher_type:     'SALES',
    voucher_no:       billNo,
    bill_id:          billId,
    transaction_date: billDate,
    created_by:       actorUsername,
  };

  const docs = [];

  // 1. Party DR
  docs.push({
    ...base,
    account_head: party.firm,
    account_type: 'DEBTOR',
    debit_amount: ntot,
    credit_amount: 0,
    narration: `Sales Bill No: ${billNo}`,
    party_id: party.id || null,
    stock_id: null, stock_reg_id: null,
  });

  // 2. GST payable entries
  if (cgst > 0) docs.push({ ...base, account_head: 'CGST Payable', account_type: 'LIABILITY',
    debit_amount: 0, credit_amount: cgst, narration: `CGST on Sales Bill No: ${billNo}`,
    party_id: null, stock_id: null, stock_reg_id: null });
  if (sgst > 0) docs.push({ ...base, account_head: 'SGST Payable', account_type: 'LIABILITY',
    debit_amount: 0, credit_amount: sgst, narration: `SGST on Sales Bill No: ${billNo}`,
    party_id: null, stock_id: null, stock_reg_id: null });
  if (igst > 0) docs.push({ ...base, account_head: 'IGST Payable', account_type: 'LIABILITY',
    debit_amount: 0, credit_amount: igst, narration: `IGST on Sales Bill No: ${billNo}`,
    party_id: null, stock_id: null, stock_reg_id: null });

  // 3. Round-off
  if (Math.abs(parseFloat(rof)) > 0) {
    const rofVal = parseFloat(rof);
    docs.push({ ...base, account_head: 'Round Off', account_type: 'EXPENSE',
      debit_amount:  rofVal < 0 ? Math.abs(rofVal) : 0,
      credit_amount: rofVal > 0 ? rofVal : 0,
      narration: `Round Off on Sales Bill No: ${billNo}`,
      party_id: null, stock_id: null, stock_reg_id: null });
  }

  // 4. Other charges (each posted individually)
  if (otherCharges?.length > 0) {
    for (const charge of otherCharges) {
      const chargeAmount = parseFloat(charge.amount) || 0;
      if (chargeAmount > 0) {
        docs.push({ ...base,
          account_head: charge.type || 'Other Charges', account_type: 'INCOME',
          debit_amount: 0, credit_amount: chargeAmount,
          narration: `${charge.type} on Sales Bill No: ${billNo}`,
          party_id: null, stock_id: null, stock_reg_id: null });
      }
    }
  }

  // 5. Sales account (items taxable value ONLY — other charges posted above)
  const taxableItemsTotal = cart.reduce(
    (sum, item) => sum + (item.qty * item.rate * (1 - (item.disc || 0) / 100)), 0
  );
  docs.push({ ...base, account_head: 'Sales', account_type: 'INCOME',
    debit_amount: 0, credit_amount: taxableItemsTotal,
    narration: `Sales Bill No: ${billNo}`,
    party_id: null, stock_id: null, stock_reg_id: null });

  await Ledger.insertMany(docs);
}

/* ── TOTAL CALCULATION HELPER ────────────────────────────────────────────── */

function calcBillTotals(cart, otherCharges, gstEnabled, billType, reverseCharge) {
  let gtot = 0, totalTax = 0;
  cart.forEach(item => {
    const lineVal = item.qty * item.rate * (1 - (item.disc || 0) / 100);
    if (gstEnabled) totalTax += lineVal * (item.grate / 100);
    gtot += lineVal;
  });

  let otherChargesTotal = 0, otherChargesGstTotal = 0;
  if (otherCharges?.length > 0) {
    for (const charge of otherCharges) {
      const amt = parseFloat(charge.amount) || 0;
      otherChargesTotal += amt;
      if (gstEnabled) otherChargesGstTotal += (amt * (parseFloat(charge.gstRate) || 0)) / 100;
    }
  }

  gtot += otherChargesTotal;

  let cgst = 0, sgst = 0, igst = 0;
  if (gstEnabled && billType === 'intra-state') {
    cgst = (totalTax / 2) + (otherChargesGstTotal / 2);
    sgst = (totalTax / 2) + (otherChargesGstTotal / 2);
  } else if (gstEnabled) {
    igst = totalTax + otherChargesGstTotal;
  }

  let ntot = gtot + (reverseCharge ? 0 : totalTax + otherChargesGstTotal);
  const roundedNtot = Math.round(ntot);
  const rof = (roundedNtot - ntot).toFixed(2);
  ntot = roundedNtot;

  return { gtot, totalTax, otherChargesTotal, otherChargesGstTotal, cgst, sgst, igst, ntot, rof };
}

/* ═══════════════════════════════════════════════════════════════════════════
   STOCKS API
═══════════════════════════════════════════════════════════════════════════ */

export const getAllStocks = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_ALL_STOCKS');
    if (!firmId) return;

    // batches stored as Array in MongoDB — no JSON.parse needed
    const stocks = await Stock.find({ firm_id: firmId }).lean();
    res.json({ success: true, data: stocks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getPartyItemHistory = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_PARTY_ITEM_HISTORY');
    if (!firmId) return;

    const partyId = validateObjectId(req.query.partyId, 'partyId', res);
    if (!partyId) return;
    const stockId = validateObjectId(req.query.stockId, 'stockId', res);
    if (!stockId) return;

    const limitParam = req.query.limit;
    const limit = limitParam === 'all' ? null : Math.min(parseInt(limitParam) || 10, 500);

    const fid = new mongoose.Types.ObjectId(firmId);   // ⚠️ cast for aggregate
    const pid = new mongoose.Types.ObjectId(partyId);
    const sid = new mongoose.Types.ObjectId(stockId);

    const pipeline = [
      // Start from stock_reg, scoped to this firm + stock + type
      { $match: { firm_id: fid, stock_id: sid, type: 'SALE' } },
      // Join bills to get party_id
      { $lookup: { from: 'bills', localField: 'bill_id', foreignField: '_id', as: 'billDoc' } },
      { $unwind: { path: '$billDoc', preserveNullAndEmptyArrays: false } },
      // Filter by party
      { $match: { 'billDoc.party_id': pid } },
      // Sort by bdate or created_at DESC
      { $sort: { bdate: -1, createdAt: -1 } },
      ...(limit !== null ? [{ $limit: limit }] : []),
      {
        $project: {
          reg_id:     '$_id',
          stock_id:   1, item: 1, batch: 1, hsn: 1, qty: 1, uom: 1,
          rate: 1, grate: 1, disc: 1, total: 1, bno: 1, bdate: 1, createdAt: 1,
          bill_id:    '$billDoc._id',
          party_id:   '$billDoc.party_id',
          firm:       '$billDoc.firm',
          usern:      '$billDoc.usern',
        },
      },
    ];

    const rows = await StockReg.aggregate(pipeline);
    res.json({ success: true, data: { partyId, stockId, rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createStock = async (req, res) => {
  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

    const firmId = getFirmId(req, res, 'CREATE_STOCK');
    if (!firmId) return;

    let { item, pno, batch, oem, hsn, qty, uom, rate, grate, mrp, expiryDate, batches } = req.body;

    // Normalise batches: accept array or JSON string
    let parsedBatches = null;
    if (batches) {
      try {
        parsedBatches = Array.isArray(batches) ? batches : JSON.parse(batches);
        if (!Array.isArray(parsedBatches)) parsedBatches = null;
      } catch { /* ignore */ }
    }

    // If only batches provided (no scalar fields), derive scalars from first batch
    if (parsedBatches?.length > 0 && !batch && !qty && !rate && !mrp && !expiryDate) {
      const b0 = parsedBatches[0] || {};
      batch = b0.batch ?? batch;
      qty   = b0.qty   ?? qty;
      rate  = b0.rate  ?? rate;
      mrp   = b0.mrp   ?? mrp;
      expiryDate = b0.expiry ?? expiryDate;
    }

    console.log('[CREATE_STOCK] firmId:', firmId);

    // Check if item already exists for this firm
    const existingStock = await Stock.findOne({ firm_id: firmId, item }).lean();

    if (existingStock) {
      // ── UPDATE existing record: merge batch ─────────────────────────────
      let existingBatches = Array.isArray(existingStock.batches) ? [...existingStock.batches] : [];

      if (parsedBatches?.length > 0) {
        const b0 = parsedBatches[0] || {};
        batch      = b0.batch  ?? batch;
        qty        = b0.qty    ?? qty;
        rate       = b0.rate   ?? rate;
        mrp        = b0.mrp    ?? mrp;
        expiryDate = b0.expiry ?? expiryDate;
      }

      const existingBatchIdx = existingBatches.findIndex(b => b.batch === batch);
      if (existingBatchIdx !== -1) {
        existingBatches[existingBatchIdx].qty += parseFloat(qty);
        if (mrp !== undefined && mrp !== null && mrp !== '') existingBatches[existingBatchIdx].mrp = parseFloat(mrp);
        if (expiryDate) existingBatches[existingBatchIdx].expiry = expiryDate;
        if (rate !== undefined && rate !== null && rate !== '') existingBatches[existingBatchIdx].rate = parseFloat(rate);
      } else {
        existingBatches.push({
          batch:  batch  || null,
          qty:    parseFloat(qty),
          rate:   parseFloat(rate),
          expiry: expiryDate || null,
          mrp:    mrp ? parseFloat(mrp) : null,
        });
      }

      const newTotalQty = existingBatches.reduce((s, b) => s + b.qty, 0);
      const newTotal    = newTotalQty * parseFloat(rate);

      await Stock.findOneAndUpdate(
        { _id: existingStock._id, firm_id: firmId },
        {
          $set: {
            item, pno: pno || null, oem: oem || null, hsn,
            qty:     newTotalQty, uom,
            rate:    parseFloat(rate),
            grate:   parseFloat(grate),
            total:   newTotal,
            mrp:     mrp ? parseFloat(mrp) : null,
            batches: existingBatches,
            user:    actorUsername,
          },
        }
      );

      return res.json({ success: true, id: existingStock._id, message: 'Stock batch updated successfully' });
    } else {
      // ── CREATE new record ────────────────────────────────────────────────
      const batchesToStore = parsedBatches?.length > 0
        ? parsedBatches
        : [{ batch: batch || null, qty: parseFloat(qty), rate: parseFloat(rate), expiry: expiryDate || null, mrp: mrp ? parseFloat(mrp) : null }];

      const total = parseFloat(qty) * parseFloat(rate);

      const newStock = await Stock.create({
        firm_id: firmId,
        item,
        pno:     pno  || null,
        oem:     oem  || null,
        hsn,
        qty:     parseFloat(qty)   || 0,
        uom:     uom  || 'PCS',
        rate:    parseFloat(rate)  || 0,
        grate:   parseFloat(grate) || 0,
        total,
        mrp:     mrp ? parseFloat(mrp) : null,
        batches: batchesToStore,   // Array — no JSON.stringify in MongoDB
        user:    actorUsername,
      });

      console.log('[CREATE_STOCK] Created:', newStock._id);
      return res.json({ success: true, id: newStock._id, message: 'Stock added successfully' });
    }
  } catch (err) {
    console.error('[CREATE_STOCK] Error:', err.message, err);
    res.status(400).json({ error: err.message });
  }
};

export const updateStock = async (req, res) => {
  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const firmId = getFirmId(req, res, 'UPDATE_STOCK');
    if (!firmId) return;

    const stockId = validateObjectId(req.params.id, 'stock ID', res);
    if (!stockId) return;

    let { item, pno, batch, oem, hsn, qty, uom, rate, grate, mrp, expiryDate,
          batches: incomingBatches } = req.body;

    const currentStock = await Stock.findOne({ _id: stockId, firm_id: firmId }).lean();
    if (!currentStock) {
      return res.status(404).json({ success: false, error: 'Stock not found or does not belong to your firm' });
    }

    // Start from existing batches (already an Array in MongoDB)
    let batches = Array.isArray(currentStock.batches) ? [...currentStock.batches] : [];

    // If client sent batches, prefer them
    if (incomingBatches) {
      try {
        const parsed = Array.isArray(incomingBatches) ? incomingBatches : JSON.parse(incomingBatches);
        if (Array.isArray(parsed)) batches = parsed;
      } catch { /* ignore */ }

      const b0 = batches.length > 0 ? batches[0] : null;
      if (b0) {
        if (!batch && b0.batch !== undefined)   batch      = b0.batch;
        if (!qty   && b0.qty   !== undefined)   qty        = b0.qty;
        if (!rate  && b0.rate  !== undefined)   rate       = b0.rate;
        if (!mrp   && b0.mrp   !== undefined)   mrp        = b0.mrp;
        if (!expiryDate && b0.expiry !== undefined) expiryDate = b0.expiry;
      }
    } else if (batch) {
      // Update or add specific batch by batch value
      const batchIndex = batches.findIndex(b => b.batch === batch);
      if (batchIndex !== -1) {
        batches[batchIndex].qty = parseFloat(qty) || batches[batchIndex].qty;
        if (rate       !== undefined && rate       !== null) batches[batchIndex].rate   = parseFloat(rate);
        if (expiryDate !== undefined && expiryDate !== null) batches[batchIndex].expiry = expiryDate;
        if (mrp        !== undefined && mrp        !== null) batches[batchIndex].mrp    = parseFloat(mrp);
      } else {
        batches.push({ batch, qty: parseFloat(qty), rate: parseFloat(rate), expiry: expiryDate || null, mrp: mrp ? parseFloat(mrp) : null });
      }
    } else {
      // No batch specified — update / create first batch
      if (batches.length > 0) {
        batches[0].qty = parseFloat(qty) || batches[0].qty;
        if (rate       !== undefined && rate       !== null) batches[0].rate   = parseFloat(rate);
        if (expiryDate !== undefined && expiryDate !== null) batches[0].expiry = expiryDate;
        if (mrp        !== undefined && mrp        !== null) batches[0].mrp    = parseFloat(mrp);
      } else {
        batches.push({ batch: null, qty: parseFloat(qty), rate: parseFloat(rate), expiry: expiryDate || null, mrp: mrp ? parseFloat(mrp) : null });
      }
    }

    // Sync root-level fields from batch array (consistency rule)
    const newTotalQty = batches.reduce((s, b) => s + (parseFloat(b.qty) || 0), 0);
    let rootRate = parseFloat(rate || currentStock.rate || 0);
    let rootMrp  = mrp ? parseFloat(mrp) : currentStock.mrp;
    if (batches.length > 0 && batches[0].rate !== undefined) rootRate = parseFloat(batches[0].rate);
    if (batches.length > 0 && batches[0].mrp  !== undefined && batches[0].mrp !== null) rootMrp = parseFloat(batches[0].mrp);

    console.log(`[UPDATE_STOCK] id=${stockId}`, { item, qty: newTotalQty, rate: rootRate, mrp: rootMrp, batchCount: batches.length });

    await Stock.findOneAndUpdate(
      { _id: stockId, firm_id: firmId },
      {
        $set: {
          item, pno: pno || null, oem: oem || null, hsn,
          qty:     newTotalQty, uom,
          rate:    rootRate,
          grate:   parseFloat(grate),
          total:   newTotalQty * rootRate,
          mrp:     rootMrp,
          batches,           // Array — no JSON.stringify
          user:    actorUsername,
        },
      }
    );

    // Verification fetch
    const verified = await Stock.findOne({ _id: stockId, firm_id: firmId }).lean();
    console.log(`[UPDATE_STOCK] Verified:`, { id: verified._id, qty: verified.qty, rate: verified.rate });

    res.json({ success: true, message: 'Stock updated successfully' });
  } catch (err) {
    console.error('[UPDATE_STOCK] Error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
};

export const deleteStock = async (req, res) => {
  try {
    const firmId  = getFirmId(req, res, 'DELETE_STOCK');
    if (!firmId) return;

    const stockId = validateObjectId(req.params.id, 'stock ID', res);
    if (!stockId) return;

    const existing = await Stock.findOne({ _id: stockId, firm_id: firmId }).lean();
    if (!existing) return res.status(404).json({ error: 'Stock not found or does not belong to your firm' });

    await Stock.deleteOne({ _id: stockId, firm_id: firmId });
    res.json({ success: true, message: 'Stock deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   PARTIES API
═══════════════════════════════════════════════════════════════════════════ */

export const getAllParties = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_ALL_PARTIES');
    if (!firmId) return;

    const parties = await Party.find({ firm_id: firmId }).lean();
    res.json({ success: true, data: parties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const createParty = async (req, res) => {
  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

    const firmId = getFirmId(req, res, 'CREATE_PARTY');
    if (!firmId) return;

    const { firm, gstin, contact, state, state_code, addr, pin, pan } = req.body;

    const newParty = await Party.create({
      firm_id:    firmId,
      firm,
      gstin:      gstin      || 'UNREGISTERED',
      contact:    contact    || null,
      state:      state      || '',
      state_code: state_code || null,
      addr:       addr       || null,
      pin:        pin        || null,
      pan:        pan        || null,
      created_by: actorUsername,
    });

    res.json({
      success: true,
      id:         newParty._id,
      firm:       newParty.firm,
      gstin:      newParty.gstin,
      contact:    newParty.contact,
      state:      newParty.state,
      state_code: newParty.state_code,
      addr:       newParty.addr,
      pin:        newParty.pin,
      pan:        newParty.pan,
      message:    'Party created successfully',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   BILLS API (Sales Transaction)
═══════════════════════════════════════════════════════════════════════════ */

export const createBill = async (req, res) => {
  const { meta, party, cart, otherCharges, consignee } = req.body;

  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'CREATE_BILL');
  if (!firmId) return;

  if (!cart || cart.length === 0) return res.status(400).json({ error: 'Cart cannot be empty' });

  // Generate bill number
  let billNo;
  try {
    billNo = await getNextBillNumber(firmId, 'SALES');
    console.log(`[CREATE_BILL] Generated: ${billNo}`);
  } catch (err) {
    console.error('[CREATE_BILL] Bill number error:', err.message);
    return res.status(500).json({ error: `Failed to generate bill number: ${err.message}` });
  }
  meta.billNo = billNo;

  const gstEnabled = await isGstEnabled(firmId);
  const { gtot, cgst, sgst, igst, ntot, rof } = calcBillTotals(cart, otherCharges, gstEnabled, meta.billType, meta.reverseCharge);

  try {
    const firmRecord = await Firm.findById(firmId).select('name').lean();
    const firmName   = firmRecord?.name ?? '';

    // A. Insert Bill Header
    const newBill = await Bill.create({
      firm_id:           firmId,
      bno:               meta.billNo,
      bdate:             meta.billDate,
      firm:              party.firm,
      addr:              party.addr      || '',
      gstin:             party.gstin     || 'UNREGISTERED',
      state:             party.state     || '',
      pin:               party.pin       || null,
      state_code:        party.state_code || null,
      gtot,
      ntot,
      rof,
      type:              meta.billType ? meta.billType.toUpperCase() : 'SALES',
      usern:             actorUsername,
      firmn:             firmName,
      party_id:          party.id        || null,
      other_charges:     otherCharges?.length > 0 ? otherCharges : null, // Array in MongoDB
      ref_no:            meta.referenceNo    || null,
      vehicle_no:        meta.vehicleNo      || null,
      dispatch_through:  meta.dispatchThrough || null,
      narration:         meta.narration      || null,
      reverse_charge:    meta.reverseCharge  || 0,
      cgst, sgst, igst,
      consignee_name:    consignee?.name       || null,
      consignee_gstin:   consignee?.gstin      || null,
      consignee_address: consignee?.address    || null,
      consignee_state:   consignee?.state      || null,
      consignee_pin:     consignee?.pin        || null,
      consignee_state_code: consignee?.stateCode || null,
    });

    const billId = newBill._id;

    // B. Process cart items — deduct stock batches + insert StockReg
    const stockRegDocs = [];
    for (const item of cart) {
      const lineTotal = item.qty * item.rate * (1 - (item.disc || 0) / 100);

      const stockRecord = await Stock.findOne({ _id: item.stockId, firm_id: firmId }).lean();
      if (!stockRecord) throw new Error(`Stock not found for ID: ${item.stockId} or does not belong to your firm`);

      // Multi-firm safety (belt-and-suspenders since findOne already filters by firm_id)
      if (stockRecord.firm_id.toString() !== firmId.toString()) {
        throw new Error(`Stock does not belong to your firm`);
      }

      let batches = Array.isArray(stockRecord.batches) ? [...stockRecord.batches] : [];

      // Resolve batch index
      let batchIndex = -1;
      if (item.batchIndex !== undefined && item.batchIndex !== null) {
        batchIndex = parseInt(item.batchIndex);
        if (batchIndex < 0 || batchIndex >= batches.length) {
          throw new Error(`Invalid batch index ${item.batchIndex} for item ${item.item}`);
        }
      } else if (!item.batch || item.batch === '') {
        batchIndex = batches.findIndex(b => !b.batch || b.batch === '');
      } else {
        batchIndex = batches.findIndex(b => b.batch === item.batch);
      }

      if (batchIndex === -1) {
        throw new Error(`Batch "${item.batch || '(No Batch)'}" not found for item ${item.item}`);
      }

      const requestedQty = parseFloat(item.qty);
      if (batches[batchIndex].qty < requestedQty) {
        throw new Error(
          `Insufficient quantity in batch "${item.batch || '(No Batch)'}". Available: ${batches[batchIndex].qty}, Requested: ${requestedQty}`
        );
      }

      batches[batchIndex].qty -= requestedQty;
      const newTotalQty = batches.reduce((s, b) => s + b.qty, 0);

      // Update stock record
      await Stock.findOneAndUpdate(
        { _id: item.stockId, firm_id: firmId },
        {
          $set: {
            qty:     newTotalQty,
            batches,                              // Array — no JSON.stringify
            total:   newTotalQty * stockRecord.rate,
            user:    actorUsername,
          },
        }
      );

      // Collect StockReg doc
      stockRegDocs.push({
        firm_id:    firmId,
        type:       'SALE',
        bno:        meta.billNo,
        bdate:      meta.billDate,
        party_name: party.firm,
        item:       item.item,
        narration:  item.narration || null,
        batch:      item.batch     || null,
        hsn:        item.hsn,
        qty:        item.qty,
        uom:        item.uom,
        rate:       item.rate,
        grate:      item.grate,
        disc:       item.disc || 0,
        total:      lineTotal,
        stock_id:   item.stockId,
        bill_id:    billId,
        created_by: actorUsername,
        usern:      party.firm,
        is_return:  0,
      });
    }

    await StockReg.insertMany(stockRegDocs);

    // C. Post ledger entries
    await postSalesLedger({ firmId, billId, billNo: meta.billNo, billDate: meta.billDate,
      party, ntot, cgst, sgst, igst, rof, otherCharges, cart, actorUsername });

    res.json({ success: true, id: billId, billNo: meta.billNo, message: 'Bill created successfully' });
  } catch (err) {
    console.error('[CREATE_BILL] Error:', err.message, err.stack);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error:   err.message || 'Failed to create bill',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });
    }
  }
};

export const getBillById = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_BILL_BY_ID');
    if (!firmId) return;

    const billId = validateObjectId(req.params.id, 'bill ID', res);
    if (!billId) return;

    const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    // Items from stock_reg
    const items = await StockReg.find({ bill_id: billId, firm_id: firmId }).sort({ createdAt: 1 }).lean();

    res.json({
      success: true,
      data: {
        ...bill,
        items,
        otherCharges: bill.other_charges ?? [],  // already Array in MongoDB
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllBills = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_ALL_BILLS');
    if (!firmId) return;

    const bills = await Bill.find({ firm_id: firmId }).sort({ createdAt: -1 }).lean();

    const result = bills.map(b => ({
      ...b,
      otherCharges: b.other_charges ?? [],  // normalise field name for client
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateBill = async (req, res) => {
  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

    const firmId = getFirmId(req, res, 'UPDATE_BILL');
    if (!firmId) return;

    const billId = validateObjectId(req.params.id, 'bill ID', res);
    if (!billId) return;

    const { meta, party, cart, otherCharges, consignee } = req.body;
    if (!cart || cart.length === 0) return res.status(400).json({ error: 'Cart cannot be empty' });

    const existingBill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
    if (!existingBill) return res.status(404).json({ error: 'Bill not found' });

    if (meta.billNo && meta.billNo !== existingBill.bno) {
      return res.status(400).json({ error: 'Bill number cannot be changed' });
    }

    // Step 1: Restore old stock quantities
    const existingItems = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();
    for (const existingItem of existingItems) {
      const stockRecord = await Stock.findOne({ _id: existingItem.stock_id, firm_id: firmId }).lean();
      if (!stockRecord) continue;

      let batches = Array.isArray(stockRecord.batches) ? [...stockRecord.batches] : [];

      let batchIndex = -1;
      if (!existingItem.batch || existingItem.batch === '') {
        batchIndex = batches.findIndex(b => !b.batch || b.batch === '');
      } else {
        batchIndex = batches.findIndex(b => b.batch === existingItem.batch);
      }

      if (batchIndex !== -1) {
        batches[batchIndex].qty += existingItem.qty;
      } else {
        batches.push({ batch: existingItem.batch || null, qty: existingItem.qty,
          rate: existingItem.rate, expiry: null, mrp: null });
      }

      const newTotalQty = batches.reduce((s, b) => s + b.qty, 0);
      await Stock.findOneAndUpdate(
        { _id: existingItem.stock_id, firm_id: firmId },
        { $set: { qty: newTotalQty, batches, total: newTotalQty * stockRecord.rate, user: actorUsername } }
      );
    }

    // Step 2: Recalculate totals
    const gstEnabled = await isGstEnabled(firmId);
    const { gtot, cgst, sgst, igst, ntot, rof } = calcBillTotals(cart, otherCharges, gstEnabled, meta.billType, meta.reverseCharge);

    // Step 3: Update bill header
    await Bill.findOneAndUpdate(
      { _id: billId, firm_id: firmId },
      {
        $set: {
          bdate:             meta.billDate,
          firm:              party.firm,
          addr:              party.addr      || '',
          gstin:             party.gstin     || 'UNREGISTERED',
          state:             party.state     || '',
          pin:               party.pin       || null,
          state_code:        party.state_code || null,
          gtot, ntot, rof,
          type:              meta.billType ? meta.billType.toUpperCase() : 'SALES',
          usern:             actorUsername,
          party_id:          party.id        || null,
          other_charges:     otherCharges?.length > 0 ? otherCharges : null,
          ref_no:            meta.referenceNo     || null,
          vehicle_no:        meta.vehicleNo       || null,
          dispatch_through:  meta.dispatchThrough  || null,
          narration:         meta.narration        || null,
          reverse_charge:    meta.reverseCharge    || 0,
          cgst, sgst, igst,
          consignee_name:    consignee?.name       || null,
          consignee_gstin:   consignee?.gstin      || null,
          consignee_address: consignee?.address    || null,
          consignee_state:   consignee?.state      || null,
          consignee_pin:     consignee?.pin        || null,
          consignee_state_code: consignee?.stateCode || null,
        },
      }
    );

    // Step 4: Delete old StockReg entries
    await StockReg.deleteMany({ bill_id: billId, firm_id: firmId });

    // Step 5: Process new cart items
    const stockRegDocs = [];
    for (const item of cart) {
      const lineTotal = item.qty * item.rate * (1 - (item.disc || 0) / 100);

      const stockRecord = await Stock.findOne({ _id: item.stockId, firm_id: firmId }).lean();
      if (!stockRecord) throw new Error(`Stock not found for ID: ${item.stockId}`);

      if (stockRecord.firm_id.toString() !== firmId.toString()) {
        throw new Error(`Stock does not belong to your firm`);
      }

      let batches = Array.isArray(stockRecord.batches) ? [...stockRecord.batches] : [];
      let batchIndex = -1;

      if (item.batchIndex !== undefined && item.batchIndex !== null) {
        batchIndex = parseInt(item.batchIndex);
        if (batchIndex < 0 || batchIndex >= batches.length) {
          throw new Error(`Invalid batch index ${item.batchIndex} for item ${item.item}`);
        }
      } else if (!item.batch || item.batch === '') {
        batchIndex = batches.findIndex(b => !b.batch || b.batch === '');
      } else {
        batchIndex = batches.findIndex(b => b.batch === item.batch);
      }

      if (batchIndex === -1) throw new Error(`Batch "${item.batch || '(No Batch)'}" not found for item ${item.item}`);

      const requestedQty = parseFloat(item.qty);
      if (batches[batchIndex].qty < requestedQty) {
        throw new Error(
          `Insufficient quantity in batch "${item.batch || '(No Batch)'}". Available: ${batches[batchIndex].qty}, Requested: ${requestedQty}`
        );
      }

      batches[batchIndex].qty -= requestedQty;
      const newTotalQty = batches.reduce((s, b) => s + b.qty, 0);

      await Stock.findOneAndUpdate(
        { _id: item.stockId, firm_id: firmId },
        { $set: { qty: newTotalQty, batches, total: newTotalQty * stockRecord.rate, user: actorUsername } }
      );

      stockRegDocs.push({
        firm_id:    firmId,
        type:       'SALE',
        bno:        existingBill.bno,
        bdate:      meta.billDate,
        party_name: party.firm,
        item:       item.item,
        narration:  item.narration || null,
        batch:      item.batch     || null,
        hsn:        item.hsn,
        qty:        item.qty,
        uom:        item.uom,
        rate:       item.rate,
        grate:      item.grate,
        disc:       item.disc || 0,
        total:      lineTotal,
        stock_id:   item.stockId,
        bill_id:    billId,
        created_by: actorUsername,
        usern:      party.firm,
        is_return:  0,
      });
    }

    await StockReg.insertMany(stockRegDocs);

    // Step 6: Delete old ledger entries and re-post
    await Ledger.deleteMany({ voucher_id: billId, voucher_type: 'SALES', firm_id: firmId });
    await postSalesLedger({ firmId, billId, billNo: existingBill.bno, billDate: meta.billDate,
      party, ntot, cgst, sgst, igst, rof, otherCharges, cart, actorUsername });

    res.json({ success: true, message: 'Bill updated successfully' });
  } catch (err) {
    console.error('[UPDATE_BILL] Error:', err.message);
    res.status(400).json({ error: err.message });
  }
};

export const cancelBill = async (req, res) => {
  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

    const firmId = getFirmId(req, res, 'CANCEL_BILL');
    if (!firmId) return;

    const billId = validateObjectId(req.params.id, 'bill ID', res);
    if (!billId) return;

    const { reason } = req.body;

    const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (bill.status === 'CANCELLED') return res.status(400).json({ error: 'Bill is already cancelled' });

    // Restore stock quantities
    const items = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();
    for (const item of items) {
      const stockRecord = await Stock.findOne({ _id: item.stock_id, firm_id: firmId }).lean();
      if (!stockRecord) continue;

      let batches = Array.isArray(stockRecord.batches) ? [...stockRecord.batches] : [];
      const batchIndex = batches.findIndex(b => b.batch === item.batch);
      if (batchIndex !== -1) {
        batches[batchIndex].qty += item.qty;
      } else {
        batches.push({ batch: item.batch, qty: item.qty, rate: item.rate, expiry: null, mrp: null });
      }

      const newTotalQty = batches.reduce((s, b) => s + b.qty, 0);
      await Stock.findOneAndUpdate(
        { _id: item.stock_id, firm_id: firmId },
        { $set: { qty: newTotalQty, batches, total: newTotalQty * stockRecord.rate, user: actorUsername } }
      );
    }

    // Delete ledger entries
    await Ledger.deleteMany({ voucher_id: billId, voucher_type: 'SALES', firm_id: firmId });

    // Update bill status
    await Bill.findOneAndUpdate(
      { _id: billId, firm_id: firmId },
      {
        $set: {
          status:         'CANCELLED',
          cancel_reason:  reason || null,
          cancelled_at:   new Date(),
          cancelled_by:   req.user.id,   // string ID from JWT
        },
      }
    );

    res.json({ success: true, message: 'Bill cancelled successfully' });
  } catch (err) {
    console.error('[CANCEL_BILL] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   STOCK MOVEMENTS API
═══════════════════════════════════════════════════════════════════════════ */

export const getStockBatches = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_STOCK_BATCHES');
    if (!firmId) return;

    const stockId = validateObjectId(req.params.id, 'stock ID', res);
    if (!stockId) return;

    const stock = await Stock.findOne({ _id: stockId, firm_id: firmId }).lean();
    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    // batches is already Array in MongoDB
    res.json({ success: true, data: { id: stock._id, item: stock.item, batches: stock.batches ?? [] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getStockMovements = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_STOCK_MOVEMENTS');
    if (!firmId) return;

    const { type, batchFilter, searchTerm, page = 1, limit = 50, partyId, stockId } = req.query;
    const pageInt  = Math.max(1, parseInt(page));
    const limitInt = Math.max(1, parseInt(limit));

    const fid = new mongoose.Types.ObjectId(firmId);  // ⚠️ cast for aggregate

    const matchStage = { firm_id: fid };
    if (type)        matchStage.type  = type;
    if (batchFilter) matchStage.batch = batchFilter;
    if (searchTerm?.trim()) {
      const regex = new RegExp(searchTerm.trim(), 'i');
      matchStage.$or = [{ item: regex }, { bno: regex }];
    }
    if (stockId && mongoose.Types.ObjectId.isValid(stockId)) {
      matchStage.stock_id = new mongoose.Types.ObjectId(stockId);
    }

    const pipeline = [
      { $match: matchStage },
      // Join stocks
      { $lookup: { from: 'stocks', localField: 'stock_id', foreignField: '_id', as: 'stockDoc' } },
      // Join bills (to get party via bill.party_id)
      { $lookup: { from: 'bills', localField: 'bill_id', foreignField: '_id', as: 'billDoc' } },
    ];

    // Filter by partyId via the bill join
    if (partyId && mongoose.Types.ObjectId.isValid(partyId)) {
      pipeline.push({ $match: { 'billDoc.party_id': new mongoose.Types.ObjectId(partyId) } });
    }

    // Join parties from the bill
    pipeline.push(
      { $lookup: {
          from:         'parties',
          localField:   'billDoc.party_id',
          foreignField: '_id',
          as:           'partyDoc',
      }},
      {
        $addFields: {
          stock_item: { $arrayElemAt: ['$stockDoc.item', 0] },
          bill_date:  { $arrayElemAt: ['$billDoc.bdate',  0] },
          party_name: { $arrayElemAt: ['$partyDoc.firm',  0] },
        },
      },
      { $project: { stockDoc: 0, billDoc: 0, partyDoc: 0 } },
      { $sort:  { createdAt: -1 } },
      { $skip:  (pageInt - 1) * limitInt },
      { $limit: limitInt },
    );

    const rows = await StockReg.aggregate(pipeline);
    res.json({ success: true, data: { page: pageInt, limit: limitInt, rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getStockMovementsByStock = async (req, res) => {
  try {
    const firmId  = getFirmId(req, res, 'GET_STOCK_MOVEMENTS_BY_STOCK');
    if (!firmId) return;

    const stockId = validateObjectId(req.params.stockId, 'stockId', res);
    if (!stockId) return;

    const { page = 1, limit = 50 } = req.query;
    const pageInt  = Math.max(1, parseInt(page));
    const limitInt = Math.max(1, parseInt(limit));

    const rows = await StockReg.find({ stock_id: stockId, firm_id: firmId })
      .sort({ createdAt: -1 })
      .skip((pageInt - 1) * limitInt)
      .limit(limitInt)
      .lean();

    res.json({ success: true, data: { stockId, page: pageInt, limit: limitInt, rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createStockMovement = async (req, res) => {
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
    if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

    const firmId = getFirmId(req, res, 'CREATE_STOCK_MOVEMENT');
    if (!firmId) return;

    const validatedStockId = validateObjectId(stockId, 'stockId', res);
    if (!validatedStockId) return;

    const stock = await Stock.findOne({ _id: validatedStockId, firm_id: firmId }).lean();
    if (!stock) return res.status(404).json({ error: 'Stock not found or does not belong to your firm' });

    const absQty           = Math.abs(parseFloat(qty));
    const calculatedTotal  = total || (absQty * (rate || 0));
    const today            = new Date().toISOString().split('T')[0];

    await StockReg.create({
      firm_id:    firmId,
      type,
      bno:        referenceNumber || null,
      bdate:      today,
      party_name: 'INTERNAL',
      item:       stock.item,
      narration:  description || null,
      batch:      batch       || null,
      hsn:        stock.hsn,
      qty:        absQty,
      uom,
      rate:       rate        || 0,
      grate:      stock.grate || 0,
      disc:       0,
      total:      calculatedTotal,
      stock_id:   validatedStockId,
      bill_id:    null,
      created_by: actorUsername,
      usern:      'Internal',
      is_return:  0,
    });

    const newQty = (stock.qty || 0) + absQty;
    await Stock.findOneAndUpdate(
      { _id: validatedStockId, firm_id: firmId },
      {
        $set: {
          qty:   newQty,
          uom:   uom  || stock.uom,
          rate:  rate || stock.rate,
          total: newQty * (rate || stock.rate),
          user:  actorUsername,
        },
      }
    );

    res.json({ success: true, message: `Stock movement (${type}) created successfully` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY ENDPOINTS
═══════════════════════════════════════════════════════════════════════════ */

export const getOtherChargesTypes = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_OTHER_CHARGES_TYPES');
    if (!firmId) return;

    // other_charges stored as Array in MongoDB — no JSON.parse needed
    const bills = await Bill.find({ firm_id: firmId, other_charges: { $exists: true, $ne: null } })
      .select('other_charges')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const chargesMap = new Map();
    for (const bill of bills) {
      if (!Array.isArray(bill.other_charges)) continue;
      for (const charge of bill.other_charges) {
        const key = charge.name || charge.type;
        if (key && !chargesMap.has(key)) {
          chargesMap.set(key, {
            name:    charge.name   || charge.type,
            type:    charge.type   || 'other',
            hsnSac:  charge.hsnSac || '',
            gstRate: charge.gstRate || 0,
          });
        }
      }
    }

    res.json({ success: true, data: Array.from(chargesMap.values()) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getNextBillNumberPreviewEndpoint = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'PREVIEW_BILL_NUMBER');
    if (!firmId) return;

    const billNo = await previewNextBillNumber(firmId, 'SALES');
    res.json({ success: true, nextBillNumber: billNo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getCurrentUserFirmName = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_FIRM_NAME');
    if (!firmId) return;

    const firm = await Firm.findById(firmId).select('name address').lean();
    if (!firm) return res.status(404).json({ success: false, error: 'Firm not found' });

    res.json({ success: true, data: firm });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getPartyBalance = async (req, res) => {
  try {
    const firmId  = getFirmId(req, res, 'GET_PARTY_BALANCE');
    if (!firmId) return;

    const partyId = validateObjectId(req.params.partyId, 'partyId', res);
    if (!partyId) return;

    // ⚠️ Must cast both IDs for aggregate $match
    const [result] = await Ledger.aggregate([
      {
        $match: {
          firm_id:      new mongoose.Types.ObjectId(firmId),
          party_id:     new mongoose.Types.ObjectId(partyId),
          account_type: 'DEBTOR',
        },
      },
      {
        $group: {
          _id:          null,
          total_debit:  { $sum: '$debit_amount'  },
          total_credit: { $sum: '$credit_amount' },
        },
      },
    ]);

    const debit   = result?.total_debit  ?? 0;
    const credit  = result?.total_credit ?? 0;
    const balance = debit - credit;

    res.json({ success: true, data: { partyId, balance, debit, credit } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const lookupGST = async (req, res) => {
  const gstin = req.query.gstin || req.body?.gstin;
  if (!gstin) return res.status(400).json({ error: 'GSTIN is required' });

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  const url = `https://powerful-gstin-tool.p.rapidapi.com/v1/gstin/${gstin}/details`;

  try {
    const response = await fetch(url, {
      method:  'GET',
      headers: {
        'x-rapidapi-key':  RAPIDAPI_KEY,
        'x-rapidapi-host': 'powerful-gstin-tool.p.rapidapi.com',
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[GST_LOOKUP] Error:', err);
    res.status(500).json({ error: 'Failed to fetch GST details' });
  }
};

export const exportStockMovementsToExcel = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'EXPORT_STOCK_MOVEMENTS_EXCEL');
    if (!firmId) return;

    const { type, searchTerm } = req.query;
    const fid = new mongoose.Types.ObjectId(firmId); // ⚠️ cast for aggregate

    const matchStage = { firm_id: fid };
    if (type) matchStage.type = type;
    if (searchTerm?.trim()) {
      const regex = new RegExp(searchTerm.trim(), 'i');
      matchStage.$or = [{ item: regex }, { bno: regex }];
    }

    const rows = await StockReg.aggregate([
      { $match: matchStage },
      { $lookup: { from: 'stocks',  localField: 'stock_id',       foreignField: '_id', as: 'stockDoc' } },
      { $lookup: { from: 'bills',   localField: 'bill_id',        foreignField: '_id', as: 'billDoc'  } },
      { $lookup: { from: 'parties', localField: 'billDoc.party_id', foreignField: '_id', as: 'partyDoc' } },
      {
        $addFields: {
          stock_item: { $arrayElemAt: ['$stockDoc.item',  0] },
          bill_date:  { $arrayElemAt: ['$billDoc.bdate',  0] },
          party_name: { $arrayElemAt: ['$partyDoc.firm',  0] },
        },
      },
      { $project: { stockDoc: 0, billDoc: 0, partyDoc: 0 } },
      { $sort: { createdAt: -1 } },
    ]);

    const workbook  = new ExcelJS.Workbook();
    workbook.creator = 'Business Management App';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Stock Movements');

    ws.columns = [
      { header: 'Date',     key: 'date',     width: 12 },
      { header: 'Type',     key: 'type',     width: 10 },
      { header: 'Bill No',  key: 'billNo',   width: 15 },
      { header: 'Item',     key: 'item',     width: 30 },
      { header: 'Batch',    key: 'batch',    width: 15 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'UOM',      key: 'uom',      width: 10 },
      { header: 'Rate',     key: 'rate',     width: 12 },
      { header: 'Total',    key: 'total',    width: 12 },
      { header: 'Party',    key: 'party',    width: 25 },
    ];

    ws.getColumn('date').numFmt     = 'dd-mm-yyyy';
    ws.getColumn('quantity').numFmt = '0.00';
    ws.getColumn('rate').numFmt     = '0.00';
    ws.getColumn('total').numFmt    = '0.00';

    for (const row of rows) {
      ws.addRow({
        date:     row.bdate      || '',
        type:     row.type       || '',
        billNo:   row.bno        || '',
        item:     row.item       || '',
        batch:    row.batch      || '',
        quantity: row.qty        || 0,
        uom:      row.uom        || '',
        rate:     row.rate       || 0,
        total:    row.total      || 0,
        party:    row.party_name || '',
      });
    }

    // Header styling
    ws.getRow(1).font      = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    ws.views               = [{ state: 'frozen', ySplit: 1 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=stock-movements-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma',  'no-cache');
    res.setHeader('Expires', '0');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[EXPORT_EXCEL] Error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
};