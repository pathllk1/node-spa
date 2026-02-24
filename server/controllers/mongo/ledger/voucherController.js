

import mongoose from 'mongoose';
import { Ledger, Party, BillSequence } from '../../../models/index.js';

const now           = () => new Date().toISOString();
const getActorUsername = (req) => req?.user?.username ?? null;

/* ── HELPERS ─────────────────────────────────────────────────────────────── */

async function getNextVoucherNumber(firmId, voucherType) {
  const d     = new Date();
  const month = d.getMonth() + 1;
  const year  = d.getFullYear();
  const financialYear = month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`;

  const prefixMap = { JOURNAL: 'JV', PAYMENT: 'PV', RECEIPT: 'RV', SALES: 'SI', PURCHASE: 'PI' };
  const prefix = prefixMap[voucherType] ?? voucherType.slice(0, 2);

  const seq = await BillSequence.findOneAndUpdate(
    { firm_id: firmId, financial_year: financialYear, voucher_type: voucherType },
    { $inc: { last_number: 1 } },
    { new: true, upsert: true }
  );

  return `${prefix}/${financialYear}/${String(seq.last_number).padStart(4, '0')}`;
}

function getFirmId(req, res, tag) {
  const raw = req.user?.firm_id;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    console.error(`[${tag}] Invalid firm_id:`, raw);
    res.status(400).json({ error: 'Invalid or missing firm ID' });
    return null;
  }
  return raw;
}

/** Derive payment mode label from account_head string */
function paymentModeFromAccountHead(accountHead) {
  if (!accountHead) return 'Cash';
  const h = accountHead.toLowerCase();
  if (h.includes('cheque'))   return 'Cheque';
  if (h.includes('neft'))     return 'NEFT';
  if (h.includes('rtgs'))     return 'RTGS';
  if (h.includes('upi'))      return 'UPI';
  if (h.includes('transfer')) return 'Bank Transfer';
  if (h.includes('bank'))     return 'Bank Transfer';
  return 'Cash';
}

/** Resolve accountHead + accountType from payment_mode and optional bankAccountName */
function resolveAccountHead(payment_mode, bankAccountName) {
  let accountHead = payment_mode || 'Cash';
  let accountType = 'CASH';

  if (!payment_mode) return { accountHead, accountType };

  const pm = payment_mode.toLowerCase();
  if (pm.includes('bank')) {
    accountType = 'BANK';
    if (bankAccountName) accountHead = bankAccountName;
  } else if (pm.includes('cash')) {
    accountType = 'CASH';
  } else if (pm.includes('cheque') || pm.includes('neft') || pm.includes('rtgs') || pm.includes('upi')) {
    accountType = 'BANK';
  }

  return { accountHead, accountType };
}

/* ── CREATE VOUCHER ──────────────────────────────────────────────────────── */

export const createVoucher = async (req, res) => {
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'VOUCHER_CREATE');
  if (!firmId) return;

  const { voucher_type, party_id, amount, payment_mode, narration, transaction_date, bank_account_id } = req.body;

  if (!voucher_type || !['PAYMENT', 'RECEIPT'].includes(voucher_type.toUpperCase())) {
    return res.status(400).json({ error: 'Valid voucher_type (PAYMENT/RECEIPT) is required' });
  }

  if (!party_id || !mongoose.Types.ObjectId.isValid(party_id)) {
    return res.status(400).json({ error: 'Valid party_id (MongoDB ObjectId) is required' });
  }

  const validatedAmount = parseFloat(amount);
  if (!amount || !isFinite(validatedAmount) || validatedAmount <= 0) {
    return res.status(400).json({ error: 'Valid positive amount is required' });
  }

  // Validate party belongs to firm
  const party = await Party.findOne({ _id: party_id, firm_id: firmId }).lean();
  if (!party) return res.status(403).json({ error: 'Party does not belong to your firm' });

  // TODO: BankAccount model not yet created — bank_account_id validation is skipped.
  // Once a BankAccount Mongoose model exists, add:
  //   const bankAccount = await BankAccount.findOne({ _id: bank_account_id, firm_id: firmId });
  let bankAccountName = null;
  if (payment_mode?.toLowerCase().includes('bank') && bank_account_id) {
    // bankAccountName = `${bankAccount.bank_name} - ${bankAccount.account_number.slice(0, 4)}XXXX`;
    console.warn('[VOUCHER_CREATE] bank_account_id provided but BankAccount model not yet available — skipping validation');
  }

  let voucherNo;
  try {
    voucherNo = await getNextVoucherNumber(firmId, voucher_type.toUpperCase());
    console.log(`[VOUCHER_CREATE] Generated: ${voucherNo}`);
  } catch (err) {
    return res.status(500).json({ error: `Failed to generate voucher number: ${err.message}` });
  }

  try {
    const finalVoucherType     = voucher_type.toUpperCase();
    const finalTransactionDate = transaction_date || now().split('T')[0];
    const voucherId            = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
    const partyName            = party.firm || `Party-${party_id}`;
    const { accountHead, accountType } = resolveAccountHead(payment_mode, bankAccountName);

    const base = {
      firm_id:          firmId,
      voucher_id:       voucherId,
      voucher_type:     finalVoucherType,
      voucher_no:       voucherNo,
      party_id,
      transaction_date: finalTransactionDate,
      created_by:       actorUsername,
      bill_id:          null,
      stock_id:         null,
      stock_reg_id:     null,
    };

    let docs;
    if (finalVoucherType === 'RECEIPT') {
      // Dr Cash/Bank, Cr Party
      docs = [
        { ...base, account_head: accountHead, account_type: accountType, debit_amount: validatedAmount, credit_amount: 0, narration: `Receipt from ${partyName} - ${voucherNo}` },
        { ...base, account_head: partyName,   account_type: 'DEBTOR',    debit_amount: 0,               credit_amount: validatedAmount, narration: `Receipt from ${partyName} - ${voucherNo}` },
      ];
    } else {
      // Dr Party, Cr Cash/Bank
      docs = [
        { ...base, account_head: partyName,   account_type: 'CREDITOR',  debit_amount: validatedAmount, credit_amount: 0,               narration: `Payment to ${partyName} - ${voucherNo}` },
        { ...base, account_head: accountHead, account_type: accountType, debit_amount: 0,               credit_amount: validatedAmount, narration: `Payment to ${partyName} - ${voucherNo}` },
      ];
    }

    await Ledger.insertMany(docs);

    res.json({ message: `${finalVoucherType} voucher created successfully`, voucherId, voucherNo });
  } catch (err) {
    console.error('[VOUCHER_CREATE] Error:', err);
    res.status(500).json({ error: 'Failed to create voucher: ' + err.message });
  }
};

/* ── UPDATE VOUCHER ──────────────────────────────────────────────────────── */

export const updateVoucher = async (req, res) => {
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'VOUCHER_UPDATE');
  if (!firmId) return;

  const voucherId = parseInt(req.params.id);
  if (isNaN(voucherId) || voucherId <= 0) return res.status(400).json({ error: 'Invalid voucher ID' });

  const { voucher_type, party_id, amount, payment_mode, narration, transaction_date, bank_account_id } = req.body;

  if (!voucher_type || !['PAYMENT', 'RECEIPT'].includes(voucher_type.toUpperCase())) {
    return res.status(400).json({ error: 'Valid voucher_type (PAYMENT/RECEIPT) is required' });
  }
  if (!party_id || !mongoose.Types.ObjectId.isValid(party_id)) {
    return res.status(400).json({ error: 'Valid party_id (MongoDB ObjectId) is required' });
  }
  const validatedAmount = parseFloat(amount);
  if (!amount || !isFinite(validatedAmount) || validatedAmount <= 0) {
    return res.status(400).json({ error: 'Valid positive amount is required' });
  }

  try {
    // Check voucher exists
    const existing = await Ledger.findOne({
      voucher_id: voucherId,
      firm_id:    firmId,
      voucher_type: { $in: ['PAYMENT', 'RECEIPT'] },
    }).lean();
    if (!existing) return res.status(404).json({ error: 'Voucher not found or does not belong to your firm' });

    const voucherNo = existing.voucher_no;

    // Validate party
    const party = await Party.findOne({ _id: party_id, firm_id: firmId }).lean();
    if (!party) return res.status(403).json({ error: 'Party does not belong to your firm' });

    // TODO: bank_account_id — same stub as createVoucher
    let bankAccountName = null;

    const finalVoucherType     = voucher_type.toUpperCase();
    const finalTransactionDate = transaction_date || now().split('T')[0];
    const partyName            = party.firm || `Party-${party_id}`;
    const { accountHead, accountType } = resolveAccountHead(payment_mode, bankAccountName);

    // Delete old lines, insert new
    await Ledger.deleteMany({ voucher_id: voucherId, firm_id: firmId });

    const base = {
      firm_id:          firmId,
      voucher_id:       voucherId,
      voucher_type:     finalVoucherType,
      voucher_no:       voucherNo,
      party_id,
      transaction_date: finalTransactionDate,
      created_by:       actorUsername,
      bill_id:          null,
      stock_id:         null,
      stock_reg_id:     null,
    };

    let docs;
    if (finalVoucherType === 'RECEIPT') {
      docs = [
        { ...base, account_head: accountHead, account_type: accountType, debit_amount: validatedAmount, credit_amount: 0,               narration: narration || `Receipt from ${partyName} - ${voucherNo}` },
        { ...base, account_head: partyName,   account_type: 'DEBTOR',    debit_amount: 0,               credit_amount: validatedAmount, narration: narration || `Receipt from ${partyName} - ${voucherNo}` },
      ];
    } else {
      docs = [
        { ...base, account_head: partyName,   account_type: 'CREDITOR',  debit_amount: validatedAmount, credit_amount: 0,               narration: narration || `Payment to ${partyName} - ${voucherNo}` },
        { ...base, account_head: accountHead, account_type: accountType, debit_amount: 0,               credit_amount: validatedAmount, narration: narration || `Payment to ${partyName} - ${voucherNo}` },
      ];
    }

    await Ledger.insertMany(docs);

    res.json({ message: `${finalVoucherType} voucher updated successfully`, voucherId, voucherNo });
  } catch (err) {
    console.error('[VOUCHER_UPDATE] Error:', err);
    res.status(500).json({ error: 'Failed to update voucher: ' + err.message });
  }
};

/* ── GET ALL VOUCHERS (paginated) ────────────────────────────────────────── */

export const getVouchers = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'VOUCHERS_GET');
    if (!firmId) return;

    const { voucher_type, start_date, end_date, party_id, search, page = 1, limit = 10 } = req.query;

    const pageInt  = Math.max(1, parseInt(page));
    const limitInt = Math.max(1, parseInt(limit));
    if (!isFinite(pageInt) || !isFinite(limitInt)) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }

    const match = {
      firm_id:      new mongoose.Types.ObjectId(firmId), // ⚠️ must cast in aggregate
      voucher_type: { $in: ['PAYMENT', 'RECEIPT'] },
    };
    if (voucher_type && ['PAYMENT', 'RECEIPT'].includes(voucher_type.toUpperCase())) {
      match.voucher_type = voucher_type.toUpperCase();
    }
    if (start_date) match.transaction_date = { ...match.transaction_date, $gte: start_date };
    if (end_date)   match.transaction_date = { ...match.transaction_date, $lte: end_date };
    if (party_id && mongoose.Types.ObjectId.isValid(party_id)) {
      match.party_id = new mongoose.Types.ObjectId(party_id);
    }
    if (search?.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      match.$or = [{ voucher_no: regex }, { narration: regex }];
    }

    // Count
    const [countRes] = await Ledger.aggregate([
      { $match: match },
      { $group: { _id: '$voucher_id' } },
      { $count: 'total' },
    ]);
    const total = countRes?.total ?? 0;

    // Aggregate vouchers grouped by voucher_id
    const rows = await Ledger.aggregate([
      { $match: match },
      {
        $group: {
          _id:              '$voucher_id',
          voucher_id:       { $first: '$voucher_id' },
          voucher_no:       { $first: '$voucher_no' },
          voucher_type:     { $first: '$voucher_type' },
          transaction_date: { $first: '$transaction_date' },
          narration:        { $first: '$narration' },
          party_id:         { $first: '$party_id' },
          // Total of debit lines = the payment/receipt amount
          amount:           { $sum: '$debit_amount' },
          // First non-party account_head for payment mode inference
          account_head:     {
            $first: {
              $cond: [{ $eq: ['$party_id', null] }, '$account_head', '$$REMOVE'],
            },
          },
        },
      },
      { $sort: { transaction_date: -1 } },
      { $skip:  (pageInt - 1) * limitInt },
      { $limit: limitInt },
      // Lookup party name
      {
        $lookup: {
          from:         'parties',
          localField:   'party_id',
          foreignField: '_id',
          as:           'partyDoc',
        },
      },
      {
        $addFields: {
          party_name:   { $ifNull: [{ $arrayElemAt: ['$partyDoc.firm', 0] }, null] },
          payment_mode: {
            $let: {
              vars: { ah: { $ifNull: ['$account_head', ''] } },
              in:   '$$ah', // raw head — JS layer will convert to label
            },
          },
        },
      },
      { $project: { _id: 0, partyDoc: 0 } },
    ]);

    // Convert raw account_head → payment_mode label in JS
    const vouchers = rows.map(v => ({
      ...v,
      payment_mode: paymentModeFromAccountHead(v.payment_mode),
    }));

    res.json({ vouchers, total, page: pageInt, limit: limitInt, totalPages: Math.ceil(total / limitInt) });
  } catch (err) {
    console.error('[VOUCHERS_GET] Error:', err);
    res.status(500).json({ error: 'Failed to fetch vouchers: ' + err.message });
  }
};

/* ── GET VOUCHER BY ID ───────────────────────────────────────────────────── */

export const getVoucherById = async (req, res) => {
  try {
    const firmId    = getFirmId(req, res, 'VOUCHER_GET_BY_ID');
    if (!firmId) return;

    const voucherId = parseInt(req.params.id);
    if (isNaN(voucherId) || voucherId <= 0) return res.status(400).json({ error: 'Invalid voucher ID' });

    const entries = await Ledger.find({
      voucher_id:   voucherId,
      firm_id:      firmId,
      voucher_type: { $in: ['PAYMENT', 'RECEIPT'] },
    }).sort({ createdAt: 1 }).lean();

    if (!entries.length) return res.status(404).json({ error: 'Voucher not found or does not belong to your firm' });

    const first  = entries[0];
    let amount   = 0;
    let rawHead  = null;

    for (const e of entries) {
      if (e.debit_amount > 0) amount += e.debit_amount;
      if (!e.party_id && e.account_head) rawHead = e.account_head;
    }

    // Get party name
    let partyName = `Party-${first.party_id}`;
    if (first.party_id) {
      const p = await Party.findOne({ _id: first.party_id, firm_id: firmId }).select('firm').lean();
      if (p) partyName = p.firm;
    }

    res.json({
      voucher_id:       first.voucher_id,
      voucher_type:     first.voucher_type,
      voucher_no:       first.voucher_no,
      transaction_date: first.transaction_date,
      narration:        first.narration,
      party_id:         first.party_id,
      party_name:       partyName,
      amount,
      payment_mode:     paymentModeFromAccountHead(rawHead),
      created_at:       first.createdAt,
      updated_at:       first.updatedAt,
    });
  } catch (err) {
    console.error('[VOUCHER_GET_BY_ID] Error:', err);
    res.status(500).json({ error: 'Failed to fetch voucher: ' + err.message });
  }
};

/* ── GET VOUCHERS BY PARTY ───────────────────────────────────────────────── */

export const getVouchersByParty = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'VOUCHERS_GET_BY_PARTY');
    if (!firmId) return;

    const { partyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(partyId)) {
      return res.status(400).json({ error: 'Invalid party ID' });
    }

    const vouchers = await Ledger.find({
      party_id:     partyId,
      firm_id:      firmId,
      voucher_type: { $in: ['PAYMENT', 'RECEIPT'] },
    }).sort({ transaction_date: -1, createdAt: -1 }).lean();

    res.json(vouchers);
  } catch (err) {
    console.error('[VOUCHERS_GET_BY_PARTY] Error:', err);
    res.status(500).json({ error: 'Failed to fetch vouchers: ' + err.message });
  }
};

/* ── VOUCHER SUMMARY ─────────────────────────────────────────────────────── */

export const getVoucherSummary = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'VOUCHER_SUMMARY');
    if (!firmId) return;

    const fid = new mongoose.Types.ObjectId(firmId); // ⚠️ aggregate needs ObjectId

    const [totals] = await Ledger.aggregate([
      { $match: { firm_id: fid, voucher_type: { $in: ['PAYMENT', 'RECEIPT'] } } },
      {
        $group: {
          _id:            null,
          total_receipts: { $sum: { $cond: [{ $eq: ['$voucher_type', 'RECEIPT'] }, '$debit_amount',  0] } },
          total_payments: { $sum: { $cond: [{ $eq: ['$voucher_type', 'PAYMENT'] }, '$credit_amount', 0] } },
        },
      },
    ]);

    const totalReceipts = totals?.total_receipts ?? 0;
    const totalPayments = totals?.total_payments ?? 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const recentCount = await Ledger.countDocuments({
      firm_id:          firmId,
      voucher_type:     { $in: ['PAYMENT', 'RECEIPT'] },
      transaction_date: { $gte: dateStr },
    });

    res.json({
      total_receipts:           totalReceipts,
      total_payments:           totalPayments,
      net_position:             totalReceipts - totalPayments,
      recent_transactions_count: recentCount,
    });
  } catch (err) {
    console.error('[VOUCHER_SUMMARY] Error:', err);
    res.status(500).json({ error: 'Failed to fetch voucher summary: ' + err.message });
  }
};
