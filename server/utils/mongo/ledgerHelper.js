/**
 * Ledger Helper Utility — Mongoose version
 * Handles automatic ledger posting from bills and vouchers.
 * Replaces raw SQLite db.prepare() calls with Mongoose model operations.
 */

import mongoose from 'mongoose';
import { Ledger } from '../../../server/models/index.js';

/* ─────────────────────────────────────────────
   PUBLIC API
───────────────────────────────────────────── */

/**
 * Auto-post a bill to the ledger (double-entry bookkeeping).
 * Runs inside a Mongoose session transaction.
 *
 * @param {Object} bill     - Bill document (Mongoose doc or plain object)
 * @param {'SALES'|'PURCHASE'|'CREDIT_NOTE'|'DEBIT_NOTE'} billType
 * @param {mongoose.ClientSession} [session] - Optional external session
 * @returns {Promise<mongoose.Document[]>} Created ledger entries
 */
export async function postBillToLedger(bill, billType, session) {
  const narration = `${billType} Bill No: ${bill.bno} - ${bill.supply}`;
  const ownSession = !session;
  if (ownSession) session = await mongoose.startSession();

  try {
    if (ownSession) session.startTransaction();
    const entries = [];

    if (billType === 'SALES') {
      // Dr  Party (Sundry Debtors) ← net total
      entries.push(_entry({ bill, date: bill.bdate, account: bill.supply, type: 'SUNDRY_DEBTORS',  dr: bill.ntot, cr: 0, narration }));
      // Cr  Sales Account          ← gross total
      entries.push(_entry({ bill, date: bill.bdate, account: 'Sales',     type: 'SALES',           dr: 0, cr: bill.gtot, narration }));
      if (bill.cgst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'CGST Output', type: 'DUTIES_TAXES', dr: 0, cr: bill.cgst, narration }));
      if (bill.sgst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'SGST Output', type: 'DUTIES_TAXES', dr: 0, cr: bill.sgst, narration }));
      if (bill.igst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'IGST Output', type: 'DUTIES_TAXES', dr: 0, cr: bill.igst, narration }));

    } else if (billType === 'PURCHASE') {
      // Dr  Purchase Account ← gross total
      entries.push(_entry({ bill, date: bill.bdate, account: 'Purchase', type: 'PURCHASE',          dr: bill.gtot, cr: 0,        narration }));
      if (bill.cgst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'CGST Input', type: 'DUTIES_TAXES', dr: bill.cgst, cr: 0, narration }));
      if (bill.sgst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'SGST Input', type: 'DUTIES_TAXES', dr: bill.sgst, cr: 0, narration }));
      if (bill.igst > 0) entries.push(_entry({ bill, date: bill.bdate, account: 'IGST Input', type: 'DUTIES_TAXES', dr: bill.igst, cr: 0, narration }));
      // Cr  Party (Sundry Creditors) ← net total
      entries.push(_entry({ bill, date: bill.bdate, account: bill.supply, type: 'SUNDRY_CREDITORS', dr: 0, cr: bill.ntot, narration }));
    }

    const created = await Ledger.insertMany(entries, { session });
    if (ownSession) await session.commitTransaction();
    return created;

  } catch (err) {
    if (ownSession) await session.abortTransaction();
    throw err;
  } finally {
    if (ownSession) session.endSession();
  }
}

/**
 * Auto-post a voucher to the ledger.
 *
 * @param {Object} voucher  - Voucher document
 * @param {mongoose.ClientSession} [session]
 * @returns {Promise<mongoose.Document[]>} Created ledger entries
 */
export async function postVoucherToLedger(voucher, session) {
  const narration  = `${voucher.voucher_type} Voucher No: ${voucher.voucher_no} - ${voucher.narration ?? ''}`;
  const ownSession = !session;
  if (ownSession) session = await mongoose.startSession();

  try {
    if (ownSession) session.startTransaction();
    const entries = [];
    const base    = { firm_id: voucher.firm_id, transaction_date: voucher.voucher_date, voucher_type: voucher.voucher_type, voucher_no: voucher.voucher_no };

    if (voucher.voucher_type === 'PAYMENT') {
      // Cr  Bank/Cash (source)
      entries.push({ ...base, account_head: voucher.paid_from_account, account_type: voucher.paid_from_type,  debit_amount: 0,               credit_amount: voucher.amount, narration });
      // Dr  Expense/Party (destination)
      entries.push({ ...base, account_head: voucher.paid_to_account,   account_type: voucher.paid_to_type,    debit_amount: voucher.amount,  credit_amount: 0,              narration });

    } else if (voucher.voucher_type === 'RECEIPT') {
      // Dr  Bank/Cash (destination)
      entries.push({ ...base, account_head: voucher.received_in_account,   account_type: voucher.received_in_type,   debit_amount: voucher.amount, credit_amount: 0,             narration });
      // Cr  Income/Party (source)
      entries.push({ ...base, account_head: voucher.received_from_account, account_type: voucher.received_from_type, debit_amount: 0,              credit_amount: voucher.amount, narration });

    } else if (voucher.voucher_type === 'JOURNAL') {
      const lines = JSON.parse(voucher.journal_entries || '[]');
      for (const line of lines) {
        entries.push({
          ...base,
          account_head:   line.account_name,
          account_type:   line.account_type,
          debit_amount:   line.debit  ?? 0,
          credit_amount:  line.credit ?? 0,
          narration:      line.narration ?? narration,
        });
      }
    }

    const created = await Ledger.insertMany(entries, { session });
    if (ownSession) await session.commitTransaction();
    return created;

  } catch (err) {
    if (ownSession) await session.abortTransaction();
    throw err;
  } finally {
    if (ownSession) session.endSession();
  }
}

/**
 * Create a single ledger entry
 * @param {Object} params
 * @returns {Promise<mongoose.Document>}
 */
export async function createLedgerEntry({ firmId, date, accountName, accountType, debit, credit, narration, session }) {
  const doc = new Ledger({
    firm_id:          firmId,
    transaction_date: date,
    account_head:     accountName,
    account_type:     accountType,
    debit_amount:     debit,
    credit_amount:    credit,
    narration,
  });
  return session ? doc.save({ session }) : doc.save();
}

/**
 * Reverse all ledger entries for a given bill_id or voucher reference.
 * Creates mirror entries with Dr/Cr swapped and prefixes narration with "REVERSAL: ".
 *
 * @param {{ bill_id?: ObjectId, voucher_type?: string, voucher_no?: string, firm_id: ObjectId }} filter
 * @param {mongoose.ClientSession} [session]
 * @returns {Promise<mongoose.Document[]>}
 */
export async function reverseLedgerEntries(filter, session) {
  const query = { firm_id: filter.firm_id };
  if (filter.bill_id)     query.bill_id      = filter.bill_id;
  if (filter.voucher_no)  query.voucher_no   = filter.voucher_no;
  if (filter.voucher_type) query.voucher_type = filter.voucher_type;

  const originals = await Ledger.find(query).lean().session(session ?? null);

  const reversals = originals.map(e => ({
    firm_id:          e.firm_id,
    transaction_date: e.transaction_date,
    account_head:     e.account_head,
    account_type:     e.account_type,
    debit_amount:     e.credit_amount,   // swap
    credit_amount:    e.debit_amount,    // swap
    narration:        `REVERSAL: ${e.narration}`,
    voucher_type:     e.voucher_type,
    voucher_no:       e.voucher_no,
    bill_id:          e.bill_id,
    party_id:         e.party_id,
  }));

  return Ledger.insertMany(reversals, { session: session ?? undefined });
}

/**
 * Get debit/credit balance for a specific account head within a firm.
 *
 * @param {ObjectId|string} firmId
 * @param {string}          accountName
 * @param {string}          [toDate]  - ISO date string upper bound (inclusive)
 * @returns {Promise<{ totalDebit, totalCredit, balance, balanceType, balanceAmount }>}
 */
export async function getAccountBalance(firmId, accountName, toDate = null) {
  const match = { firm_id: new mongoose.Types.ObjectId(firmId), account_head: accountName };
  if (toDate) match.transaction_date = { $lte: toDate };

  const [result] = await Ledger.aggregate([
    { $match: match },
    {
      $group: {
        _id:          null,
        totalDebit:   { $sum: '$debit_amount' },
        totalCredit:  { $sum: '$credit_amount' },
      },
    },
  ]);

  const totalDebit  = result?.totalDebit  ?? 0;
  const totalCredit = result?.totalCredit ?? 0;
  const balance     = totalDebit - totalCredit;

  return {
    totalDebit,
    totalCredit,
    balance,
    balanceType:   balance >= 0 ? 'Dr' : 'Cr',
    balanceAmount: Math.abs(balance),
  };
}

/**
 * Get trial balance for a firm over a date range.
 *
 * @param {ObjectId|string} firmId
 * @param {string}          fromDate  - YYYY-MM-DD
 * @param {string}          toDate    - YYYY-MM-DD
 * @returns {Promise<Array<{ accountName, accountType, debit, credit }>>}
 */
export async function getTrialBalance(firmId, fromDate, toDate) {
  // Get every account head that has activity in the period
  const accounts = await Ledger.aggregate([
    {
      $match: {
        firm_id: new mongoose.Types.ObjectId(firmId),
        transaction_date: { $gte: fromDate, $lte: toDate },
      },
    },
    {
      $group: {
        _id:          { account_head: '$account_head', account_type: '$account_type' },
      },
    },
    { $sort: { '_id.account_type': 1, '_id.account_head': 1 } },
  ]);

  // For each account get the running balance up to toDate
  const rows = await Promise.all(
    accounts.map(async ({ _id }) => {
      const bal = await getAccountBalance(firmId, _id.account_head, toDate);
      return {
        accountName: _id.account_head,
        accountType: _id.account_type,
        debit:  bal.balanceType === 'Dr' ? bal.balanceAmount : 0,
        credit: bal.balanceType === 'Cr' ? bal.balanceAmount : 0,
      };
    })
  );

  return rows;
}

/* ─────────────────────────────────────────────
   PRIVATE HELPERS
───────────────────────────────────────────── */

/**
 * Build a plain ledger entry object for insertMany
 */
function _entry({ bill, date, account, type, dr, cr, narration }) {
  return {
    firm_id:          bill.firm_id,
    transaction_date: date,
    account_head:     account,
    account_type:     type,
    debit_amount:     dr,
    credit_amount:    cr,
    narration,
    bill_id:          bill._id ?? bill.id ?? null,
    party_id:         bill.party_id ?? null,
  };
}
