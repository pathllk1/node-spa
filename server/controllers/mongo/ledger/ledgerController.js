

import mongoose from 'mongoose';
import { Ledger, Firm } from '../../../models/index.js';
export { exportAccountLedgerPdf, exportGeneralLedgerPdf, exportTrialBalancePdf, exportAccountTypePdf }
  from './pdfMakeController.js';

/* ── GET LEDGER ACCOUNTS (grouped summary per account_head) ──────────── */

export const getLedgerAccounts = async (req, res) => {
  try {
    if (!req.user?.firm_id) {
      return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    // ⚠️ Must cast firm_id to ObjectId inside aggregate $match
    const fid = new mongoose.Types.ObjectId(req.user.firm_id);

    const accounts = await Ledger.aggregate([
      { $match: { firm_id: fid } },
      {
        $group: {
          _id:          { account_head: '$account_head', account_type: '$account_type' },
          total_debit:  { $sum: '$debit_amount'  },
          total_credit: { $sum: '$credit_amount' },
        },
      },
      {
        $project: {
          _id:          0,
          account_head: '$_id.account_head',
          account_type: '$_id.account_type',
          total_debit:  1,
          total_credit: 1,
          balance:      { $subtract: ['$total_debit', '$total_credit'] },
        },
      },
      { $sort: { account_head: 1 } },
    ]);

    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ── GET ACCOUNT DETAILS (individual ledger rows, ASC for running balance) */

export const getAccountDetails = async (req, res) => {
  try {
    const { account_head }        = req.params;
    const { start_date, end_date } = req.query;

    if (!req.user?.firm_id) {
      return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    // Ledger.find() auto-casts firm_id string → ObjectId
    const filter = { firm_id: req.user.firm_id, account_head };
    if (start_date) filter.transaction_date = { ...filter.transaction_date, $gte: start_date };
    if (end_date)   filter.transaction_date = { ...filter.transaction_date, $lte: end_date };

    // ✅ Sort ASC so the frontend can compute running balance oldest → newest
    const records = await Ledger.find(filter)
      .sort({ transaction_date: 1, createdAt: 1 })
      .lean();

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ── GET ACCOUNT TYPE SUMMARIES ──────────────────────────────────────── */

export const getAccountTypeSummaries = async (req, res) => {
  try {
    if (!req.user?.firm_id) {
      return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    const fid = new mongoose.Types.ObjectId(req.user.firm_id); // ⚠️ cast for aggregate

    const summaries = await Ledger.aggregate([
      { $match: { firm_id: fid } },
      // First group by account_head to get per-account totals
      {
        $group: {
          _id:          { account_head: '$account_head', account_type: '$account_type' },
          total_debit:  { $sum: '$debit_amount'  },
          total_credit: { $sum: '$credit_amount' },
        },
      },
      // Then group by account_type to summarise
      {
        $group: {
          _id:           '$_id.account_type',
          account_count: { $sum: 1 },
          total_debit:   { $sum: '$total_debit'  },
          total_credit:  { $sum: '$total_credit' },
          total_balance: { $sum: { $subtract: ['$total_debit', '$total_credit'] } },
        },
      },
      {
        $project: {
          _id:           0,
          account_type:  '$_id',
          account_count: 1,
          total_debit:   1,
          total_credit:  1,
          total_balance: 1,
        },
      },
      { $sort: { account_type: 1 } },
    ]);

    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ── GET ACCOUNT SUGGESTIONS (autocomplete) ──────────────────────────── */

export const getAccountSuggestions = async (req, res) => {
  try {
    if (!req.user?.firm_id) {
      return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    const { q } = req.query;

    const fid = new mongoose.Types.ObjectId(req.user.firm_id); // ⚠️ cast for aggregate

    const matchStage = { firm_id: fid };
    if (q?.trim()) {
      matchStage.account_head = { $regex: q.trim(), $options: 'i' };
    }

    const suggestions = await Ledger.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id:          { account_head: '$account_head', account_type: '$account_type' },
        },
      },
      {
        $project: {
          _id:          0,
          account_head: '$_id.account_head',
          account_type: '$_id.account_type',
        },
      },
      { $sort:  { account_head: 1 } },
      { $limit: 20 },
    ]);

    res.json(suggestions);
  } catch (err) {
    console.error('[ACCOUNT_SUGGESTIONS] Error:', err);
    res.status(500).json({ error: err.message });
  }
};
