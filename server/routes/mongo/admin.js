import express from "express";
import bcrypt from "bcrypt";
import User from "../../models/User.model.js";
import Firm from "../../models/Firm.model.js";
import { authMiddleware as authenticateJWT } from "../../middleware/mongo/authMiddleware.js";
import { requireRole } from "../../middleware/mongo/auth.js";
import * as firmManagementController from "../../controllers/mongo/firmManagementController.js";
import * as superAdminController from "../../controllers/mongo/superAdminController.js";

const router = express.Router();

/* --------------------------------------------------
   USER MANAGEMENT ROUTES  (MongoDB)
   All require super_admin role
-------------------------------------------------- */

// Get all users
router.get("/users", authenticateJWT, requireRole("super_admin"), async (req, res) => {
  try {
    const users = await User.aggregate([
      { $match: { role: { $ne: 'super_admin' } } },
      { $lookup: { from: 'firms', localField: 'firm_id', foreignField: '_id', as: 'firm' } },
      { $unwind: { path: '$firm', preserveNullAndEmptyArrays: true } },
      { $project: {
        id: '$_id',
        username: 1,
        email: 1,
        fullname: 1,
        role: 1,
        status: 1,
        created_at: '$createdAt',
        updated_at: '$updatedAt',
        firm_name: { $ifNull: ['$firm.name', 'No Firm'] },
        firm_code: '$firm.code'
      } },
      { $sort: { created_at: -1 } }
    ]);
    res.json({ success: true, users });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

// Get pending users
router.get("/users/pending", authenticateJWT, requireRole("super_admin"), async (req, res) => {
  try {
    const users = await User.aggregate([
      { $match: { status: 'pending' } },
      { $lookup: { from: 'firms', localField: 'firm_id', foreignField: '_id', as: 'firm' } },
      { $unwind: { path: '$firm', preserveNullAndEmptyArrays: true } },
      { $project: {
        id: '$_id',
        username: 1,
        email: 1,
        fullname: 1,
        role: 1,
        status: 1,
        created_at: '$createdAt',
        updated_at: '$updatedAt',
        firm_name: { $ifNull: ['$firm.name', 'No Firm'] },
        firm_code: '$firm.code'
      } },
      { $sort: { created_at: -1 } }
    ]);
    res.json({ success: true, users });
  } catch (err) {
    console.error("Get pending users error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch pending users" });
  }
});

// Approve / Reject user
router.patch("/users/:id/status", authenticateJWT, requireRole("super_admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const updatedUser = await User.findByIdAndUpdate(id, { status }, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true, message: `User ${status} successfully` });
  } catch (err) {
    console.error("Update user status error:", err);
    res.status(500).json({ success: false, error: "Failed to update user status" });
  }
});

// Dashboard stats  (MongoDB counts for users; firm counts come from Mongo below if needed)
router.get("/stats", authenticateJWT, requireRole("super_admin"), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: { $ne: 'super_admin' } });
    const pendingUsers = await User.countDocuments({ status: 'pending' });
    const approvedUsers = await User.countDocuments({ status: 'approved' });
    const stats = {
      totalUsers,
      pendingUsers,
      approvedUsers,
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
router.get("/users-with-firms", authenticateJWT, requireRole(["super_admin", "admin"]), firmManagementController.getAllUsersWithFirms);

// Create user (admin only for their firm)
router.post("/users", authenticateJWT, requireRole("admin"), firmManagementController.createUser);

// Super Admin Routes
router.get('/super-admin/stats', authenticateJWT, requireRole('super_admin'), superAdminController.getSuperAdminStats);
router.get('/super-admin/users', authenticateJWT, requireRole('super_admin'), superAdminController.getAllUsersForAdmin);
router.put('/super-admin/users/role', authenticateJWT, requireRole('super_admin'), superAdminController.updateUserRole);
router.get('/super-admin/firms', authenticateJWT, requireRole('super_admin'), superAdminController.getAllFirmsForAdmin);

export default router;