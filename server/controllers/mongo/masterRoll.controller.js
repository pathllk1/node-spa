/**
 * Master Roll Controller — Mongoose version
 *
 * Key changes from the SQLite version:
 *  - All db.prepare() + .run/.get/.all replaced with Mongoose model calls
 *  - db.transaction() for bulk ops replaced with Promise.allSettled()
 *  - Firm isolation enforced via { firm_id } filter on every query
 *  - Search uses $or with $regex instead of LIKE patterns
 *  - Stats use MongoDB aggregate instead of a COUNT CASE SQL query
 *  - Activity log built from the document's own timestamps (no audit table)
 *  - Duplicate-aadhar error detected from Mongoose duplicate-key error (code 11000)
 */

import { MasterRoll } from '../models/index.js';

/* ── REQUIRED FIELDS ────────────────────────────────────────────────────── */

const REQUIRED_FIELDS = [
  'employee_name', 'father_husband_name', 'date_of_birth',
  'aadhar', 'phone_no', 'address', 'bank', 'account_no',
  'ifsc', 'date_of_joining',
];

/* ── CREATE ─────────────────────────────────────────────────────────────── */

export const createMasterRoll = async (req, res) => {
  try {
    const { firm_id, id: user_id, fullname, username } = req.user;

    for (const field of REQUIRED_FIELDS) {
      if (!req.body[field]) {
        return res.status(400).json({ success: false, error: `Missing required field: ${field}` });
      }
    }

    const doc = await MasterRoll.create({
      firm_id,
      ...req.body,
      status:     req.body.status ?? 'Active',
      created_by: user_id,
      updated_by: user_id,
    });

    res.status(201).json({
      success:    true,
      id:         doc._id,
      message:    'Employee added to master roll',
      created_by: { id: user_id, name: fullname, username },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Employee with this Aadhar already exists in your firm' });
    }
    res.status(400).json({ success: false, error: err.message });
  }
};

/* ── READ ALL ────────────────────────────────────────────────────────────── */

export const getAllMasterRolls = async (req, res) => {
  try {
    const { role, firm_id } = req.user;

    const filter = (role === 'admin' && req.query.all_firms === 'true') ? {} : { firm_id };

    const rows = await MasterRoll.find(filter)
      .populate('firm_id',    'name code')
      .populate('created_by', 'fullname username')
      .populate('updated_by', 'fullname username')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── READ ONE ────────────────────────────────────────────────────────────── */

export const getMasterRollById = async (req, res) => {
  try {
    const { firm_id } = req.user;

    const row = await MasterRoll.findOne({ _id: req.params.id, firm_id })
      .populate('firm_id',    'name code')
      .populate('created_by', 'fullname username')
      .populate('updated_by', 'fullname username')
      .lean();

    if (!row) {
      return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
    }

    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── UPDATE ─────────────────────────────────────────────────────────────── */

export const updateMasterRoll = async (req, res) => {
  try {
    const { firm_id, id: user_id, role } = req.user;
    const { id } = req.params;

    const filter = role === 'super_admin' ? { _id: id } : { _id: id, firm_id };
    const existing = await MasterRoll.findOne(filter);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
    }

    // Apply partial update — only overwrite fields present in the request body
    const UPDATABLE = [
      'employee_name', 'father_husband_name', 'date_of_birth', 'aadhar', 'pan',
      'phone_no', 'address', 'bank', 'account_no', 'ifsc', 'branch', 'uan',
      'esic_no', 's_kalyan_no', 'category', 'p_day_wage', 'project', 'site',
      'date_of_joining', 'date_of_exit', 'doe_rem', 'status',
    ];

    for (const field of UPDATABLE) {
      if (req.body[field] !== undefined) existing[field] = req.body[field];
    }
    existing.updated_by = user_id;

    await existing.save();

    console.log(`[UPDATE] Employee ${id} updated successfully`);
    res.json({ success: true, message: 'Employee updated successfully', updated_by: user_id });
  } catch (err) {
    console.error('[UPDATE] Error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
};

/* ── DELETE ─────────────────────────────────────────────────────────────── */

export const deleteMasterRoll = async (req, res) => {
  try {
    const { firm_id, role } = req.user;
    const { id } = req.params;

    const filter = role === 'super_admin' ? { _id: id } : { _id: id, firm_id };
    const deleted = await MasterRoll.findOneAndDelete(filter);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
    }

    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── SEARCH ─────────────────────────────────────────────────────────────── */

export const searchMasterRolls = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { q, limit = 50, offset = 0 } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const regex = new RegExp(q, 'i');

    const rows = await MasterRoll.find({
      firm_id,
      $or: [
        { employee_name: regex },
        { aadhar:        regex },
        { phone_no:      regex },
        { project:       regex },
        { site:          regex },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── STATISTICS ─────────────────────────────────────────────────────────── */

export const getMasterRollStats = async (req, res) => {
  try {
    const { firm_id } = req.user;

    const [result] = await MasterRoll.aggregate([
     { $match: { firm_id: new mongoose.Types.ObjectId(firm_id) } },
      {
        $group: {
          _id:              null,
          total_employees:  { $sum: 1 },
          active_employees: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          exited_employees: { $sum: { $cond: [{ $ifNull: ['$date_of_exit', false] }, 1, 0] } },
          total_projects:   { $addToSet: '$project' },
          total_sites:      { $addToSet: '$site' },
        },
      },
      {
        $project: {
          _id:              0,
          total_employees:  1,
          active_employees: 1,
          exited_employees: 1,
          total_projects:   { $size: '$total_projects' },
          total_sites:      { $size: '$total_sites' },
        },
      },
    ]);

    res.json({ success: true, data: result ?? { total_employees: 0, active_employees: 0, exited_employees: 0, total_projects: 0, total_sites: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── ACTIVITY LOG ────────────────────────────────────────────────────────── */

export const getActivityLog = async (req, res) => {
  try {
    const { firm_id } = req.user;

    const doc = await MasterRoll.findOne({ _id: req.params.id, firm_id })
      .populate('created_by', 'fullname username role')
      .populate('updated_by', 'fullname username role')
      .lean();

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
    }

    const activities = [
      {
        action:    'created',
        timestamp: doc.createdAt,
        user_name: doc.created_by?.fullname ?? null,
        username:  doc.created_by?.username ?? null,
        user_role: doc.created_by?.role     ?? null,
      },
    ];

    // Only add an 'updated' entry if the document was actually modified after creation
    if (doc.updatedAt && doc.updatedAt.getTime() !== doc.createdAt.getTime()) {
      activities.push({
        action:    'updated',
        timestamp: doc.updatedAt,
        user_name: doc.updated_by?.fullname ?? null,
        username:  doc.updated_by?.username ?? null,
        user_role: doc.updated_by?.role     ?? null,
      });
    }

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, count: activities.length, data: activities });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── BULK IMPORT ─────────────────────────────────────────────────────────── */

export const bulkImportMasterRolls = async (req, res) => {
  try {
    const { firm_id, role, id: user_id } = req.user;
    const { employees } = req.body;

    if (role === 'user') {
      return res.status(403).json({ success: false, error: 'Only managers and admins can bulk import' });
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid employees array' });
    }

    const settled = await Promise.allSettled(
      employees.map((emp, i) =>
        MasterRoll.create({ firm_id, ...emp, created_by: user_id, updated_by: user_id })
          .then(doc => ({ index: i, id: doc._id, name: emp.employee_name }))
      )
    );

    const success = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed  = settled
      .filter(r => r.status === 'rejected')
      .map((r, i) => ({ index: i, name: employees[i]?.employee_name, error: r.reason.message }));

    res.status(201).json({ success: true, imported: success.length, failed: failed.length, details: { success, failed } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── BULK CREATE (raw array body) ────────────────────────────────────────── */

export const bulkCreateMasterRoll = async (req, res) => {
  try {
    const { firm_id, id: user_id } = req.user;
    const rows = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }

    let successCount = 0;
    const errors = [];

    for (const item of rows) {
      if (!item.employee_name || !item.aadhar) {
        errors.push('Skipped row: Missing Name or Aadhar');
        continue;
      }

      try {
        await MasterRoll.create({
          firm_id,
          employee_name:       item.employee_name,
          father_husband_name: item.father_husband_name ?? '',
          date_of_birth:       item.date_of_birth       ?? '',
          aadhar:              String(item.aadhar),
          pan:                 item.pan                 ?? null,
          phone_no:            String(item.phone_no ?? ''),
          address:             item.address             ?? '',
          bank:                item.bank                ?? '',
          account_no:          String(item.account_no ?? ''),
          ifsc:                item.ifsc                ?? '',
          branch:              item.branch              ?? null,
          uan:                 item.uan                 ?? null,
          esic_no:             item.esic_no             ?? null,
          s_kalyan_no:         item.s_kalyan_no         ?? null,
          category:            item.category            ?? 'UNSKILLED',
          p_day_wage:          item.p_day_wage          ?? 0,
          project:             item.project             ?? null,
          site:                item.site                ?? null,
          date_of_joining:     item.date_of_joining     ?? new Date().toISOString().split('T')[0],
          date_of_exit:        item.date_of_exit        ?? null,
          doe_rem:             item.doe_rem             ?? null,
          status:              item.status              ?? 'Active',
          created_by:          user_id,
          updated_by:          user_id,
        });
        successCount++;
      } catch (err) {
        if (err.code === 11000) {
          errors.push(`Duplicate Aadhar: ${item.aadhar} (${item.employee_name})`);
        } else {
          errors.push(`Error for ${item.employee_name}: ${err.message}`);
        }
      }
    }

    res.json({
      success:  true,
      message:  `Processed ${rows.length} rows.`,
      imported: successCount,
      failed:   errors.length,
      errors,
    });
  } catch (err) {
    console.error('Bulk create error:', err);
    res.status(500).json({ success: false, error: 'Bulk upload failed on server.' });
  }
};

/* ── BULK DELETE ─────────────────────────────────────────────────────────── */

export const bulkDeleteMasterRolls = async (req, res) => {
  try {
    const { firm_id, role, id: user_id, fullname, username } = req.user;
    const { ids } = req.body;

    if (role === 'user') {
      return res.status(403).json({ success: false, error: 'Only managers and admins can bulk delete employees' });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No employee IDs provided' });
    }

    let successCount = 0;
    const failedIds = [];

    for (const id of ids) {
      try {
        const deleted = await MasterRoll.findOneAndDelete({ _id: id, firm_id });
        if (deleted) {
          successCount++;
        } else {
          failedIds.push({ id, reason: 'Not found or access denied' });
        }
      } catch (err) {
        failedIds.push({ id, reason: err.message });
      }
    }

    res.json({
      success:    true,
      message:    `Deleted ${successCount} out of ${ids.length} employees`,
      deleted:    successCount,
      failed:     failedIds.length,
      failedIds,
      deleted_by: { id: user_id, name: fullname, username, role },
    });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ success: false, error: 'Bulk delete failed on server' });
  }
};

/* ── EXPORT ──────────────────────────────────────────────────────────────── */

export const exportMasterRolls = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const rows = await MasterRoll.find({ firm_id }).sort({ createdAt: -1 }).lean();
    const format = req.query.format ?? 'json';

    if (format === 'csv') {
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'No data to export' });
      }

      const headers = Object.keys(rows[0]).join(',');
      const csvRows = rows.map(row =>
        Object.values(row).map(val =>
          typeof val === 'string' && val.includes(',') ? `"${val}"` : val
        ).join(',')
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=master_rolls.csv');
      return res.send([headers, ...csvRows].join('\n'));
    }

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── IFSC LOOKUP (no DB dependency) ─────────────────────────────────────── */

export const lookupIFSC = async (req, res) => {
  try {
    const { ifsc } = req.params;

    if (!ifsc || typeof ifsc !== 'string' || ifsc.length !== 11) {
      return res.status(400).json({ success: false, error: 'Invalid IFSC code. Must be exactly 11 characters.' });
    }

    const normalizedIFSC = ifsc.toUpperCase();
    const response = await fetch(`https://ifsc.razorpay.com/${normalizedIFSC}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'MasterRoll-System/1.0' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ success: false, error: `IFSC "${normalizedIFSC}" not found. Please check the code.` });
      }
      return res.status(response.status).json({ success: false, error: `IFSC lookup failed (HTTP ${response.status}).` });
    }

    const data = await response.json();

    if (!data.BANK) {
      return res.status(502).json({ success: false, error: 'Invalid response from IFSC service.' });
    }

    res.json({
      success: true,
      data: {
        ifsc: normalizedIFSC,
        bank: data.BANK, branch: data.BRANCH, address: data.ADDRESS,
        city: data.CITY,  state:  data.STATE,  district: data.DISTRICT,
        bankcode: data.BANKCODE, micr: data.MICR,
      },
    });
  } catch (error) {
    console.error('[IFSC LOOKUP] Error:', error);
    res.status(500).json({ success: false, error: 'Unable to reach IFSC lookup service.' });
  }
};
