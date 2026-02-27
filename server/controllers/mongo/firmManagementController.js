import bcrypt from 'bcrypt';
import { Firm, User, Stock, Bill, Party } from '../../models/index.js';

/* ── ROLE GUARD HELPER ─────────────────────────────────────────────────── */

function requireSuperAdmin(req, res) {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'You are not permitted to perform this action' });
    return false;
  }
  return true;
}

/* ── CREATE FIRM ─────────────────────────────────────────────────────────── */

export async function createFirm(req, res) {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const {
      name, legal_name, address, city, state, country, pincode,
      phone_number, secondary_phone, email, website,
      business_type, industry_type, establishment_year, employee_count,
      registration_number, registration_date, cin_number, pan_number,
      gst_number, tax_id, vat_number, bank_account_number, bank_name,
      bank_branch, ifsc_code, payment_terms, status, license_numbers,
      insurance_details, currency, timezone, fiscal_year_start,
      invoice_prefix, quote_prefix, po_prefix, logo_url,
      invoice_template, enable_e_invoice,
      admin_account,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Firm name is required' });
    }

    const existingFirm = await Firm.findOne({ name }).lean();
    if (existingFirm) {
      return res.status(409).json({ error: 'A firm with this name already exists' });
    }

    const firm = await Firm.create({
      name, legal_name, address, city, state, country, pincode,
      phone_number, secondary_phone, email, website,
      business_type, industry_type, establishment_year, employee_count,
      registration_number, registration_date, cin_number, pan_number,
      gst_number, tax_id, vat_number, bank_account_number, bank_name,
      bank_branch, ifsc_code, payment_terms,
      status: status ?? 'approved',
      license_numbers, insurance_details,
      currency:          currency          ?? 'INR',
      timezone:          timezone          ?? 'Asia/Kolkata',
      fiscal_year_start, invoice_prefix, quote_prefix, po_prefix,
      logo_url, invoice_template,
      enable_e_invoice: !!enable_e_invoice,
    });

    let message = 'Firm created successfully';

    // Optionally create an admin user for the new firm
    const a = admin_account;
    if (a && (a.fullname || a.username || a.email || a.password)) {
      const { fullname, username, email: adminEmail, password } = a;

      if (!fullname || !username || !adminEmail || !password) {
        return res.status(400).json({ error: 'All admin account fields are required when creating admin user' });
      }

      const [usernameTaken, emailTaken] = await Promise.all([
        User.findOne({ username }).lean(),
        User.findOne({ email: adminEmail }).lean(),
      ]);

      if (usernameTaken) return res.status(409).json({ error: 'Username already exists' });
      if (emailTaken)    return res.status(409).json({ error: 'Email already exists' });

      const hashedPassword = await bcrypt.hash(password, 12);

      await User.create({
        fullname,
        username,
        email:    adminEmail,
        password: hashedPassword,
        role:     'admin',
        firm_id:  firm._id,
        status:   'approved',
      });

      message = 'Firm and admin account created successfully';
    }

    res.status(201).json({ message, firmId: firm._id });
  } catch (err) {
    console.error('Error creating firm:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── GET ALL FIRMS ───────────────────────────────────────────────────────── */

export async function getAllFirms(req, res) {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const firms = await Firm.find().sort({ createdAt: -1 }).lean();
    res.json({ firms });
  } catch (err) {
    console.error('Error fetching firms:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── GET FIRM BY ID ──────────────────────────────────────────────────────── */

export async function getFirm(req, res) {
  if (!req.user) {
    return res.status(403).json({ error: 'You are not permitted to perform this action' });
  }

  try {
    const firm = await Firm.findById(req.params.id).lean();
    if (!firm) return res.status(404).json({ error: 'Firm not found' });
    res.json({ firm });
  } catch (err) {
    console.error('Error fetching firm:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── UPDATE FIRM ─────────────────────────────────────────────────────────── */

export async function updateFirm(req, res) {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const { id } = req.params;

    const existing = await Firm.findById(id).lean();
    if (!existing) return res.status(404).json({ error: 'Firm not found' });

    const { name, enable_e_invoice, ...rest } = req.body;

    if (name) {
      const clash = await Firm.findOne({ name, _id: { $ne: id } }).lean();
      if (clash) return res.status(409).json({ error: 'Another firm with this name already exists' });
    }

    const updateFields = { ...rest };
    if (name !== undefined)             updateFields.name            = name;
    if (enable_e_invoice !== undefined) updateFields.enable_e_invoice = !!enable_e_invoice;

    await Firm.findByIdAndUpdate(id, { $set: updateFields });

    res.json({ message: 'Firm updated successfully' });
  } catch (err) {
    console.error('Error updating firm:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── DELETE FIRM ─────────────────────────────────────────────────────────── */

export async function deleteFirm(req, res) {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const { id } = req.params;

    const existing = await Firm.findById(id).lean();
    if (!existing) return res.status(404).json({ error: 'Firm not found' });

    const [userCount, stockCount, billCount, partyCount] = await Promise.all([
      User.countDocuments({ firm_id: id }),
      Stock.countDocuments({ firm_id: id }),
      Bill.countDocuments({ firm_id: id }),
      Party.countDocuments({ firm_id: id }),
    ]);

    if (userCount > 0) {
      return res.status(400).json({ error: 'Cannot delete firm with associated users. Remove users first.' });
    }

    if (stockCount > 0 || billCount > 0 || partyCount > 0) {
      return res.status(400).json({
        error:   'Cannot delete firm with associated data. Remove all related data first.',
        details: { stocks: stockCount, bills: billCount, parties: partyCount },
      });
    }

    await Firm.findByIdAndDelete(id);

    res.json({ message: 'Firm deleted successfully' });
  } catch (err) {
    console.error('Error deleting firm:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── ASSIGN / UNASSIGN USER TO FIRM ─────────────────────────────────────── */
// FIX: firmId can be null (unassign). Only userId is always required.

export async function assignUserToFirm(req, res) {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const { userId, firmId } = req.body;

    // userId is always required; firmId can be null to unassign
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // If firmId is provided (not null/undefined), validate it exists
    if (firmId) {
      const firm = await Firm.findById(firmId).lean();
      if (!firm) return res.status(404).json({ error: 'Firm not found' });

      if (user.firm_id && String(user.firm_id) !== String(firmId)) {
        console.log(`User ${userId} reassigned from firm ${user.firm_id} to ${firmId}`);
      }
    }

    await User.findByIdAndUpdate(userId, { $set: { firm_id: firmId ?? null } });

    const action = firmId ? 'assigned to firm' : 'unassigned from firm';
    res.json({ message: `User ${action} successfully` });
  } catch (err) {
    console.error('Error assigning user to firm:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── GET ALL USERS WITH FIRMS ────────────────────────────────────────────── */

export async function getAllUsersWithFirms(req, res) {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const users = await User.find()
      .populate('firm_id', 'name')
      .select('fullname username email firm_id role status')
      .sort({ fullname: 1 })
      .lean();

    const shaped = users.map(u => ({
      _id:       u._id,
      fullname:  u.fullname,
      username:  u.username,
      email:     u.email,
      role:      u.role,
      status:    u.status,
      firm_id:   u.firm_id?._id ?? null,
      firm_name: u.firm_id?.name ?? null,
    }));

    res.json({ users: shaped });
  } catch (err) {
    console.error('Error fetching users with firms:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}