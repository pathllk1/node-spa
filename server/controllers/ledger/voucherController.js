/**
 * Voucher Controller for Payment and Receipt Management
 * Handles creation and management of manual payment/receipt vouchers
 */

import { Ledger, BillSequence, db } from '../../utils/db.js';
import { getNextVoucherNumber } from '../../utils/billNumberGenerator.js';

// Helper to get current ISO time
const now = () => new Date().toISOString();

const getActorUsername = (req) => (req && req.user && req.user.username ? req.user.username : null);

/**
 * Create a new payment or receipt voucher
 * Expected payload: { voucher_type, party_id, amount, payment_mode, narration, transaction_date }
 */
export const createVoucher = async (req, res) => {
    const { voucher_type, party_id, amount, payment_mode, narration, transaction_date, bank_account_id } = req.body;

    const actorUsername = getActorUsername(req);
    if (!actorUsername) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has firm access
    if (!req.user || !req.user.firm_id) {
        return res.status(403).json({ error: 'User is not associated with any firm' });
    }
            
    if (req.user.firm_id === undefined || req.user.firm_id === null) {
        console.error('[VOUCHER_CREATE] firm_id is undefined or null:', req.user);
        return res.status(400).json({ error: 'User firm association is invalid' });
    }
            
    const firmId = Number(req.user.firm_id);
    if (isNaN(firmId) || firmId <= 0) {
        console.error('[VOUCHER_CREATE] Invalid firmId after conversion:', req.user.firm_id);
        return res.status(400).json({ error: 'Invalid firm ID after conversion' });
    }

    // Validate required fields
    if (!voucher_type || !['PAYMENT', 'RECEIPT'].includes(voucher_type.toUpperCase())) {
        return res.status(400).json({ error: 'Valid voucher_type (PAYMENT/RECEIPT) is required' });
    }

    if (!party_id || isNaN(party_id)) {
        return res.status(400).json({ error: 'Valid party_id is required' });
    }
    
    const validatedPartyId = Number(party_id);
    if (isNaN(validatedPartyId) || validatedPartyId <= 0) {
        return res.status(400).json({ error: 'Valid positive party_id is required' });
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Valid positive amount is required' });
    }
    
    const validatedAmount = parseFloat(amount);
    if (!isFinite(validatedAmount) || validatedAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a finite positive number' });
    }

    // Validate that the party belongs to the same firm
    try {
        const partyStmt = db.prepare('SELECT id FROM parties WHERE id = ? AND firm_id = ?');
        const partyResult = partyStmt.get(validatedPartyId, firmId);
        
        if (!partyResult) {
            return res.status(403).json({ error: 'Party does not belong to your firm' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Error validating party: ' + error.message });
    }
    
    // If payment mode is Bank and bank_account_id is provided, validate the bank account
    let bankAccountName = null;
    if (payment_mode && payment_mode.toLowerCase().includes('bank') && bank_account_id) {
        try {
            const bankAccountStmt = db.prepare('SELECT id, bank_name, account_number FROM bank_accounts WHERE id = ? AND firm_id = ?');
            const bankAccount = bankAccountStmt.get(parseInt(bank_account_id), firmId);
            
            if (!bankAccount) {
                return res.status(403).json({ error: 'Bank account does not belong to your firm or does not exist' });
            }
            
            bankAccountName = `${bankAccount.bank_name} - ${bankAccount.account_number.substring(0, 4)}XXXX`;
        } catch (error) {
            return res.status(500).json({ error: 'Error validating bank account: ' + error.message });
        }
    }

    // Generate voucher number
    let voucherNo;
    try {
        voucherNo = await getNextVoucherNumber(req.user.firm_id, voucher_type.toUpperCase());
        console.log(`[VOUCHER_CREATE] Generated voucher number: ${voucherNo}`);
    } catch (error) {
        console.error(`[VOUCHER_CREATE] Failed to generate voucher number:`, error.message);
        return res.status(500).json({ error: `Failed to generate voucher number: ${error.message}` });
    }

    // Set the generated voucher number
    const finalVoucherType = voucher_type.toUpperCase();
    const finalTransactionDate = transaction_date || now().split('T')[0]; // Use today's date if not provided

    try {
        // Generate a voucher ID by inserting a placeholder ledger entry first
        // We'll use a simple approach: create the first ledger entry and get its ID
        const voucherId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);

        // B. Create Ledger Entries (Double Entry Bookkeeping)
        const ledgerBase = {
            voucher_id: voucherId,
            voucher_type: finalVoucherType,
            voucher_no: voucherNo,
            transaction_date: finalTransactionDate,
            created_by: actorUsername,
            firm_id: firmId,
            created_at: now(),
            updated_at: now()
        };

        // Use validated amount
        const finalAmount = validatedAmount;

        // Get party name for ledger entry
        const partyStmt = db.prepare('SELECT firm FROM parties WHERE id = ? AND firm_id = ?');
        const partyData = partyStmt.get(parseInt(party_id), firmId);
        const partyName = partyData?.firm || `Party-${party_id}`;

        // Get account head for payment mode (Cash/Bank)
        let accountHead = payment_mode || 'Cash'; // Default to Cash if no payment mode specified
        let accountType = 'CASH'; // Default to CASH, could be expanded to BANK, etc.

        if (payment_mode && payment_mode.toLowerCase().includes('bank')) {
            accountType = 'BANK';
            // If a specific bank account is selected, use its name
            if (bankAccountName) {
                accountHead = bankAccountName;
            }
        } else if (payment_mode && payment_mode.toLowerCase().includes('cash')) {
            accountType = 'CASH';
        } else if (payment_mode && (payment_mode.toLowerCase().includes('cheque') || 
                                   payment_mode.toLowerCase().includes('neft') || 
                                   payment_mode.toLowerCase().includes('rtgs') || 
                                   payment_mode.toLowerCase().includes('upi'))) {
            accountType = 'BANK';
        }

        if (finalVoucherType === 'RECEIPT') {
            // For Receipt: Debit Cash/Bank, Credit Party (Customer)
            // Entry 1: Debit Cash/Bank Account
            Ledger.create.run(
                firmId, voucherId, finalVoucherType, voucherNo,
                accountHead, accountType,
                finalAmount, 0, `Receipt from ${partyName} - ${voucherNo}`,
                null, validatedPartyId, null, null,
                finalTransactionDate, actorUsername
            );

            // Entry 2: Credit Party Account
            Ledger.create.run(
                firmId, voucherId, finalVoucherType, voucherNo,
                partyName, 'DEBTOR',
                0, finalAmount, `Receipt from ${partyName} - ${voucherNo}`,
                null, validatedPartyId, null, null,
                finalTransactionDate, actorUsername
            );
        } else if (finalVoucherType === 'PAYMENT') {
            // For Payment: Debit Party (Supplier), Credit Cash/Bank
            // Entry 1: Debit Party Account
            Ledger.create.run(
                firmId, voucherId, finalVoucherType, voucherNo,
                partyName, 'CREDITOR',
                finalAmount, 0, `Payment to ${partyName} - ${voucherNo}`,
                null, validatedPartyId, null, null,
                finalTransactionDate, actorUsername
            );

            // Entry 2: Credit Cash/Bank Account
            Ledger.create.run(
                firmId, voucherId, finalVoucherType, voucherNo,
                accountHead, accountType,
                0, finalAmount, `Payment to ${partyName} - ${voucherNo}`,
                null, validatedPartyId, null, null,
                finalTransactionDate, actorUsername
            );
        }

        res.json({ 
            message: `${finalVoucherType} voucher created successfully`, 
            voucherId,
            voucherNo 
        });
    } catch (error) {
        console.error('[VOUCHER_CREATE] Error creating voucher:', error);
        res.status(500).json({ error: 'Failed to create voucher: ' + error.message });
    }
};

/**
 * Update an existing voucher
 * Expected payload: { voucher_type, party_id, amount, payment_mode, narration, transaction_date, bank_account_id }
 */
export const updateVoucher = async (req, res) => {
    const { id } = req.params;
    const { voucher_type, party_id, amount, payment_mode, narration, transaction_date, bank_account_id } = req.body;

    const actorUsername = getActorUsername(req);
    if (!actorUsername) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has firm access
    if (!req.user || !req.user.firm_id) {
        return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    if (req.user.firm_id === undefined || req.user.firm_id === null) {
        console.error('[VOUCHER_UPDATE] firm_id is undefined or null:', req.user);
        return res.status(400).json({ error: 'User firm association is invalid' });
    }

    const firmId = Number(req.user.firm_id);
    if (isNaN(firmId) || firmId <= 0) {
        console.error('[VOUCHER_UPDATE] Invalid firmId after conversion:', req.user.firm_id);
        return res.status(400).json({ error: 'Invalid firm ID after conversion' });
    }

    // Validate the ID parameter
    const voucherId = Number(id);
    if (isNaN(voucherId) || voucherId <= 0) {
        return res.status(400).json({ error: 'Invalid voucher ID' });
    }

    // Validate required fields
    if (!voucher_type || !['PAYMENT', 'RECEIPT'].includes(voucher_type.toUpperCase())) {
        return res.status(400).json({ error: 'Valid voucher_type (PAYMENT/RECEIPT) is required' });
    }

    if (!party_id || isNaN(party_id)) {
        return res.status(400).json({ error: 'Valid party_id is required' });
    }

    const validatedPartyId = Number(party_id);
    if (isNaN(validatedPartyId) || validatedPartyId <= 0) {
        return res.status(400).json({ error: 'Valid positive party_id is required' });
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Valid positive amount is required' });
    }

    const validatedAmount = parseFloat(amount);
    if (!isFinite(validatedAmount) || validatedAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a finite positive number' });
    }

    // Validate that the party belongs to the same firm
    try {
        const partyStmt = db.prepare('SELECT id FROM parties WHERE id = ? AND firm_id = ?');
        const partyResult = partyStmt.get(validatedPartyId, firmId);

        if (!partyResult) {
            return res.status(403).json({ error: 'Party does not belong to your firm' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Error validating party: ' + error.message });
    }

    // Check if the voucher exists and belongs to the firm
    try {
        const checkStmt = db.prepare('SELECT voucher_no FROM ledger WHERE voucher_id = ? AND firm_id = ? AND voucher_type IN ("PAYMENT", "RECEIPT") LIMIT 1');
        const voucherResult = checkStmt.get(voucherId, firmId);

        if (!voucherResult) {
            return res.status(404).json({ error: 'Voucher not found or does not belong to your firm' });
        }

        const voucherNo = voucherResult.voucher_no;
        const finalVoucherType = voucher_type.toUpperCase();
        const finalTransactionDate = transaction_date || now().split('T')[0]; // Use today's date if not provided

        // If payment mode is Bank and bank_account_id is provided, validate the bank account
        let bankAccountName = null;
        if (payment_mode && payment_mode.toLowerCase().includes('bank') && bank_account_id) {
            try {
                const bankAccountStmt = db.prepare('SELECT id, bank_name, account_number FROM bank_accounts WHERE id = ? AND firm_id = ?');
                const bankAccount = bankAccountStmt.get(parseInt(bank_account_id), firmId);

                if (!bankAccount) {
                    return res.status(403).json({ error: 'Bank account does not belong to your firm or does not exist' });
                }

                bankAccountName = `${bankAccount.bank_name} - ${bankAccount.account_number.substring(0, 4)}XXXX`;
            } catch (error) {
                return res.status(500).json({ error: 'Error validating bank account: ' + error.message });
            }
        }

        // Delete all existing ledger entries for this voucher
        const deleteStmt = db.prepare('DELETE FROM ledger WHERE voucher_id = ? AND firm_id = ?');
        deleteStmt.run(voucherId, firmId);

        // Get account head for payment mode (Cash/Bank)
        let accountHead = payment_mode || 'Cash'; // Default to Cash if no payment mode specified
        let accountType = 'CASH'; // Default to CASH, could be expanded to BANK, etc.

        if (payment_mode && payment_mode.toLowerCase().includes('bank')) {
            accountType = 'BANK';
            // If a specific bank account is selected, use its name
            if (bankAccountName) {
                accountHead = bankAccountName;
            }
        } else if (payment_mode && payment_mode.toLowerCase().includes('cash')) {
            accountType = 'CASH';
        } else if (payment_mode && (payment_mode.toLowerCase().includes('cheque') ||
                                   payment_mode.toLowerCase().includes('neft') ||
                                   payment_mode.toLowerCase().includes('rtgs') ||
                                   payment_mode.toLowerCase().includes('upi'))) {
            accountType = 'BANK';
        }

        // Get party name for ledger entry
        const partyStmt = db.prepare('SELECT firm FROM parties WHERE id = ? AND firm_id = ?');
        const partyData = partyStmt.get(parseInt(party_id), firmId);
        const partyName = partyData?.firm || `Party-${party_id}`;

        if (finalVoucherType === 'RECEIPT') {
            // For Receipt: Debit Cash/Bank, Credit Party (Customer)
            // Entry 1: Debit Cash/Bank Account
            Ledger.create.run(
                firmId, voucherId, finalVoucherType, voucherNo,
                accountHead, accountType,
                validatedAmount, 0, narration || `Receipt from ${partyName} - ${voucherNo}`,
                null, validatedPartyId, null, null,
                finalTransactionDate, actorUsername
            );

            // Entry 2: Credit Party Account
            Ledger.create.run(
                firmId, voucherId, finalVoucherType, voucherNo,
                partyName, 'DEBTOR',
                0, validatedAmount, narration || `Receipt from ${partyName} - ${voucherNo}`,
                null, validatedPartyId, null, null,
                finalTransactionDate, actorUsername
            );
        } else if (finalVoucherType === 'PAYMENT') {
            // For Payment: Debit Party (Supplier), Credit Cash/Bank
            // Entry 1: Debit Party Account
            Ledger.create.run(
                firmId, voucherId, finalVoucherType, voucherNo,
                partyName, 'CREDITOR',
                validatedAmount, 0, narration || `Payment to ${partyName} - ${voucherNo}`,
                null, validatedPartyId, null, null,
                finalTransactionDate, actorUsername
            );

            // Entry 2: Credit Cash/Bank Account
            Ledger.create.run(
                firmId, voucherId, finalVoucherType, voucherNo,
                accountHead, accountType,
                0, validatedAmount, narration || `Payment to ${partyName} - ${voucherNo}`,
                null, validatedPartyId, null, null,
                finalTransactionDate, actorUsername
            );
        }

        res.json({
            message: `${finalVoucherType} voucher updated successfully`,
            voucherId,
            voucherNo
        });
    } catch (error) {
        console.error('[VOUCHER_UPDATE] Error updating voucher:', error);
        res.status(500).json({ error: 'Failed to update voucher: ' + error.message });
    }
};

/**
 * Get all vouchers for the current firm with pagination and filtering
 */
export const getVouchers = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        const { voucher_type, start_date, end_date, party_id, search, page = 1, limit = 10 } = req.query;

        // Calculate offset for pagination
        const pageInt = Number(page);
        const limitInt = Number(limit);
        
        if (!isFinite(pageInt) || !isFinite(limitInt) || pageInt <= 0 || limitInt <= 0) {
            return res.status(400).json({ error: 'Invalid pagination parameters' });
        }
        
        const offset = (Math.floor(pageInt) - 1) * Math.floor(limitInt);
        
        if (req.user.firm_id === undefined || req.user.firm_id === null) {
            console.error('[VOUCHERS_GET] firm_id is undefined or null:', req.user);
            return res.status(400).json({ error: 'User firm association is invalid' });
        }
        
        const firmId = Number(req.user.firm_id);
        if (isNaN(firmId) || firmId <= 0) {
            console.error('[VOUCHERS_GET] Invalid firmId after conversion:', req.user.firm_id);
            return res.status(400).json({ error: 'Invalid firm ID after conversion' });
        }
        
        // Build query to get distinct vouchers from ledger table
        let query = `SELECT DISTINCT l.voucher_no, l.voucher_id, l.voucher_type, l.transaction_date, l.narration, l.party_id,
                     SUM(CASE WHEN l.debit_amount > 0 THEN l.debit_amount ELSE 0 END) as amount,
                     p.firm as party_name,
                     (SELECT account_head FROM ledger l2 
                      WHERE l2.voucher_id = l.voucher_id 
                        AND l2.firm_id = l.firm_id 
                        AND l2.party_id IS NULL 
                        AND l2.account_head IS NOT NULL 
                      LIMIT 1) as account_head
                     FROM ledger l
                     LEFT JOIN parties p ON l.party_id = p.id AND p.firm_id = ?
                     WHERE l.firm_id = ? AND l.voucher_type IN ('PAYMENT', 'RECEIPT')`;
        const queryParams = [firmId, firmId];

        // Add filters if provided
        if (voucher_type && ['PAYMENT', 'RECEIPT'].includes(voucher_type.toUpperCase())) {
            query += ' AND voucher_type = ?';
            queryParams.push(voucher_type.toUpperCase());
        }

        if (start_date) {
            query += ' AND transaction_date >= ?';
            queryParams.push(start_date);
        }

        if (end_date) {
            query += ' AND transaction_date <= ?';
            queryParams.push(end_date);
        }

        if (party_id) {
            query += ' AND party_id = ?';
            queryParams.push(parseInt(party_id));
        }
        
        // Add search functionality
        if (search && search.trim()) {
            query += ' AND (voucher_no LIKE ? OR narration LIKE ?)';
            const searchTerm = `%${search.trim()}%`;
            queryParams.push(searchTerm, searchTerm);
        }

        // Count total records for pagination
        let countQuery = `SELECT COUNT(DISTINCT voucher_no) as count FROM ledger 
                           WHERE firm_id = ? AND voucher_type IN ('PAYMENT', 'RECEIPT')`;
        const countParams = [firmId];
        
        if (voucher_type && ['PAYMENT', 'RECEIPT'].includes(voucher_type.toUpperCase())) {
            countQuery += ' AND voucher_type = ?';
            countParams.push(voucher_type.toUpperCase());
        }
        if (start_date) {
            countQuery += ' AND transaction_date >= ?';
            countParams.push(start_date);
        }
        if (end_date) {
            countQuery += ' AND transaction_date <= ?';
            countParams.push(end_date);
        }
        if (party_id) {
            countQuery += ' AND party_id = ?';
            countParams.push(parseInt(party_id));
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
        query += ' GROUP BY voucher_no, voucher_id ORDER BY transaction_date DESC LIMIT ? OFFSET ?';
        queryParams.push(parseInt(limit), offset);

        const stmt = db.prepare(query);
        const rows = stmt.all(...queryParams);

        // Convert BigInt values to numbers in vouchers and calculate payment_mode
        const vouchers = rows.map(voucher => {
            const processedVoucher = {};
            for (const [key, value] of Object.entries(voucher)) {
                if (typeof value === 'bigint') {
                    const numValue = Number(value);
                    if (!isFinite(numValue)) {
                        processedVoucher[key] = 0;
                    } else {
                        processedVoucher[key] = numValue;
                    }
                } else {
                    processedVoucher[key] = value;
                }
            }

            // Calculate payment_mode from account_head
            let paymentMode = 'Cash'; // default
            if (processedVoucher.account_head) {
                const accountHead = processedVoucher.account_head.toLowerCase();
                if (accountHead.includes('cheque')) {
                    paymentMode = 'Cheque';
                } else if (accountHead.includes('neft')) {
                    paymentMode = 'NEFT';
                } else if (accountHead.includes('rtgs')) {
                    paymentMode = 'RTGS';
                } else if (accountHead.includes('upi')) {
                    paymentMode = 'UPI';
                } else if (accountHead.includes('transfer')) {
                    paymentMode = 'Bank Transfer';
                } else if (accountHead.includes('bank')) {
                    paymentMode = 'Bank Transfer';
                } else if (!accountHead.includes('cash')) {
                    paymentMode = 'Cash';
                }
            }
            processedVoucher.payment_mode = paymentMode;

            return processedVoucher;
        });

        // Safely convert page and limit parameters
        const pageNum = Number(page);
        const limitNum = Number(limit);
        
        res.json({
            vouchers,
            total,
            page: isFinite(pageNum) ? Math.max(1, pageNum) : 1,
            limit: isFinite(limitNum) ? Math.max(1, limitNum) : 10,
            totalPages: isFinite(total) && isFinite(limitNum) && limitNum > 0 ? Math.ceil(total / limitNum) : 0
        });
    } catch (error) {
        console.error('[VOUCHERS_GET] Error fetching vouchers:', error);
        res.status(500).json({ error: 'Failed to fetch vouchers: ' + error.message });
    }
};

/**
 * Get a specific voucher by ID
 */
export const getVoucherById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        // Validate the ID parameter
        const voucherId = Number(id);
        if (isNaN(voucherId) || voucherId <= 0) {
            return res.status(400).json({ error: 'Invalid voucher ID' });
        }
        
        if (req.user.firm_id === undefined || req.user.firm_id === null) {
            console.error('[VOUCHER_GET_BY_ID] firm_id is undefined or null:', req.user);
            return res.status(400).json({ error: 'User firm association is invalid' });
        }
        
        const firmId = Number(req.user.firm_id);
        if (isNaN(firmId) || firmId <= 0) {
            console.error('[VOUCHER_GET_BY_ID] Invalid firmId after conversion:', req.user.firm_id);
            return res.status(400).json({ error: 'Invalid firm ID after conversion' });
        }

        // Get all ledger entries for this voucher
        const stmt = db.prepare('SELECT * FROM ledger WHERE voucher_id = ? AND firm_id = ? AND voucher_type IN ("PAYMENT", "RECEIPT") ORDER BY created_at ASC');
        const ledgerEntries = stmt.all(voucherId, firmId);

        if (!ledgerEntries || ledgerEntries.length === 0) {
            return res.status(404).json({ error: 'Voucher not found or does not belong to your firm' });
        }

        // Aggregate the data like getVouchers does
        const firstEntry = ledgerEntries[0];
        let amount = 0;
        let paymentMode = 'Cash'; // default

        // Calculate total amount and extract payment mode
        for (const entry of ledgerEntries) {
            if (entry.debit_amount > 0) {
                amount += Number(entry.debit_amount);
            }

            // Extract payment mode from account_head (for non-party entries)
            if (!entry.party_id && entry.account_head) {
                // Try to determine payment mode from account_head
                const accountHead = entry.account_head.toLowerCase();
                if (accountHead.includes('bank') || accountHead.includes('transfer') || accountHead.includes('neft') || accountHead.includes('rtgs') || accountHead.includes('upi') || accountHead.includes('cheque')) {
                    if (accountHead.includes('cheque')) paymentMode = 'Cheque';
                    else if (accountHead.includes('neft')) paymentMode = 'NEFT';
                    else if (accountHead.includes('rtgs')) paymentMode = 'RTGS';
                    else if (accountHead.includes('upi')) paymentMode = 'UPI';
                    else if (accountHead.includes('transfer')) paymentMode = 'Bank Transfer';
                    else paymentMode = 'Bank Transfer';
                } else if (!accountHead.includes('cash')) {
                    paymentMode = 'Cash';
                }
            }
        }

        // Get party name
        const partyStmt = db.prepare('SELECT firm FROM parties WHERE id = ? AND firm_id = ?');
        const partyData = partyStmt.get(firstEntry.party_id, firmId);
        const partyName = partyData?.firm || `Party-${firstEntry.party_id}`;

        // Build response in the same format as getVouchers
        const voucherData = {
            voucher_id: firstEntry.voucher_id,
            voucher_type: firstEntry.voucher_type,
            voucher_no: firstEntry.voucher_no,
            transaction_date: firstEntry.transaction_date,
            narration: firstEntry.narration,
            party_id: firstEntry.party_id,
            party_name: partyName,
            amount: amount,
            payment_mode: paymentMode,
            created_at: firstEntry.created_at,
            updated_at: firstEntry.updated_at
        };

        res.json(voucherData);
    } catch (error) {
        console.error('[VOUCHER_GET_BY_ID] Error fetching voucher:', error);
        res.status(500).json({ error: 'Failed to fetch voucher: ' + error.message });
    }
} // Added closing brace here

/**
 * Get vouchers by party ID
 */
export const getVouchersByParty = async (req, res) => {
    try {
        const { partyId } = req.params;

        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        // Validate the partyId parameter
        const validatedPartyId = Number(partyId);
        if (isNaN(validatedPartyId) || validatedPartyId <= 0) {
            return res.status(400).json({ error: 'Invalid party ID' });
        }
        
        if (req.user.firm_id === undefined || req.user.firm_id === null) {
            console.error('[VOUCHERS_GET_BY_PARTY] firm_id is undefined or null:', req.user);
            return res.status(400).json({ error: 'User firm association is invalid' });
        }
        
        const firmId = Number(req.user.firm_id);
        if (isNaN(firmId) || firmId <= 0) {
            console.error('[VOUCHERS_GET_BY_PARTY] Invalid firmId after conversion:', req.user.firm_id);
            return res.status(400).json({ error: 'Invalid firm ID after conversion' });
        }

        const stmt = db.prepare('SELECT * FROM ledger WHERE party_id = ? AND firm_id = ? AND voucher_type IN ("PAYMENT", "RECEIPT") ORDER BY transaction_date DESC, created_at DESC');
        const rows = stmt.all(validatedPartyId, firmId);

        // Convert BigInt values to numbers in vouchers
        const vouchers = rows.map(voucher => {
            const processedVoucher = {};
            for (const [key, value] of Object.entries(voucher)) {
                if (typeof value === 'bigint') {
                    const numValue = Number(value);
                    // Check if the number is finite
                    if (!isFinite(numValue)) {
                        processedVoucher[key] = 0; // Default to 0 for non-finite values
                    } else {
                        processedVoucher[key] = numValue;
                    }
                } else {
                    processedVoucher[key] = value;
                }
            }
            return processedVoucher;
        });

        res.json(vouchers);
    } catch (error) {
        console.error('[VOUCHERS_GET_BY_PARTY] Error fetching vouchers:', error);
        res.status(500).json({ error: 'Failed to fetch vouchers: ' + error.message });
    }
};

/**
 * Get voucher summary statistics for the current firm
 */
export const getVoucherSummary = async (req, res) => {
    try {
        if (!req.user || !req.user.firm_id) {
            return res.status(403).json({ error: 'User is not associated with any firm' });
        }

        // Convert firm_id to number, handling both string and number inputs
        if (req.user.firm_id === undefined || req.user.firm_id === null) {
            console.error('[VOUCHER_SUMMARY] firm_id is undefined or null:', req.user);
            return res.status(400).json({ error: 'User firm association is invalid' });
        }
        
        const firmId = Number(req.user.firm_id);
        if (isNaN(firmId) || firmId <= 0) {
            console.error('[VOUCHER_SUMMARY] Invalid firmId after conversion:', req.user.firm_id);
            return res.status(400).json({ error: 'Invalid firm ID after conversion' });
        }
        
        // Get total receipts
        const receiptsStmt = db.prepare(`SELECT SUM(debit_amount) as total FROM ledger 
                  WHERE firm_id = ? AND voucher_type = 'RECEIPT'`);
        const receiptsResult = receiptsStmt.get(firmId);
        
        let totalReceipts = parseFloat(receiptsResult?.total || 0);
        if (!isFinite(totalReceipts)) {
            totalReceipts = 0;
        }

        // Get total payments
        const paymentsStmt = db.prepare(`SELECT SUM(credit_amount) as total FROM ledger 
                  WHERE firm_id = ? AND voucher_type = 'PAYMENT'`);
        const paymentsResult = paymentsStmt.get(firmId);
        
        let totalPayments = parseFloat(paymentsResult?.total || 0);
        if (!isFinite(totalPayments)) {
            totalPayments = 0;
        }

        // Get count of recent transactions (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

        const recentCountStmt = db.prepare(`SELECT COUNT(*) as count FROM ledger 
                  WHERE firm_id = ? AND voucher_type IN ('PAYMENT', 'RECEIPT') AND transaction_date >= ?`);
        const recentCountResult = recentCountStmt.get(firmId, dateStr);
        
        let recentTransactionsCount = 0;
        if (recentCountResult?.count !== null && recentCountResult?.count !== undefined) {
            recentTransactionsCount = Number(recentCountResult.count);
            if (!isFinite(recentTransactionsCount)) {
                recentTransactionsCount = 0;
            }
        }

        res.json({
            total_receipts: totalReceipts,
            total_payments: totalPayments,
            net_position: totalReceipts - totalPayments,
            recent_transactions_count: recentTransactionsCount
        });
    } catch (error) {
        console.error('[VOUCHER_SUMMARY] Error fetching voucher summary:', error);
        res.status(500).json({ error: 'Failed to fetch voucher summary: ' + error.message });
    }
};
