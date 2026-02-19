import express from 'express';
import {
  getEmployeesForWages,
  getExistingWagesForMonth,
  createWagesBulk,
  getWagesForMonth,
  updateWage,
  updateWagesBulk,
  deleteWage,
  deleteWagesBulk,
  getWageById
} from '../controllers/wages.controller.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

/* --------------------------------------------------
   CREATE WAGES TAB ROUTES
-------------------------------------------------- */

// Get employees eligible for wage creation (unpaid employees only)
// POST /api/wages/employees
// Body: { month: "2025-02" }
router.post('/employees', getEmployeesForWages);

// Create wages in bulk
// POST /api/wages/create
// Body: { month: "2025-02", wages: [{master_roll_id, gross_salary, wage_days, ...}] }
router.post('/create', createWagesBulk);

/* --------------------------------------------------
   MANAGE WAGES TAB ROUTES
-------------------------------------------------- */

// Get existing wage records for a month (for editing)
// GET /api/wages/manage?month=2025-02
router.get('/manage', getExistingWagesForMonth);

// Bulk update wages (must come BEFORE /:id route)
// PUT /api/wages/bulk-update
// Body: { wages: [{id, wage_days, gross_salary, ...}] }
router.put('/bulk-update', updateWagesBulk);

// Update single wage (individual edit)
// PUT /api/wages/:id
// Body: { wage_days, gross_salary, epf_deduction, ... }
router.put('/:id', updateWage);

// Delete single wage
// DELETE /api/wages/:id
router.delete('/:id', deleteWage);

// Bulk delete wages (must come BEFORE /:id route)
// DELETE /api/wages/bulk-delete
// Body: { ids: [1, 2, 3, ...] }
router.delete('/bulk-delete', deleteWagesBulk);

/* --------------------------------------------------
   UTILITY ROUTES
-------------------------------------------------- */

// Get single wage by ID (with full details)
// GET /api/wages/details/:id
router.get('/details/:id', getWageById);

// Get wages for a specific month (backward compatibility - deprecated)
// GET /api/wages/list?month=2025-02
router.get('/list', getWagesForMonth);

export default router;