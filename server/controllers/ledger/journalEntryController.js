/**
 * Journal Entry Controller for General Journal Management
 * Handles creation and management of general journal entries
 */

import { Ledger, db } from '../../utils/db.js';
import { getNextVoucherNumber } from '../../utils/billNumberGenerator.js';

// Helper to get current ISO time
const now = () => new Date().toISOString();

const getActorUsername = (req) => (req && req.user && req.user.username ? req.user.username : null);

/**
 * Create a new journal entry with multiple debit/credit lines
 * Expected payload: { entries: [{ account_head, account_type, debit_amount, credit_amount, narration }, ...], narration, transaction_date }
 */
export const createJournalEntry = async (req, res) => {
    const { entries, narration, transaction_date } = req.body;

    const actorUsername = getActorUsername(req);
    if (!actorUsername) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has firm access
    if (!req.user || !req.user.firm_id) {
        return res.status(403).json({ error: 'User is not associated with any firm' });
    }
    
    if (req.user.firm_id === undefined || req.user.firm_id === null) {
        console.error('[JOURNAL_ENTRY_CREATE] firm_id is undefined or null:', req.user);
        return res.status(400).json({ error: 'User firm association is invalid' });
    }
    
    const firmId = Number(req.user.firm_id);
    if (isNaN(firmId) || firmId <= 0) {
        console.error('[JOURNAL_ENTRY_CREATE] Invalid firmId after conversion:', req.user.firm_id);
        return res.status(400).json({ error: 'Invalid firm ID after conversion' });
    }

    // Validate required fields
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'Journal entries array is required and cannot be empty' });
    }

    // Validate that debits equal credits
    const totalDebits = entries.reduce((sum, entry) => sum + (parseFloat(entry.debit_amount) || 0), 0);
    const totalCredits = entries.reduce((sum, entry) => sum + (parseFloat(entry.credit_amount) || 0), 0);
    
    if (Math.abs(totalDebits - totalCredits) > 0.01) { // Allow small rounding differences
        return res.status(400).json({ error: `Journal entry must be balanced. Debits: ₹${totalDebits.toFixed(2)}, Credits: ₹${totalCredits.toFixed(2)}` });
    }

    // Validate each entry
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        if (!entry.account_head) {
            return res.status(400).json({ error: `Entry ${i+1}: Account head is required` });
        }
        
        if ((entry.debit_amount && parseFloat(entry.debit_amount) < 0) || 
            (entry.credit_amount && parseFloat(entry.credit_amount) < 0)) {
            return res.status(400).json({ error: `Entry ${i+1}: Amounts cannot be negative` });
        }
        
        if (entry.debit_amount && entry.credit_amount && 
            parseFloat(entry.debit_amount) > 0 && parseFloat(entry.credit_amount) > 0) {
            return res.status(400).json({ error: `Entry ${i+1}: An entry cannot have both debit and credit amounts` });
        }
        
        if (!entry.debit_amount && !entry.credit_amount) {
            return res.status(400).json({ error: `Entry ${i+1}: Either debit or credit amount is required` });
        }
    }

    // Generate journal entry number
    let journalEntryNo;
    try {
        journalEntryNo = await getNextVoucherNumber(req.user.firm_id, 'JOURNAL');
        console.log(`[JOURNAL_ENTRY_CREATE] Generated journal entry number: ${journalEntryNo}`);
    } catch (error) {
        console.error(`[JOURNAL_ENTRY_CREATE] Failed to generate journal entry number:`, error.message);
        return res.status(500).json({ error: `Failed to generate journal entry number: ${error.message}` });
    }

    // Set the generated journal entry number
    const finalTransactionDate = transaction_date || now().split('T')[0]; // Use today's date if not provided

    try {
        // Generate a journal entry ID (using timestamp-based approach)
        const journalEntryId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);

        // Create ledger entries for each line in the journal entry
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const debitAmount = parseFloat(entry.debit_amount) || 0;
            const creditAmount = parseFloat(entry.credit_amount) || 0;
            
            Ledger.create.run(
                firmId, journalEntryId, 'JOURNAL', journalEntryNo,
                entry.account_head, entry.account_type || 'GENERAL',
                debitAmount, creditAmount, 
                entry.narration || narration || `Journal Entry ${journalEntryNo}`,
                null, null, null, null,
                finalTransactionDate, actorUsername
            );
        }

        res.json({ 
            message: 'Journal entry created successfully', 
            journalEntryId,
            journalEntryNo,
            totalDebits: totalDebits,
            totalCredits: totalCredits
        });
    } catch (error) {
        console.error('[JOURNAL_ENTRY_CREATE] Error creating journal entry:', error);
        res.status(500).json({ error: 'Failed to create journal entry: ' + error.message });
    }
};

/**
 * Get all journal entries for the current firm with pagination and filtering
 */
export const getJournalEntries = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const { start_date, end_date, search, page = 1, limit = 10 } = req.query;

        // Calculate offset for pagination
        const pageInt = Number(page);
        const limitInt = Number(limit);
        
        if (!isFinite(pageInt) || !isFinite(limitInt) || pageInt <= 0 || limitInt <= 0) {
            return res.status(400).json({ error: 'Invalid pagination parameters' });
        }
        
        const offset = (Math.floor(pageInt) - 1) * Math.floor(limitInt);
        
        if (req.user.firm_id === undefined || req.user.firm_id === null) {
            console.error('[JOURNAL_ENTRIES_GET] firm_id is undefined or null:', req.user);
            return res.status(400).json({ error: 'User firm association is invalid' });
        }
        
        const firmId = Number(req.user.firm_id);
        if (isNaN(firmId) || firmId <= 0) {
            console.error('[JOURNAL_ENTRIES_GET] Invalid firmId after conversion:', req.user.firm_id);
            return res.status(400).json({ error: 'Invalid firm ID after conversion' });
        }
        
        // Build main query to get journal entries from ledger table
        let query = `SELECT DISTINCT voucher_no, voucher_id, transaction_date, narration,
                     SUM(CASE WHEN debit_amount > 0 THEN debit_amount ELSE 0 END) as total_debit,
                     SUM(CASE WHEN credit_amount > 0 THEN credit_amount ELSE 0 END) as total_credit
                     FROM ledger
                     WHERE firm_id = ? AND voucher_type = 'JOURNAL'`;
        const queryParams = [firmId];

        // Add date filters if provided
        if (start_date) {
            query += ' AND transaction_date >= ?';
            queryParams.push(start_date);
        }

        if (end_date) {
            query += ' AND transaction_date <= ?';
            queryParams.push(end_date);
        }

        // Add search functionality
        if (search && search.trim()) {
            query += ' AND (voucher_no LIKE ? OR narration LIKE ?)';
            const searchTerm = `%${search.trim()}%`;
            queryParams.push(searchTerm, searchTerm);
        }

        // Group by voucher to aggregate debit/credit totals
        query += ' GROUP BY voucher_no, voucher_id';

        // Count total records for pagination
        let countQuery = `SELECT COUNT(DISTINCT voucher_no) as count FROM ledger 
                           WHERE firm_id = ? AND voucher_type = 'JOURNAL'`;
        const countParams = [firmId];
        
        if (start_date) {
            countQuery += ' AND transaction_date >= ?';
            countParams.push(start_date);
        }
        if (end_date) {
            countQuery += ' AND transaction_date <= ?';
            countParams.push(end_date);
        }
        if (search && search.trim()) {
            countQuery += ' AND (voucher_no LIKE ? OR narration LIKE ?)';
            const searchTerm = `%${search.trim()}%`;
            countParams.push(searchTerm, searchTerm);
        }

        const countStmt = db.prepare(countQuery);
        const countResult = countStmt.get(...countParams);
        let total = countResult?.count || 0;
        if (typeof total === 'bigint') {
            total = Number(total);
        }

        // Add ordering and pagination to main query
        query += ' ORDER BY transaction_date DESC LIMIT ? OFFSET ?';
        queryParams.push(parseInt(limit), offset);

        const stmt = db.prepare(query);
        const rows = stmt.all(...queryParams);

        // Convert BigInt values to numbers in journal entries
        const journalEntries = rows.map(entry => {
            const processedEntry = {};
            for (const [key, value] of Object.entries(entry)) {
                if (typeof value === 'bigint') {
                    const numValue = Number(value);
                    if (!isFinite(numValue)) {
                        processedEntry[key] = 0;
                    } else {
                        processedEntry[key] = numValue;
                    }
                } else {
                    processedEntry[key] = value;
                }
            }
            return processedEntry;
        });

        // Safely convert page and limit parameters
        const pageNum = Number(page);
        const limitNum = Number(limit);
        
        res.json({
            journalEntries,
            total,
            page: isFinite(pageNum) ? Math.max(1, pageNum) : 1,
            limit: isFinite(limitNum) ? Math.max(1, limitNum) : 10,
            totalPages: isFinite(total) && isFinite(limitNum) && limitNum > 0 ? Math.ceil(total / limitNum) : 0
        });
    } catch (error) {
        console.error('[JOURNAL_ENTRIES_GET] Error fetching journal entries:', error);
        res.status(500).json({ error: 'Failed to fetch journal entries: ' + error.message });
    }
};

/**
 * Get a specific journal entry by ID
 */
export const getJournalEntryById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        // Validate the ID parameter
        const journalEntryId = Number(id);
        if (isNaN(journalEntryId) || journalEntryId <= 0) {
            return res.status(400).json({ error: 'Invalid journal entry ID' });
        }
        
        if (req.user.firm_id === undefined || req.user.firm_id === null) {
            console.error('[JOURNAL_ENTRY_GET_BY_ID] firm_id is undefined or null:', req.user);
            return res.status(400).json({ error: 'User firm association is invalid' });
        }
        
        const firmId = Number(req.user.firm_id);
        if (isNaN(firmId) || firmId <= 0) {
            console.error('[JOURNAL_ENTRY_GET_BY_ID] Invalid firmId after conversion:', req.user.firm_id);
            return res.status(400).json({ error: 'Invalid firm ID after conversion' });
        }

        // Get all the ledger entries for this journal entry
        const stmt = db.prepare('SELECT * FROM ledger WHERE voucher_id = ? AND firm_id = ? AND voucher_type = ? ORDER BY id');
        const ledgerEntries = stmt.all(journalEntryId, firmId, 'JOURNAL');

        if (ledgerEntries.length === 0) {
            return res.status(404).json({ error: 'Journal entry not found or does not belong to your firm' });
        }

        // Get the first entry to use as header
        const journalEntryHeader = ledgerEntries[0];

        // Convert BigInt values to numbers
        const processedHeader = {};
        for (const [key, value] of Object.entries(journalEntryHeader)) {
            if (typeof value === 'bigint') {
                const numValue = Number(value);
                // Check if the number is finite
                if (!isFinite(numValue)) {
                    processedHeader[key] = 0; // Default to 0 for non-finite values
                } else {
                    processedHeader[key] = numValue;
                }
            } else {
                processedHeader[key] = value;
            }
        }

        const processedEntries = ledgerEntries.map(entry => {
            const processedEntry = {};
            for (const [key, value] of Object.entries(entry)) {
                if (typeof value === 'bigint') {
                    const numValue = Number(value);
                    // Check if the number is finite
                    if (!isFinite(numValue)) {
                        processedEntry[key] = 0; // Default to 0 for non-finite values
                    } else {
                        processedEntry[key] = numValue;
                    }
                } else {
                    processedEntry[key] = value;
                }
            }
            return processedEntry;
        });

        res.json({
            ...processedHeader,
            entries: processedEntries
        });
    } catch (error) {
        console.error('[JOURNAL_ENTRY_GET_BY_ID] Error fetching journal entry:', error);
        res.status(500).json({ error: 'Failed to fetch journal entry: ' + error.message });
    }
};

/**
 * Delete a journal entry (soft delete by marking as cancelled)
 */
export const deleteJournalEntry = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        // Validate the ID parameter
        const journalEntryId = Number(id);
        if (isNaN(journalEntryId) || journalEntryId <= 0) {
            return res.status(400).json({ error: 'Invalid journal entry ID' });
        }
        
        if (req.user.firm_id === undefined || req.user.firm_id === null) {
            console.error('[JOURNAL_ENTRY_DELETE] firm_id is undefined or null:', req.user);
            return res.status(400).json({ error: 'User firm association is invalid' });
        }
        
        const firmId = Number(req.user.firm_id);
        if (isNaN(firmId) || firmId <= 0) {
            console.error('[JOURNAL_ENTRY_DELETE] Invalid firmId after conversion:', req.user.firm_id);
            return res.status(400).json({ error: 'Invalid firm ID after conversion' });
        }

        // Check if the journal entry exists and belongs to the firm
        const checkStmt = db.prepare('SELECT * FROM ledger WHERE voucher_id = ? AND firm_id = ? AND voucher_type = ? LIMIT 1');
        const journalEntryResult = checkStmt.get(journalEntryId, firmId, 'JOURNAL');

        if (!journalEntryResult) {
            return res.status(404).json({ error: 'Journal entry not found or does not belong to your firm' });
        }

        // Delete all related ledger entries
        const deleteStmt = db.prepare('DELETE FROM ledger WHERE voucher_id = ? AND firm_id = ?');
        deleteStmt.run(journalEntryId, firmId);

        res.json({ 
            message: 'Journal entry deleted successfully',
            journalEntryId
        });
    } catch (error) {
        console.error('[JOURNAL_ENTRY_DELETE] Error deleting journal entry:', error);
        res.status(500).json({ error: 'Failed to delete journal entry: ' + error.message });
    }
};

/**
 * Update an existing journal entry with multiple debit/credit lines
 * Expected payload: { entries: [{ account_head, account_type, debit_amount, credit_amount, narration }, ...], narration, transaction_date }
 */
export const updateJournalEntry = async (req, res) => {
    const { id } = req.params;
    const { entries, narration, transaction_date } = req.body;

    const actorUsername = getActorUsername(req);
    if (!actorUsername) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has firm access
    if (!req.user || !req.user.firm_id) {
        return res.status(403).json({ error: 'User is not associated with any firm' });
    }
    
    if (req.user.firm_id === undefined || req.user.firm_id === null) {
        console.error('[JOURNAL_ENTRY_UPDATE] firm_id is undefined or null:', req.user);
        return res.status(400).json({ error: 'User firm association is invalid' });
    }
    
    const firmId = Number(req.user.firm_id);
    if (isNaN(firmId) || firmId <= 0) {
        console.error('[JOURNAL_ENTRY_UPDATE] Invalid firmId after conversion:', req.user.firm_id);
        return res.status(400).json({ error: 'Invalid firm ID after conversion' });
    }

    // Validate the ID parameter
    const journalEntryId = Number(id);
    if (isNaN(journalEntryId) || journalEntryId <= 0) {
        return res.status(400).json({ error: 'Invalid journal entry ID' });
    }

    // Validate input data
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'At least one journal entry line is required' });
    }

    if (!narration) {
        return res.status(400).json({ error: 'Narration is required' });
    }

    if (!transaction_date) {
        return res.status(400).json({ error: 'Transaction date is required' });
    }

    try {
        // Check if the journal entry exists and belongs to the firm
        const checkStmt = db.prepare('SELECT voucher_no FROM ledger WHERE voucher_id = ? AND firm_id = ? AND voucher_type = ? LIMIT 1');
        const journalEntryResult = checkStmt.get(journalEntryId, firmId, 'JOURNAL');

        if (!journalEntryResult) {
            return res.status(404).json({ error: 'Journal entry not found or does not belong to your firm' });
        }

        const journalEntryNo = journalEntryResult.voucher_no;
        const finalTransactionDate = transaction_date;

        // Validate each entry
        let totalDebits = 0;
        let totalCredits = 0;
        
        for (const entry of entries) {
            if (!entry.account_head || !entry.account_head.trim()) {
                return res.status(400).json({ error: 'Account head is required for all entries' });
            }
            
            const debitAmount = parseFloat(entry.debit_amount) || 0;
            const creditAmount = parseFloat(entry.credit_amount) || 0;
            
            if (debitAmount < 0 || creditAmount < 0) {
                return res.status(400).json({ error: 'Amounts must be positive numbers' });
            }
            
            if (debitAmount > 0 && creditAmount > 0) {
                return res.status(400).json({ error: 'Each entry can be either debit or credit, not both' });
            }
            
            totalDebits += debitAmount;
            totalCredits += creditAmount;
        }

        // Validate that total debits equal total credits
        if (Math.abs(totalDebits - totalCredits) > 0.01) {
            return res.status(400).json({ error: 'Total debits must equal total credits' });
        }

        // Delete all existing ledger entries for this journal entry
        const deleteStmt = db.prepare('DELETE FROM ledger WHERE voucher_id = ? AND firm_id = ?');
        deleteStmt.run(journalEntryId, firmId);

        // Insert new ledger entries
        for (const entry of entries) {
            const debitAmount = parseFloat(entry.debit_amount) || 0;
            const creditAmount = parseFloat(entry.credit_amount) || 0;
            
            Ledger.create.run(
                firmId, journalEntryId, 'JOURNAL', journalEntryNo,
                entry.account_head, entry.account_type || 'GENERAL', 
                debitAmount, creditAmount, 
                entry.narration || narration || `Journal Entry ${journalEntryNo}`,
                null, null, null, null,
                finalTransactionDate, actorUsername
            );
        }

        res.json({ 
            message: 'Journal entry updated successfully', 
            journalEntryId,
            journalEntryNo,
            totalDebits: totalDebits,
            totalCredits: totalCredits
        });
    } catch (error) {
        console.error('[JOURNAL_ENTRY_UPDATE] Error updating journal entry:', error);
        res.status(500).json({ error: 'Failed to update journal entry: ' + error.message });
    }
};

/**
 * Get journal entry summary statistics for the current firm
 */
export const getJournalEntrySummary = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        // Convert firm_id to number, handling both string and number inputs
        if (req.user.firm_id === undefined || req.user.firm_id === null) {
            console.error('[JOURNAL_ENTRY_SUMMARY] firm_id is undefined or null:', req.user);
            return res.status(400).json({ error: 'User firm association is invalid' });
        }
        
        const firmId = Number(req.user.firm_id);
        if (isNaN(firmId) || firmId <= 0) {
            console.error('[JOURNAL_ENTRY_SUMMARY] Invalid firmId after conversion:', req.user.firm_id);
            return res.status(400).json({ error: 'Invalid firm ID after conversion' });
        }
        
        // Get total journal entries
        const journalEntriesStmt = db.prepare(`SELECT COUNT(DISTINCT voucher_id) as count FROM ledger 
                  WHERE firm_id = ? AND voucher_type = 'JOURNAL'`);
        const journalEntriesResult = journalEntriesStmt.get(firmId);
        
        let totalJournalEntries = 0;
        if (journalEntriesResult?.count !== null && journalEntriesResult?.count !== undefined) {
            totalJournalEntries = Number(journalEntriesResult.count);
            if (!isFinite(totalJournalEntries)) {
                totalJournalEntries = 0;
            }
        }

        // Get count of recent journal entries (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

        const recentCountStmt = db.prepare(`SELECT COUNT(DISTINCT voucher_id) as count FROM ledger 
                  WHERE firm_id = ? AND voucher_type = 'JOURNAL' AND transaction_date >= ?`);
        const recentCountResult = recentCountStmt.get(firmId, dateStr);
        
        let recentJournalEntriesCount = 0;
        if (recentCountResult?.count !== null && recentCountResult?.count !== undefined) {
            recentJournalEntriesCount = Number(recentCountResult.count);
            if (!isFinite(recentJournalEntriesCount)) {
                recentJournalEntriesCount = 0;
            }
        }

        res.json({
            total_journal_entries: totalJournalEntries,
            recent_journal_entries_count: recentJournalEntriesCount
        });
    } catch (error) {
        console.error('[JOURNAL_ENTRY_SUMMARY] Error fetching journal entry summary:', error);
        res.status(500).json({ error: 'Failed to fetch journal entry summary: ' + error.message });
    }
};