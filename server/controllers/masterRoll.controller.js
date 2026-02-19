'use strict';

import { db } from '../utils/db.js';

/* --------------------------------------------------
   PREPARED STATEMENTS - WITH FIRM ISOLATION & USER TRACKING
   NOW USING POSITIONAL PARAMETERS
-------------------------------------------------- */

const insertStmt = db.prepare(`
  INSERT INTO master_rolls (
    firm_id,
    employee_name,
    father_husband_name,
    date_of_birth,
    aadhar,
    pan,
    phone_no,
    address,
    bank,
    account_no,
    ifsc,
    branch,
    uan,
    esic_no,
    s_kalyan_no,
    category,
    p_day_wage,
    project,
    site,
    date_of_joining,
    date_of_exit,
    doe_rem,
    status,
    created_by,
    updated_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Get by ID with firm check and creator info
const getByIdStmt = db.prepare(`
  SELECT 
    mr.*, 
    f.name as firm_name, 
    f.code as firm_code,
    u_creator.fullname as created_by_name,
    u_creator.username as created_by_username,
    u_updater.fullname as updated_by_name,
    u_updater.username as updated_by_username
  FROM master_rolls mr
  JOIN firms f ON f.id = mr.firm_id
  LEFT JOIN users u_creator ON u_creator.id = mr.created_by
  LEFT JOIN users u_updater ON u_updater.id = mr.updated_by
  WHERE mr.id = ? AND mr.firm_id = ?
`);

// Get all for a specific firm with creator info
const getAllByFirmStmt = db.prepare(`
  SELECT 
    mr.*, 
    f.name as firm_name, 
    f.code as firm_code,
    u_creator.fullname as created_by_name,
    u_creator.username as created_by_username,
    u_updater.fullname as updated_by_name,
    u_updater.username as updated_by_username
  FROM master_rolls mr
  JOIN firms f ON f.id = mr.firm_id
  LEFT JOIN users u_creator ON u_creator.id = mr.created_by
  LEFT JOIN users u_updater ON u_updater.id = mr.updated_by
  WHERE mr.firm_id = ?
  ORDER BY mr.created_at DESC
`);

// Get all (admin only - across all firms) with creator info
const getAllStmt = db.prepare(`
  SELECT 
    mr.*, 
    f.name as firm_name, 
    f.code as firm_code,
    u_creator.fullname as created_by_name,
    u_creator.username as created_by_username,
    u_updater.fullname as updated_by_name,
    u_updater.username as updated_by_username
  FROM master_rolls mr
  JOIN firms f ON f.id = mr.firm_id
  LEFT JOIN users u_creator ON u_creator.id = mr.created_by
  LEFT JOIN users u_updater ON u_updater.id = mr.updated_by
  ORDER BY mr.created_at DESC
`);

// Delete with firm check
const deleteStmt = db.prepare(`
  DELETE FROM master_rolls 
  WHERE id = ? AND firm_id = ?
`);

// Check if master roll belongs to firm
const checkFirmOwnership = db.prepare(`
  SELECT id, created_by FROM master_rolls 
  WHERE id = ? AND firm_id = ?
`);

// Search master rolls by various criteria with creator info
const searchStmt = db.prepare(`
  SELECT 
    mr.*, 
    f.name as firm_name, 
    f.code as firm_code,
    u_creator.fullname as created_by_name,
    u_creator.username as created_by_username,
    u_updater.fullname as updated_by_name,
    u_updater.username as updated_by_username
  FROM master_rolls mr
  JOIN firms f ON f.id = mr.firm_id
  LEFT JOIN users u_creator ON u_creator.id = mr.created_by
  LEFT JOIN users u_updater ON u_updater.id = mr.updated_by
  WHERE mr.firm_id = ?
    AND (
      mr.employee_name LIKE ?
      OR mr.aadhar LIKE ?
      OR mr.phone_no LIKE ?
      OR mr.project LIKE ?
      OR mr.site LIKE ?
    )
  ORDER BY mr.created_at DESC
  LIMIT ? OFFSET ?
`);

// Get statistics by firm
const getStatsByFirmStmt = db.prepare(`
  SELECT 
    COUNT(*) as total_employees,
    COUNT(CASE WHEN date_of_exit IS NULL THEN 1 END) as active_employees,
    COUNT(CASE WHEN date_of_exit IS NOT NULL THEN 1 END) as exited_employees,
    COUNT(DISTINCT project) as total_projects,
    COUNT(DISTINCT site) as total_sites
  FROM master_rolls
  WHERE firm_id = ?
`);

// Get activity log for an employee
const getActivityLogStmt = db.prepare(`
  SELECT 
    'created' as action,
    mr.created_at as timestamp,
    u.fullname as user_name,
    u.username as username,
    u.role as user_role
  FROM master_rolls mr
  LEFT JOIN users u ON u.id = mr.created_by
  WHERE mr.id = ? AND mr.firm_id = ?
  
  UNION ALL
  
  SELECT 
    'updated' as action,
    mr.updated_at as timestamp,
    u.fullname as user_name,
    u.username as username,
    u.role as user_role
  FROM master_rolls mr
  LEFT JOIN users u ON u.id = mr.updated_by
  WHERE mr.id = ? AND mr.firm_id = ? AND mr.updated_at != mr.created_at
  
  ORDER BY timestamp DESC
`);

/* --------------------------------------------------
   CONTROLLER METHODS
-------------------------------------------------- */

// CREATE - with automatic firm_id and user tracking
export const createMasterRoll = (req, res) => {
  try {
    // Get firm_id and user_id from authenticated user
    const { firm_id, id: user_id, fullname, username } = req.user;

    // Validate required fields
    const requiredFields = [
      'employee_name', 'father_husband_name', 'date_of_birth',
      'aadhar', 'phone_no', 'address', 'bank', 'account_no',
      'ifsc', 'date_of_joining'
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`
        });
      }
    }

    // Insert with positional parameters
    const result = insertStmt.run(
      firm_id,
      req.body.employee_name,
      req.body.father_husband_name,
      req.body.date_of_birth,
      req.body.aadhar,
      req.body.pan,
      req.body.phone_no,
      req.body.address,
      req.body.bank,
      req.body.account_no,
      req.body.ifsc,
      req.body.branch,
      req.body.uan,
      req.body.esic_no,
      req.body.s_kalyan_no,
      req.body.category,
      req.body.p_day_wage,
      req.body.project,
      req.body.site,
      req.body.date_of_joining,
      req.body.date_of_exit,
      req.body.doe_rem,
      req.body.status || 'Active',
      user_id,
      user_id
    );

    res.status(201).json({
      success: true,
      id: result.lastInsertRowid,
      message: 'Employee added to master roll',
      created_by: {
        id: user_id,
        name: fullname,
        username: username
      }
    });
  } catch (err) {
    // Handle duplicate aadhar
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({
        success: false,
        error: 'Employee with this Aadhar already exists in your firm'
      });
    }

    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// READ ALL - respects firm isolation
export const getAllMasterRolls = (req, res) => {
  try {
    const { role, firm_id } = req.user;
    let rows;

    // Admin can see all firms' data (optional - can be restricted)
    // For strict isolation, remove this and only use firm-based query
    if (role === 'admin' && req.query.all_firms === 'true') {
      rows = getAllStmt.all();
    } else {
      // Manager and User see only their firm's data
      rows = getAllByFirmStmt.all(firm_id);
    }

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// READ ONE - with firm check and audit trail
export const getMasterRollById = (req, res) => {
  try {
    const { firm_id } = req.user;
    const { id } = req.params;

    const row = getByIdStmt.get(id, firm_id);

    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found or access denied'
      });
    }

    res.json({
      success: true,
      data: row
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// UPDATE - with firm check and user tracking
export const updateMasterRoll = (req, res) => {
  try {
    const { firm_id, id: user_id, role } = req.user;
    const { id } = req.params;
    
    // Convert id to number for consistency
    const masterId = parseInt(id, 10);
    const firmId = parseInt(firm_id, 10);

    // Check ownership - allow super_admin to bypass firm check
    if (role !== 'super_admin') {
      const ownership = checkFirmOwnership.get(masterId, firmId);
      if (!ownership) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found or access denied'
        });
      }
    } else {
      // Super admin - just check if employee exists
      const exists = db.prepare('SELECT id FROM master_rolls WHERE id = ?').get(masterId);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found'
        });
      }
    }

    // Build update query dynamically based on provided fields
    const allowedFields = [
      'employee_name', 'father_husband_name', 'date_of_birth',
      'aadhar', 'pan', 'phone_no', 'address', 'bank', 'account_no',
      'ifsc', 'branch', 'uan', 'esic_no', 's_kalyan_no', 'category',
      'p_day_wage', 'project', 'site', 'date_of_joining', 'date_of_exit',
      'doe_rem', 'status'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    // Add updated_by and updated_at
    updates.push('updated_by = ?');
    updates.push('updated_at = ?');
    values.push(user_id);
    values.push(new Date().toISOString());

    // Add WHERE clause parameters
    values.push(masterId);
    
    // Build WHERE clause based on role
    let updateQuery;
    if (role === 'super_admin') {
      // Super admin can update any employee
      updateQuery = `UPDATE master_rolls SET ${updates.join(', ')} WHERE id = ?`;
    } else {
      // Regular users can only update employees in their firm
      values.push(firmId);
      updateQuery = `UPDATE master_rolls SET ${updates.join(', ')} WHERE id = ? AND firm_id = ?`;
    }

    // Use db.exec() with raw SQL instead of prepared statements for UPDATE
    // Turso has issues with prepared statement UPDATEs with many parameters
    try {
      db.exec(updateQuery, values);
      
      console.log(`[UPDATE] Query executed successfully`);
      console.log(`[UPDATE] Query: ${updateQuery}`);
      console.log(`[UPDATE] Values: ${JSON.stringify(values)}`);
      
      res.json({
        success: true,
        message: 'Employee updated successfully',
        updated_by: user_id
      });
    } catch (execErr) {
      console.error(`[UPDATE] Error:`, execErr.message);
      return res.status(400).json({
        success: false,
        error: execErr.message
      });
    }
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// DELETE - with firm check
export const deleteMasterRoll = (req, res) => {
  try {
    const { firm_id } = req.user;
    const { id } = req.params;

    const result = deleteStmt.run(id, firm_id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found or access denied'
      });
    }

    res.json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// SEARCH - with firm isolation
export const searchMasterRolls = (req, res) => {
  try {
    const { firm_id } = req.user;
    const { q, limit = 50, offset = 0 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query required'
      });
    }

    const searchPattern = `%${q}%`;
    const rows = searchStmt.all(
      firm_id,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// GET STATISTICS - firm specific
export const getMasterRollStats = (req, res) => {
  try {
    const { firm_id } = req.user;
    const stats = getStatsByFirmStmt.get(firm_id);

    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// GET ACTIVITY LOG - with firm check
export const getActivityLog = (req, res) => {
  try {
    const { firm_id } = req.user;
    const { id } = req.params;

    const activities = getActivityLogStmt.all(id, firm_id, id, firm_id);

    res.json({
      success: true,
      count: activities.length,
      data: activities
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// BULK IMPORT - with firm_id and user tracking
export const bulkImportMasterRolls = (req, res) => {
  try {
    const { firm_id, role, id: user_id } = req.user;
    const { employees } = req.body;

    // Only admin and manager can bulk import
    if (role === 'user') {
      return res.status(403).json({
        success: false,
        error: 'Only managers and admins can bulk import'
      });
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid employees array'
      });
    }

    const results = {
      success: [],
      failed: []
    };

    // Use transaction for bulk insert
    const bulkInsert = db.transaction((employeeList) => {
      for (let i = 0; i < employeeList.length; i++) {
        try {
          const emp = employeeList[i];
          const result = insertStmt.run(
            firm_id,
            emp.employee_name,
            emp.father_husband_name,
            emp.date_of_birth,
            emp.aadhar,
            emp.pan,
            emp.phone_no,
            emp.address,
            emp.bank,
            emp.account_no,
            emp.ifsc,
            emp.branch,
            emp.uan,
            emp.esic_no,
            emp.s_kalyan_no,
            emp.category,
            emp.p_day_wage,
            emp.project,
            emp.site,
            emp.date_of_joining,
            emp.date_of_exit,
            emp.doe_rem,
            emp.status,
            user_id,
            user_id
          );
          results.success.push({
            index: i,
            id: result.lastInsertRowid,
            name: emp.employee_name
          });
        } catch (err) {
          results.failed.push({
            index: i,
            name: employeeList[i].employee_name,
            error: err.message
          });
        }
      }
    });

    bulkInsert(employees);

    res.status(201).json({
      success: true,
      imported: results.success.length,
      failed: results.failed.length,
      details: results
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// EXPORT - firm specific
export const exportMasterRolls = (req, res) => {
  try {
    const { firm_id } = req.user;
    const rows = getAllByFirmStmt.all(firm_id);

    // Return as CSV or JSON based on query param
    const format = req.query.format || 'json';

    if (format === 'csv') {
      // Convert to CSV
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No data to export'
        });
      }

      const headers = Object.keys(rows[0]).join(',');
      const csvRows = rows.map(row =>
        Object.values(row).map(val =>
          typeof val === 'string' && val.includes(',')
            ? `"${val}"`
            : val
        ).join(',')
      );

      const csv = [headers, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=master_rolls.csv');
      res.send(csv);
    } else {
      res.json({
        success: true,
        count: rows.length,
        data: rows
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/* --------------------------------------------------
   BULK ACTION
-------------------------------------------------- */

export const bulkCreateMasterRoll = (req, res) => {
  try {
    const { firm_id, id: user_id } = req.user;
    const rows = req.body; // Expecting an array of objects

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: "No data provided" });
    }

    let successCount = 0;
    let errors = [];

    // Process each row individually without transaction to avoid rollback issues
    // This allows partial success and better error handling
    for (const item of rows) {
      try {
        // 1. Basic Validation (skip empty rows)
        if (!item.employee_name || !item.aadhar) {
          errors.push(`Skipped row: Missing Name or Aadhar`);
          continue;
        }

        // 2. Insert with positional parameters
        insertStmt.run(
          firm_id,
          item.employee_name,
          item.father_husband_name || '',
          item.date_of_birth || '',
          String(item.aadhar),
          item.pan || null,
          String(item.phone_no || ''),
          item.address || '',
          item.bank || '',
          String(item.account_no || ''),
          item.ifsc || '',
          item.branch || '',
          item.uan || null,
          item.esic_no || null,
          item.s_kalyan_no || null,
          item.category || 'UNSKILLED',
          item.p_day_wage || 0,
          item.project || null,
          item.site || null,
          item.date_of_joining || new Date().toISOString().split('T')[0],
          item.date_of_exit || null,
          item.doe_rem || null,
          item.status || 'Active',
          user_id,
          user_id
        );
        successCount++;
      } catch (err) {
        // Handle unique constraint violations (e.g., Duplicate Aadhar)
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed')) {
          errors.push(`Duplicate Aadhar: ${item.aadhar} (${item.employee_name})`);
        } else {
          errors.push(`Error for ${item.employee_name}: ${err.message}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Processed ${rows.length} rows.`,
      imported: successCount,
      failed: errors.length,
      errors: errors // Send back list of errors for the toast
    });

  } catch (err) {
    console.error("Bulk create error:", err);
    res.status(500).json({ success: false, error: "Bulk upload failed on server." });
  }
};

/* --------------------------------------------------
   BULK DELETE - ADDED FOR CONSISTENCY
-------------------------------------------------- */

export const bulkDeleteMasterRolls = (req, res) => {
  try {
    const { firm_id, role, id: user_id, fullname, username } = req.user;
    const { ids } = req.body;

    // Only admin and manager can bulk delete
    if (role === 'user') {
      return res.status(403).json({
        success: false,
        error: 'Only managers and admins can bulk delete employees'
      });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No employee IDs provided'
      });
    }

    const deleteStmt = db.prepare(`
      DELETE FROM master_rolls 
      WHERE id = ? AND firm_id = ?
    `);

    let successCount = 0;
    let failedIds = [];

    // Use transaction for consistency
    const bulkDelete = db.transaction((employeeIds) => {
      for (const id of employeeIds) {
        try {
          const result = deleteStmt.run(id, firm_id);
          if (result.changes > 0) {
            successCount++;
          } else {
            failedIds.push({ id, reason: 'Not found or access denied' });
          }
        } catch (err) {
          failedIds.push({ id, reason: err.message });
        }
      }
    });

    bulkDelete(ids);

    res.json({
      success: true,
      message: `Deleted ${successCount} out of ${ids.length} employees`,
      deleted: successCount,
      failed: failedIds.length,
      failedIds: failedIds,
      deleted_by: {
        id: user_id,
        name: fullname,
        username: username,
        role: role
      }
    });
  } catch (err) {
    console.error("Bulk delete error:", err);
    res.status(500).json({
      success: false,
      error: 'Bulk delete failed on server'
    });
  }
};