import express from 'express';
import * as inventoryController from '../../controllers/inventory/sls/inventory.js';
import { generateInvoicePDF } from '../../controllers/inventory/pdfMakeController.js';
import * as firmManagementController from "../../controllers/firmManagementController.js";

const router = express.Router();

// --- STOCKS API ---
router.get('/stocks', inventoryController.getAllStocks);
router.post('/stocks', inventoryController.createStock);
router.get('/stocks/:id', inventoryController.getPartyItemHistory);
router.put('/stocks/:id', inventoryController.updateStock);
router.delete('/stocks/:id', inventoryController.deleteStock);

// --- PARTIES API ---
router.get('/parties', inventoryController.getAllParties);
router.post('/parties', inventoryController.createParty);

// --- BILLS API ---
router.post('/bills', inventoryController.createBill);
router.get('/bills/:id/pdf', generateInvoicePDF);
router.get('/bills/:id', inventoryController.getBillById);
router.get('/bills', inventoryController.getAllBills);
router.put('/bills/:id', inventoryController.updateBill);
router.delete('/bills/:id', inventoryController.cancelBill);

// --- STOCK MOVEMENTS API ---
router.get('/stock-batches', inventoryController.getStockBatches);
router.get('/stock-movements', inventoryController.getStockMovements);
router.get('/stock-movements/:stockId', inventoryController.getStockMovementsByStock);
router.post('/stock-movements', inventoryController.createStockMovement);

// --- UTILITY ENDPOINTS ---
router.get('/other-charges-types', inventoryController.getOtherChargesTypes);
router.get('/next-bill-number', inventoryController.getNextBillNumberPreviewEndpoint);
router.get('/current-firm', inventoryController.getCurrentUserFirmName);
router.get('/party-balance/:partyId', inventoryController.getPartyBalance);
router.post('/gst-lookup', inventoryController.lookupGST);
router.get('/lookup-gst', inventoryController.lookupGST);
router.get("/firm-management/firms/:id", firmManagementController.getFirm);

export default router;
