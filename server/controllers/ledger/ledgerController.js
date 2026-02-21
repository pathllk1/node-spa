import { Firm, db } from '../../utils/db.js';
// Export the functions from the pdfMakeController
import { exportAccountLedgerPdf, exportGeneralLedgerPdf, exportTrialBalancePdf, exportAccountTypePdf } from './pdfMakeController.js';

// Helper to get current ISO time
const now = () => new Date().toISOString();

export const renderLedgerPage = async (req, res) => {
    try {
        let firmName = '';
        if (req.user && req.user.firm_id) {
            const firmStmt = db.prepare('SELECT name FROM firms WHERE id = ?');
            const firm = firmStmt.get(req.user.firm_id);
            firmName = firm ? firm.name : '';
        }
        
        res.render('ledger/ledger', { 
            title: 'General Ledger', 
            user: { 
                ...req.user, 
                firm_name: firmName 
            }
        });
    } catch (err) {
        res.status(500).render('error', { error: err.message });
    }
};

export const getLedgerAccounts = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const query = `
            SELECT 
                account_head,
                account_type,
                SUM(debit_amount) as total_debit,
                SUM(credit_amount) as total_credit,
                (SUM(debit_amount) - SUM(credit_amount)) as balance
            FROM ledger 
            WHERE firm_id = ?
            GROUP BY account_head, account_type
            ORDER BY account_head
        `;
        
        const stmt = db.prepare(query);
        const rows = stmt.all(req.user.firm_id);        
        // Convert BigInt values to numbers in accounts
        const accounts = rows.map(account => {
            const processedAccount = {};
            for (const [key, value] of Object.entries(account)) {
                if (typeof value === 'bigint') {
                    processedAccount[key] = Number(value);
                } else {
                    processedAccount[key] = value;
                }
            }
            return processedAccount;
        });
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getAccountDetails = async (req, res) => {
    try {
        const { account_head } = req.params;
        const { start_date, end_date } = req.query;
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        let query = `
            SELECT * FROM ledger 
            WHERE firm_id = ? AND account_head = ?
        `;
        
        const queryParams = [req.user.firm_id, account_head];
        
        if (start_date) {
            query += ` AND transaction_date >= ?`;
            queryParams.push(start_date);
        }
        
        if (end_date) {
            query += ` AND transaction_date <= ?`;
            queryParams.push(end_date);
        }
        
        // ✅ FIXED: Sort ASC so the frontend can calculate running balance
        //    chronologically (oldest → newest), then reverse for display (newest first).
        //    Sorting DESC caused running balance to accumulate backwards — the newest
        //    row showed the smallest balance and the oldest showed the largest.
        query += ` ORDER BY transaction_date ASC, created_at ASC`;
        
        const stmt = db.prepare(query);
        const rows = stmt.all(...queryParams);
        
        // Convert BigInt values to numbers in records
        const records = rows.map(record => {
            const processedRecord = {};
            for (const [key, value] of Object.entries(record)) {
                if (typeof value === 'bigint') {
                    processedRecord[key] = Number(value);
                } else {
                    processedRecord[key] = value;
                }
            }
            return processedRecord;
        });
        
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get account type summaries
export const getAccountTypeSummaries = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const query = `
            SELECT 
                account_type,
                COUNT(*) as account_count,
                SUM(total_debit) as total_debit,
                SUM(total_credit) as total_credit,
                SUM(balance) as total_balance
            FROM (
                SELECT 
                    account_head,
                    account_type,
                    SUM(debit_amount) as total_debit,
                    SUM(credit_amount) as total_credit,
                    (SUM(debit_amount) - SUM(credit_amount)) as balance
                FROM ledger 
                WHERE firm_id = ?
                GROUP BY account_head, account_type
            )
            GROUP BY account_type
            ORDER BY account_type
        `;
        
        const stmt = db.prepare(query);
        const rows = stmt.all(req.user.firm_id);
        
        // Convert BigInt values to numbers in summaries
        const summaries = rows.map(summary => {
            const processedSummary = {};
            for (const [key, value] of Object.entries(summary)) {
                if (typeof value === 'bigint') {
                    processedSummary[key] = Number(value);
                } else {
                    processedSummary[key] = value;
                }
            }
            return processedSummary;
        });
        
        res.json(summaries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get account suggestions for autocomplete
 * Returns account heads and their types for the current firm
 */
export const getAccountSuggestions = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const { q } = req.query; // Search term
        
        let query = `
            SELECT DISTINCT 
                account_head,
                account_type
            FROM ledger 
            WHERE firm_id = ?
        `;
        
        const queryParams = [req.user.firm_id];
        
        if (q && q.trim()) {
            query += ` AND account_head LIKE ?`;
            queryParams.push(`%${q.trim()}%`);
        }
        
        query += ` ORDER BY account_head LIMIT 20`;
        
        const stmt = db.prepare(query);
        const rows = stmt.all(...queryParams);
        
        // Convert BigInt values to numbers
        const suggestions = rows.map(suggestion => {
            const processedSuggestion = {};
            for (const [key, value] of Object.entries(suggestion)) {
                if (typeof value === 'bigint') {
                    processedSuggestion[key] = Number(value);
                } else {
                    processedSuggestion[key] = value;
                }
            }
            return processedSuggestion;
        });
        
        res.json(suggestions);
    } catch (err) {
        console.error('[ACCOUNT_SUGGESTIONS] Error:', err);
        res.status(500).json({ error: err.message });
    }
};

export { exportAccountLedgerPdf, exportGeneralLedgerPdf, exportTrialBalancePdf, exportAccountTypePdf };