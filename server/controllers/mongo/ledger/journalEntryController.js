/**
 * Journal Entry Controller — Mongoose version
 *
 * Key changes from the SQLite version:
 *  - db.prepare() SQL replaced with Mongoose Ledger model queries
 *  - getNextVoucherNumber reimplemented using BillSequence model (no billNumberGenerator.js
 *    mongo equivalent exists yet — logic is inlined via findOneAndUpdate + $inc)
 *  - voucher_id stays as a generated integer (timestamp + random) — it groups multiple
 *    ledger lines that belong to the same journal entry, same as the original
 *  - Pagination uses .skip()/.limit() instead of SQL LIMIT/OFFSET
 *  - Grouping/counting uses MongoDB aggregate pipelines
 *  - $match in aggregates uses new mongoose.Types.ObjectId(firm_id) — strings are NOT
 *    auto-cast inside aggregate pipelines (unlike find/findOne)
 *  - BigInt conversion helpers removed — MongoDB never returns BigInt
 *  - firmId validation changed from Number(id) > 0 to mongoose.Types.ObjectId.isValid()
 */

import mongoose from 'mongoose';
import { Ledger, BillSequence } from '../../../models/index.js';

const now = () => new Date().toISOString();
const getActorUsername = (req) => req?.user?.username ?? null;

/* ── HELPER: generate next voucher number using BillSequence ────────────── */

async function getNextVoucherNumber(firmId, voucherType) {
  const d = new Date();
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

/* ── GUARD: validate firm_id from JWT ───────────────────────────────────── */

function getFirmId(req, res, tag) {
  const raw = req.user?.firm_id;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    console.error(`[${tag}] Invalid firm_id:`, raw);
    res.status(400).json({ error: 'Invalid or missing firm ID' });
    return null;
  }
  return raw; // keep as string — auto-cast by find/findOne; wrap for aggregate
}

/* ── CREATE JOURNAL ENTRY ────────────────────────────────────────────────── */

export const createJournalEntry = async (req, res) => {
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'JOURNAL_ENTRY_CREATE');
  if (!firmId) return;

  const { entries, narration, transaction_date } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'Journal entries array is required and cannot be empty' });
  }

  // Balanced entry validation
  const totalDebits  = entries.reduce((s, e) => s + (parseFloat(e.debit_amount)  || 0), 0);
  const totalCredits = entries.reduce((s, e) => s + (parseFloat(e.credit_amount) || 0), 0);
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    return res.status(400).json({ error: `Journal entry must be balanced. Debits: ₹${totalDebits.toFixed(2)}, Credits: ₹${totalCredits.toFixed(2)}` });
  }

  // Per-line validation
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.account_head) return res.status(400).json({ error: `Entry ${i + 1}: Account head is required` });
    if ((e.debit_amount && parseFloat(e.debit_amount) < 0) || (e.credit_amount && parseFloat(e.credit_amount) < 0)) {
      return res.status(400).json({ error: `Entry ${i + 1}: Amounts cannot be negative` });
    }
    if (parseFloat(e.debit_amount) > 0 && parseFloat(e.credit_amount) > 0) {
      return res.status(400).json({ error: `Entry ${i + 1}: An entry cannot have both debit and credit amounts` });
    }
    if (!e.debit_amount && !e.credit_amount) {
      return res.status(400).json({ error: `Entry ${i + 1}: Either debit or credit amount is required` });
    }
  }

  let journalEntryNo;
  try {
    journalEntryNo = await getNextVoucherNumber(firmId, 'JOURNAL');
    console.log(`[JOURNAL_ENTRY_CREATE] Generated: ${journalEntryNo}`);
  } catch (err) {
    return res.status(500).json({ error: `Failed to generate journal entry number: ${err.message}` });
  }

  try {
    // Integer voucher_id groups all lines of this entry together (same pattern as SQLite version)
    const journalEntryId     = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
    const finalTransactionDate = transaction_date || now().split('T')[0];

    const docs = entries.map(e => ({
      firm_id:          firmId,
      voucher_id:       journalEntryId,
      voucher_type:     'JOURNAL',
      voucher_no:       journalEntryNo,
      account_head:     e.account_head,
      account_type:     e.account_type || 'GENERAL',
      debit_amount:     parseFloat(e.debit_amount)  || 0,
      credit_amount:    parseFloat(e.credit_amount) || 0,
      narration:        e.narration || narration || `Journal Entry ${journalEntryNo}`,
      bill_id:          null,
      party_id:         null,
      stock_id:         null,
      stock_reg_id:     null,
      transaction_date: finalTransactionDate,
      created_by:       actorUsername,
    }));

    await Ledger.insertMany(docs);

    res.json({ message: 'Journal entry created successfully', journalEntryId, journalEntryNo, totalDebits, totalCredits });
  } catch (err) {
    console.error('[JOURNAL_ENTRY_CREATE] Error:', err);
    res.status(500).json({ error: 'Failed to create journal entry: ' + err.message });
  }
};

/* ── GET ALL JOURNAL ENTRIES (paginated) ────────────────────────────────── */

export const getJournalEntries = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'JOURNAL_ENTRIES_GET');
    if (!firmId) return;

    const { start_date, end_date, search, page = 1, limit = 10 } = req.query;

    const pageInt  = Math.max(1, parseInt(page));
    const limitInt = Math.max(1, parseInt(limit));
    if (!isFinite(pageInt) || !isFinite(limitInt)) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }

    // Build $match
    const match = {
      firm_id:      new mongoose.Types.ObjectId(firmId), // ⚠️ must cast in aggregate
      voucher_type: 'JOURNAL',
    };
    if (start_date)          match.transaction_date = { ...match.transaction_date, $gte: start_date };
    if (end_date)            match.transaction_date = { ...match.transaction_date, $lte: end_date };
    if (search?.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      match.$or = [{ voucher_no: regex }, { narration: regex }];
    }

    // Count distinct voucher_ids for pagination
    const countAgg = await Ledger.aggregate([
      { $match: match },
      { $group: { _id: '$voucher_id' } },
      { $count: 'total' },
    ]);
    const total = countAgg[0]?.total ?? 0;

    // Paginated list grouped by voucher_id
    const rows = await Ledger.aggregate([
      { $match: match },
      {
        $group: {
          _id:              '$voucher_id',
          voucher_id:       { $first: '$voucher_id' },
          voucher_no:       { $first: '$voucher_no' },
          transaction_date: { $first: '$transaction_date' },
          narration:        { $first: '$narration' },
          total_debit:      { $sum: '$debit_amount' },
          total_credit:     { $sum: '$credit_amount' },
        },
      },
      { $sort: { transaction_date: -1 } },
      { $skip:  (pageInt - 1) * limitInt },
      { $limit: limitInt },
      { $project: { _id: 0 } },
    ]);

    res.json({
      journalEntries: rows,
      total,
      page:       pageInt,
      limit:      limitInt,
      totalPages: Math.ceil(total / limitInt),
    });
  } catch (err) {
    console.error('[JOURNAL_ENTRIES_GET] Error:', err);
    res.status(500).json({ error: 'Failed to fetch journal entries: ' + err.message });
  }
};

/* ── GET JOURNAL ENTRY BY ID ─────────────────────────────────────────────── */

export const getJournalEntryById = async (req, res) => {
  try {
    const firmId         = getFirmId(req, res, 'JOURNAL_ENTRY_GET_BY_ID');
    if (!firmId) return;

    const journalEntryId = parseInt(req.params.id);
    if (isNaN(journalEntryId) || journalEntryId <= 0) {
      return res.status(400).json({ error: 'Invalid journal entry ID' });
    }

    // firm_id is auto-cast by find()
    const entries = await Ledger.find({
      voucher_id:   journalEntryId,
      firm_id:      firmId,
      voucher_type: 'JOURNAL',
    }).sort({ _id: 1 }).lean();

    if (entries.length === 0) {
      return res.status(404).json({ error: 'Journal entry not found or does not belong to your firm' });
    }

    res.json({ ...entries[0], entries });
  } catch (err) {
    console.error('[JOURNAL_ENTRY_GET_BY_ID] Error:', err);
    res.status(500).json({ error: 'Failed to fetch journal entry: ' + err.message });
  }
};

/* ── DELETE JOURNAL ENTRY ────────────────────────────────────────────────── */

export const deleteJournalEntry = async (req, res) => {
  try {
    const firmId         = getFirmId(req, res, 'JOURNAL_ENTRY_DELETE');
    if (!firmId) return;

    const journalEntryId = parseInt(req.params.id);
    if (isNaN(journalEntryId) || journalEntryId <= 0) {
      return res.status(400).json({ error: 'Invalid journal entry ID' });
    }

    const exists = await Ledger.findOne({ voucher_id: journalEntryId, firm_id: firmId, voucher_type: 'JOURNAL' }).lean();
    if (!exists) {
      return res.status(404).json({ error: 'Journal entry not found or does not belong to your firm' });
    }

    await Ledger.deleteMany({ voucher_id: journalEntryId, firm_id: firmId });

    res.json({ message: 'Journal entry deleted successfully', journalEntryId });
  } catch (err) {
    console.error('[JOURNAL_ENTRY_DELETE] Error:', err);
    res.status(500).json({ error: 'Failed to delete journal entry: ' + err.message });
  }
};

/* ── UPDATE JOURNAL ENTRY ────────────────────────────────────────────────── */

export const updateJournalEntry = async (req, res) => {
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'JOURNAL_ENTRY_UPDATE');
  if (!firmId) return;

  const journalEntryId = parseInt(req.params.id);
  if (isNaN(journalEntryId) || journalEntryId <= 0) {
    return res.status(400).json({ error: 'Invalid journal entry ID' });
  }

  const { entries, narration, transaction_date } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'At least one journal entry line is required' });
  }
  if (!narration)         return res.status(400).json({ error: 'Narration is required' });
  if (!transaction_date)  return res.status(400).json({ error: 'Transaction date is required' });

  try {
    const existing = await Ledger.findOne({
      voucher_id:   journalEntryId,
      firm_id:      firmId,
      voucher_type: 'JOURNAL',
    }).lean();

    if (!existing) {
      return res.status(404).json({ error: 'Journal entry not found or does not belong to your firm' });
    }

    const journalEntryNo = existing.voucher_no;

    // Validate lines
    let totalDebits = 0, totalCredits = 0;
    for (const e of entries) {
      if (!e.account_head?.trim()) return res.status(400).json({ error: 'Account head is required for all entries' });
      const dr = parseFloat(e.debit_amount)  || 0;
      const cr = parseFloat(e.credit_amount) || 0;
      if (dr < 0 || cr < 0)    return res.status(400).json({ error: 'Amounts must be positive numbers' });
      if (dr > 0 && cr > 0)    return res.status(400).json({ error: 'Each entry can be either debit or credit, not both' });
      totalDebits  += dr;
      totalCredits += cr;
    }
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return res.status(400).json({ error: 'Total debits must equal total credits' });
    }

    // Replace: delete old lines, insert new
    await Ledger.deleteMany({ voucher_id: journalEntryId, firm_id: firmId });

    const docs = entries.map(e => ({
      firm_id:          firmId,
      voucher_id:       journalEntryId,
      voucher_type:     'JOURNAL',
      voucher_no:       journalEntryNo,
      account_head:     e.account_head,
      account_type:     e.account_type || 'GENERAL',
      debit_amount:     parseFloat(e.debit_amount)  || 0,
      credit_amount:    parseFloat(e.credit_amount) || 0,
      narration:        e.narration || narration || `Journal Entry ${journalEntryNo}`,
      bill_id:          null,
      party_id:         null,
      stock_id:         null,
      stock_reg_id:     null,
      transaction_date,
      created_by:       actorUsername,
    }));

    await Ledger.insertMany(docs);

    res.json({ message: 'Journal entry updated successfully', journalEntryId, journalEntryNo, totalDebits, totalCredits });
  } catch (err) {
    console.error('[JOURNAL_ENTRY_UPDATE] Error:', err);
    res.status(500).json({ error: 'Failed to update journal entry: ' + err.message });
  }
};

/* ── SUMMARY ─────────────────────────────────────────────────────────────── */

export const getJournalEntrySummary = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'JOURNAL_ENTRY_SUMMARY');
    if (!firmId) return;

    const fid = new mongoose.Types.ObjectId(firmId); // needed for aggregate

    const [totalResult] = await Ledger.aggregate([
      { $match: { firm_id: fid, voucher_type: 'JOURNAL' } },
      { $group: { _id: '$voucher_id' } },
      { $count: 'total' },
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const [recentResult] = await Ledger.aggregate([
      { $match: { firm_id: fid, voucher_type: 'JOURNAL', transaction_date: { $gte: dateStr } } },
      { $group: { _id: '$voucher_id' } },
      { $count: 'total' },
    ]);

    res.json({
      total_journal_entries:        totalResult?.total  ?? 0,
      recent_journal_entries_count: recentResult?.total ?? 0,
    });
  } catch (err) {
    console.error('[JOURNAL_ENTRY_SUMMARY] Error:', err);
    res.status(500).json({ error: 'Failed to fetch journal entry summary: ' + err.message });
  }
};
