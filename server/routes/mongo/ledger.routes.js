import express from 'express';
import { authMiddleware } from '../../middleware/mongo/authMiddleware.js';
import * as ledgerController from '../../controllers/mongo/ledger/ledgerController.js';
import * as journalEntryController from '../../controllers/mongo/ledger/journalEntryController.js';
import * as voucherController from '../../controllers/mongo/ledger/voucherController.js';

const router = express.Router();

// Ledger routes
router.get('/accounts', authMiddleware, ledgerController.getLedgerAccounts);
router.get('/account/:account_head', authMiddleware, ledgerController.getAccountDetails);
router.get('/account-types', authMiddleware, ledgerController.getAccountTypeSummaries);
router.get('/suggestions', authMiddleware, ledgerController.getAccountSuggestions);

// PDF Export routes
router.get('/export/account-ledger/:account_head', authMiddleware, ledgerController.exportAccountLedgerPdf);
router.get('/export/general-ledger', authMiddleware, ledgerController.exportGeneralLedgerPdf);
router.get('/export/trial-balance', authMiddleware, ledgerController.exportTrialBalancePdf);
router.post('/export/account-type', authMiddleware, ledgerController.exportAccountTypePdf);

// Journal Entry routes
router.post('/journal-entries', authMiddleware, journalEntryController.createJournalEntry);
router.get('/journal-entries', authMiddleware, journalEntryController.getJournalEntries);
router.get('/journal-entries/:id', authMiddleware, journalEntryController.getJournalEntryById);
router.put('/journal-entries/:id', authMiddleware, journalEntryController.updateJournalEntry);
router.delete('/journal-entries/:id', authMiddleware, journalEntryController.deleteJournalEntry);
router.get('/journal-entries-summary', authMiddleware, journalEntryController.getJournalEntrySummary);

// Voucher routes
router.post('/vouchers', authMiddleware, voucherController.createVoucher);
router.get('/vouchers', authMiddleware, voucherController.getVouchers);
router.get('/vouchers/:id', authMiddleware, voucherController.getVoucherById);
router.get('/vouchers/party/:partyId', authMiddleware, voucherController.getVouchersByParty);
router.put('/vouchers/:id', authMiddleware, voucherController.updateVoucher);
router.get('/vouchers-summary', authMiddleware, voucherController.getVoucherSummary);

export default router;
