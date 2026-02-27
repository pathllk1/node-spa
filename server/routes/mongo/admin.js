import express from "express";
import bcrypt from "bcrypt";
import { db, Firm, User } from "../../utils/db.js";
import { authenticateJWT, requireRole } from "../../middleware/auth.js";
import * as firmManagementController from "../../controllers/mongo/firmManagementController.js";

const router = express.Router();

/* --------------------------------------------------
   PREPARED STATEMENTS  (SQLite – user management only)
-------------------------------------------------- */

const getAllPendingUsers = db.prepare(`
  SELECT u.*,
         CASE WHEN u.firm_id IS NOT NULL THEN f.name ELSE 'No Firm' END AS firm_name,
         CASE WHEN u.firm_id IS NOT NULL THEN f.code ELSE NULL END AS firm_code
  FROM users u
  LEFT JOIN firms f ON f.id = u.firm_id
  WHERE u.status = 'pending'
  ORDER BY u.created_at DESC
`);

const getAllUsers = db.prepare(`
  SELECT u.id, u.username, u.email, u.fullname, u.role, u.status,
         u.created_at, u.updated_at,
         CASE WHEN u.firm_id IS NOT NULL THEN f.name ELSE 'No Firm' END AS firm_name,
         CASE WHEN u.firm_id IS NOT NULL THEN f.code ELSE NULL END AS firm_code
  FROM users u
  LEFT JOIN firms f ON f.id = u.firm_id
  WHERE u.role != 'super_admin'
  ORDER BY u.created_at DESC
`);

/* --------------------------------------------------
   USER MANAGEMENT ROUTES  (SQLite)
   All require super_admin role
-------------------------------------------------- */

// Get all users
router.get("/users", authenticateJWT, requireRole("super_admin"), (req, res) => {
  try {
    const users = getAllUsers.all();
    res.json({ success: true, users });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

// Get pending users
router.get("/users/pending", authenticateJWT, requireRole("super_admin"), (req, res) => {
  try {
    const users = getAllPendingUsers.all();
    res.json({ success: true, users });
  } catch (err) {
    console.error("Get pending users error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch pending users" });
  }
});

// Approve / Reject user
router.patch("/users/:id/status", authenticateJWT, requireRole("super_admin"), (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    User.updateStatus.run(status, id);
    res.json({ success: true, message: `User ${status} successfully` });
  } catch (err) {
    console.error("Update user status error:", err);
    res.status(500).json({ success: false, error: "Failed to update user status" });
  }
});

// Dashboard stats  (SQLite counts for users; firm counts come from Mongo below if needed)
router.get("/stats", authenticateJWT, requireRole("super_admin"), (req, res) => {
  try {
    const stats = {
      totalUsers:    db.prepare("SELECT COUNT(*) AS count FROM users WHERE role != 'super_admin'").get().count,
      pendingUsers:  db.prepare("SELECT COUNT(*) AS count FROM users WHERE status = 'pending'").get().count,
      approvedUsers: db.prepare("SELECT COUNT(*) AS count FROM users WHERE status = 'approved'").get().count,
    };
    res.json({ success: true, stats });
  } catch (err) {
    console.error("Get stats error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

/* --------------------------------------------------
   FIRM MANAGEMENT ROUTES  (MongoDB via firmManagementController)
   NOTE: These must come AFTER the user routes and must not be
   duplicated – Express matches the FIRST registered handler.
-------------------------------------------------- */

// Create firm (with full details + optional admin account)
router.post("/firms", authenticateJWT, requireRole("super_admin"), firmManagementController.createFirm);

// List all firms
router.get("/firms", authenticateJWT, requireRole("super_admin"), firmManagementController.getAllFirms);

// Get single firm by ID
router.get("/firms/:id", authenticateJWT, requireRole("super_admin"), firmManagementController.getFirm);

// Update firm
router.put("/firms/:id", authenticateJWT, requireRole("super_admin"), firmManagementController.updateFirm);

// Delete firm
router.delete("/firms/:id", authenticateJWT, requireRole("super_admin"), firmManagementController.deleteFirm);

// Assign / unassign user to a firm
router.post("/assign-user-to-firm", authenticateJWT, requireRole("super_admin"), firmManagementController.assignUserToFirm);

// Get all users with their assigned firms (MongoDB population)
router.get("/users-with-firms", authenticateJWT, requireRole("super_admin"), firmManagementController.getAllUsersWithFirms);

export default router;