import express from "express";
import bcrypt from "bcrypt";
import { db, Firm, User } from "../utils/db.js";
import { authenticateJWT, requireRole } from "../middleware/auth.js";
import * as firmManagementController from "../controllers/firmManagementController.js";

const router = express.Router();

/* --------------------------------------------------
   PREPARED STATEMENTS
-------------------------------------------------- */

const getAllFirms = db.prepare(`
  SELECT f.*, 
         COUNT(DISTINCT u.id) as user_count,
         COUNT(DISTINCT CASE WHEN u.status = 'pending' THEN u.id END) as pending_users
  FROM firms f
  LEFT JOIN users u ON u.firm_id = f.id
  GROUP BY f.id
  ORDER BY f.created_at DESC
`);

const getAllPendingUsers = db.prepare(`
  SELECT u.*, 
         CASE WHEN u.firm_id IS NOT NULL THEN f.name ELSE 'No Firm' END as firm_name,
         CASE WHEN u.firm_id IS NOT NULL THEN f.code ELSE NULL END as firm_code
  FROM users u
  LEFT JOIN firms f ON f.id = u.firm_id
  WHERE u.status = 'pending'
  ORDER BY u.created_at DESC
`);

const getAllUsers = db.prepare(`
  SELECT u.id, u.username, u.email, u.fullname, u.role, u.status,
         u.created_at, u.updated_at,
         CASE WHEN u.firm_id IS NOT NULL THEN f.name ELSE 'No Firm' END as firm_name,
         CASE WHEN u.firm_id IS NOT NULL THEN f.code ELSE NULL END as firm_code
  FROM users u
  LEFT JOIN firms f ON f.id = u.firm_id
  WHERE u.role != 'super_admin'
  ORDER BY u.created_at DESC
`);

const createFirm = db.prepare(`
  INSERT INTO firms (name, code, description, status)
  VALUES (?, ?, ?, ?)
`);

const createUser = db.prepare(`
  INSERT INTO users (username, email, fullname, password, role, firm_id, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

/* --------------------------------------------------
   ADMIN ROUTES - All require super_admin role
-------------------------------------------------- */

// Get all firms
router.get("/firms", authenticateJWT, requireRole('super_admin'), (req, res) => {
  try {
    const firms = getAllFirms.all();
    res.json({ success: true, firms });
  } catch (err) {
    console.error("Get firms error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch firms" });
  }
});

// Create new firm with admin
router.post("/firms", authenticateJWT, requireRole('super_admin'), async (req, res) => {
  try {
    const { firmName, firmCode, adminName, adminEmail, adminUsername, adminPassword } = req.body;

    // Validation
    if (!firmName || !firmCode || !adminName || !adminEmail || !adminUsername || !adminPassword) {
      return res.status(400).json({ 
        success: false, 
        error: "All fields are required" 
      });
    }

    // Check if firm code already exists
    const existingFirm = Firm.getByCode.get(firmCode.toUpperCase());
    if (existingFirm) {
      return res.status(400).json({ 
        success: false, 
        error: "Firm code already exists" 
      });
    }

    // Check if email or username already exists
    const existingEmail = User.getByEmail.get(adminEmail);
    const existingUsername = User.getByUsername.get(adminUsername);
    
    if (existingEmail) {
      return res.status(400).json({ 
        success: false, 
        error: "Email already registered" 
      });
    }

    if (existingUsername) {
      return res.status(400).json({ 
        success: false, 
        error: "Username already taken" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create firm and admin user in a transaction
    const result = db.transaction(() => {
      // Create firm (approved by default when created by super admin)
      const firmResult = createFirm.run(
        firmName,
        firmCode.toUpperCase(),
        null,
        'approved'
      );

      // Create admin user (approved by default)
      const userResult = createUser.run(
        adminUsername,
        adminEmail,
        adminName,
        hashedPassword,
        'admin',
        firmResult.lastInsertRowid,
        'approved'
      );

      return {
        firmId: firmResult.lastInsertRowid,
        userId: userResult.lastInsertRowid
      };
    })();

    res.status(201).json({
      success: true,
      message: "Firm and admin created successfully",
      firm: {
        id: result.firmId,
        code: firmCode.toUpperCase()
      },
      user: {
        id: result.userId,
        username: adminUsername
      }
    });

  } catch (err) {
    console.error("Create firm error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to create firm" 
    });
  }
});

// Update firm status
router.patch("/firms/:id/status", authenticateJWT, requireRole('super_admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid status" 
      });
    }

    Firm.updateStatus.run(status, id);

    res.json({ 
      success: true, 
      message: `Firm ${status} successfully` 
    });

  } catch (err) {
    console.error("Update firm status error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to update firm status" 
    });
  }
});

// Get all users
router.get("/users", authenticateJWT, requireRole('super_admin'), (req, res) => {
  try {
    const users = getAllUsers.all();
    res.json({ success: true, users });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

// Get pending users
router.get("/users/pending", authenticateJWT, requireRole('super_admin'), (req, res) => {
  try {
    const users = getAllPendingUsers.all();
    res.json({ success: true, users });
  } catch (err) {
    console.error("Get pending users error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch pending users" });
  }
});

// Approve/Reject user
router.patch("/users/:id/status", authenticateJWT, requireRole('super_admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid status" 
      });
    }

    User.updateStatus.run(status, id);

    res.json({ 
      success: true, 
      message: `User ${status} successfully` 
    });

  } catch (err) {
    console.error("Update user status error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to update user status" 
    });
  }
});

// Dashboard stats
router.get("/stats", authenticateJWT, requireRole('super_admin'), (req, res) => {
  try {
    const stats = {
      totalFirms: db.prepare("SELECT COUNT(*) as count FROM firms").get().count,
      pendingFirms: db.prepare("SELECT COUNT(*) as count FROM firms WHERE status = 'pending'").get().count,
      approvedFirms: db.prepare("SELECT COUNT(*) as count FROM firms WHERE status = 'approved'").get().count,
      totalUsers: db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'super_admin'").get().count,
      pendingUsers: db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'pending'").get().count,
      approvedUsers: db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'approved'").get().count
    };

    res.json({ success: true, stats });
  } catch (err) {
    console.error("Get stats error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

/* --------------------------------------------------
   FIRM MANAGEMENT ROUTES - From firmManagementController
-------------------------------------------------- */

// Create firm (with full details)
router.post("/firm-management/firms", authenticateJWT, requireRole('super_admin'), firmManagementController.createFirm);

// Get all firms (with full details)
router.get("/firm-management/firms", authenticateJWT, requireRole('super_admin'), firmManagementController.getAllFirms);

// Get firm by ID
router.get("/firm-management/firms/:id", authenticateJWT, requireRole('super_admin'), firmManagementController.getFirm);

// Update firm
router.patch("/firm-management/firms/:id", authenticateJWT, requireRole('super_admin'), firmManagementController.updateFirm);

// Delete firm
router.delete("/firm-management/firms/:id", authenticateJWT, requireRole('super_admin'), firmManagementController.deleteFirm);

// Assign user to firm
router.post("/firm-management/assign-user", authenticateJWT, requireRole('super_admin'), firmManagementController.assignUserToFirm);

// Get all users with their assigned firms
router.get("/firm-management/users-with-firms", authenticateJWT, requireRole('super_admin'), firmManagementController.getAllUsersWithFirms);

export default router;
