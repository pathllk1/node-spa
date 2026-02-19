// Import database
import { db } from '../utils/db.js';

// Create firm
export async function createFirm(req, res) {
    // Validate that user is SUPERADMIN
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!currentUser || currentUser.role !== 'super_admin') {
        return res.status(403).json({ error: 'You are not permitted to perform this action' });
    }
    
    try {
        const { name, legal_name, address, city, state, country, pincode, phone_number, secondary_phone, email, website, business_type, industry_type, establishment_year, employee_count, registration_number, registration_date, cin_number, pan_number, gst_number, tax_id, vat_number, bank_account_number, bank_name, bank_branch, ifsc_code, payment_terms, status, license_numbers, insurance_details, currency, timezone, fiscal_year_start, invoice_prefix, quote_prefix, po_prefix, logo_url, invoice_template, enable_e_invoice, admin_account } = req.body;
        
        // Convert boolean to integer for enable_e_invoice
        const enableEInvoiceInt = enable_e_invoice === true ? 1 : (enable_e_invoice === false ? 0 : enable_e_invoice);
        
        // Validate required fields
        if (!name) {
            return res.status(400).json({ error: 'Firm name is required' });
        }
        
        // Check if firm with same name already exists
        const existingFirm = db.prepare('SELECT * FROM firms WHERE name = ?').get(name);
        if (existingFirm) {
            return res.status(409).json({ error: 'A firm with this name already exists' });
        }
        
        const now = new Date().toISOString();
        
        const result = db.prepare(`
            INSERT INTO firms (
                name, legal_name, address, city, state, country, pincode,
                phone_number, secondary_phone, email, website, business_type, industry_type,
                establishment_year, employee_count, registration_number, registration_date,
                cin_number, pan_number, gst_number, tax_id, vat_number,
                bank_account_number, bank_name, bank_branch, ifsc_code, payment_terms,
                status, license_numbers, insurance_details, currency, timezone,
                fiscal_year_start, invoice_prefix, quote_prefix, po_prefix,
                logo_url, invoice_template, enable_e_invoice,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            name, legal_name, address, city, state, country, pincode,
            phone_number, secondary_phone, email, website, business_type, industry_type,
            establishment_year, employee_count, registration_number, registration_date,
            cin_number, pan_number, gst_number, tax_id, vat_number,
            bank_account_number, bank_name, bank_branch, ifsc_code, payment_terms,
            status, license_numbers, insurance_details, currency, timezone,
            fiscal_year_start, invoice_prefix, quote_prefix, po_prefix,
            logo_url, invoice_template, enableEInvoiceInt,
            now, now
        );
        
        const firmId = result.lastInsertRowid;
        let message = 'Firm created successfully';
        
        // Create admin account if provided
        if (admin_account && (admin_account.fullname || admin_account.username || admin_account.email || admin_account.password)) {
            try {
                const { fullname, username, email: adminEmail, password } = admin_account;
                
                // Validate admin account fields
                if (!fullname || !username || !adminEmail || !password) {
                    return res.status(400).json({ error: 'All admin account fields are required when creating admin user' });
                }
                
                // Check if username already exists
                const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
                if (existingUser) {
                    return res.status(409).json({ error: 'Username already exists' });
                }
                
                // Check if email already exists
                const existingEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
                if (existingEmail) {
                    return res.status(409).json({ error: 'Email already exists' });
                }
                
                // Hash password (using simple hash for now - in production use bcrypt)
                const crypto = await import('crypto');
                const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
                
                // Create admin user
                db.prepare(`
                    INSERT INTO users (
                        fullname, username, email, password, role, firm_id, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    fullname, username, adminEmail, hashedPassword, 'admin', firmId, 'approved', now, now
                );
                
                message = 'Firm and admin account created successfully';
            } catch (adminErr) {
                console.error('Error creating admin account:', adminErr.message);
                // Firm was created, but admin account creation failed
                return res.status(500).json({ 
                    error: 'Firm created but admin account creation failed',
                    details: adminErr.message
                });
            }
        }
        
        res.status(201).json({ 
            message, 
            firmId
        });
    } catch (err) {
        console.error('Error creating firm:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get all firms
export function getAllFirms(req, res) {
    // Validate that user is SUPERADMIN
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!currentUser || currentUser.role !== 'super_admin') {
        return res.status(403).json({ error: 'You are not permitted to perform this action' });
    }
    
    try {
        const firms = db.prepare('SELECT * FROM firms ORDER BY created_at DESC').all();
        res.json({ firms });
    } catch (err) {
        console.error('Error fetching firms:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get firm by ID
export function getFirm(req, res) {
    // Validate that user is SUPERADMIN
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!currentUser) {
        return res.status(403).json({ error: 'You are not permitted to perform this action' });
    }
    
    try {
        const { id } = req.params;
        const firm = db.prepare('SELECT * FROM firms WHERE id = ?').get(id);
        
        if (!firm) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        
        res.json({ firm });
    } catch (err) {
        console.error('Error fetching firm:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Update firm
export function updateFirm(req, res) {
    // Validate that user is SUPERADMIN
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!currentUser || currentUser.role !== 'super_admin') {
        return res.status(403).json({ error: 'You are not permitted to perform this action' });
    }
    
    try {
        const { id } = req.params;
        const { name, legal_name, address, city, state, country, pincode, phone_number, secondary_phone, email, website, business_type, industry_type, establishment_year, employee_count, registration_number, registration_date, cin_number, pan_number, gst_number, tax_id, vat_number, bank_account_number, bank_name, bank_branch, ifsc_code, payment_terms, status, license_numbers, insurance_details, currency, timezone, fiscal_year_start, invoice_prefix, quote_prefix, po_prefix, logo_url, invoice_template, enable_e_invoice } = req.body;
        
        // Convert boolean to integer for enable_e_invoice
        const enableEInvoiceInt = enable_e_invoice === true ? 1 : (enable_e_invoice === false ? 0 : enable_e_invoice);
        
        // Check if firm exists
        const existingFirm = db.prepare('SELECT * FROM firms WHERE id = ?').get(id);
        if (!existingFirm) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        
        // Check if another firm with same name exists (excluding current firm)
        if (name) {
            const sameNameFirm = db.prepare('SELECT * FROM firms WHERE name = ? AND id != ?').get(name, id);
            if (sameNameFirm) {
                return res.status(409).json({ error: 'Another firm with this name already exists' });
            }
        }
        
        const now = new Date().toISOString();
        
        const result = db.prepare(`
            UPDATE firms 
            SET name = COALESCE(?, name), 
                legal_name = COALESCE(?, legal_name),
                address = COALESCE(?, address),
                city = COALESCE(?, city),
                state = COALESCE(?, state),
                country = COALESCE(?, country),
                pincode = COALESCE(?, pincode),
                phone_number = COALESCE(?, phone_number),
                secondary_phone = COALESCE(?, secondary_phone),
                email = COALESCE(?, email),
                website = COALESCE(?, website),
                business_type = COALESCE(?, business_type),
                industry_type = COALESCE(?, industry_type),
                establishment_year = COALESCE(?, establishment_year),
                employee_count = COALESCE(?, employee_count),
                registration_number = COALESCE(?, registration_number),
                registration_date = COALESCE(?, registration_date),
                cin_number = COALESCE(?, cin_number),
                pan_number = COALESCE(?, pan_number),
                gst_number = COALESCE(?, gst_number),
                tax_id = COALESCE(?, tax_id),
                vat_number = COALESCE(?, vat_number),
                bank_account_number = COALESCE(?, bank_account_number),
                bank_name = COALESCE(?, bank_name),
                bank_branch = COALESCE(?, bank_branch),
                ifsc_code = COALESCE(?, ifsc_code),
                payment_terms = COALESCE(?, payment_terms),
                status = COALESCE(?, status),
                license_numbers = COALESCE(?, license_numbers),
                insurance_details = COALESCE(?, insurance_details),
                currency = COALESCE(?, currency),
                timezone = COALESCE(?, timezone),
                fiscal_year_start = COALESCE(?, fiscal_year_start),
                invoice_prefix = COALESCE(?, invoice_prefix),
                quote_prefix = COALESCE(?, quote_prefix),
                po_prefix = COALESCE(?, po_prefix),
                logo_url = COALESCE(?, logo_url),
                invoice_template = COALESCE(?, invoice_template),
                enable_e_invoice = COALESCE(?, enable_e_invoice),
                updated_at = ?
            WHERE id = ?
        `).run(
            name, 
            legal_name, 
            address, 
            city, 
            state, 
            country, 
            pincode, 
            phone_number, 
            secondary_phone, 
            email, 
            website, 
            business_type, 
            industry_type, 
            establishment_year, 
            employee_count, 
            registration_number, 
            registration_date, 
            cin_number, 
            pan_number, 
            gst_number, 
            tax_id, 
            vat_number, 
            bank_account_number, 
            bank_name, 
            bank_branch, 
            ifsc_code, 
            payment_terms, 
            status, 
            license_numbers, 
            insurance_details, 
            currency, 
            timezone, 
            fiscal_year_start, 
            invoice_prefix, 
            quote_prefix, 
            po_prefix, 
            logo_url, 
            invoice_template, 
            enableEInvoiceInt, 
            now, 
            id
        );
        
        if (result.changes === 0) {
            return res.status(400).json({ error: 'No changes made to firm' });
        }
        
        res.json({ message: 'Firm updated successfully' });
    } catch (err) {
        console.error('Error updating firm:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Delete firm
export function deleteFirm(req, res) {
    // Validate that user is SUPERADMIN
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!currentUser || currentUser.role !== 'super_admin') {
        return res.status(403).json({ error: 'You are not permitted to perform this action' });
    }
    
    try {
        const { id } = req.params;
        
        // Check if firm exists
        const existingFirm = db.prepare('SELECT * FROM firms WHERE id = ?').get(id);
        if (!existingFirm) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        
        // Check if firm has associated users
        const firmUsersCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE firm_id = ?').get(id);
        if (firmUsersCount.count > 0) {
            return res.status(400).json({ error: 'Cannot delete firm with associated users. Remove users first.' });
        }
        
        // Check if firm has associated data (stocks, bills, parties, etc.)
        const firmStocksCount = db.prepare('SELECT COUNT(*) as count FROM stocks WHERE firm_id = ?').get(id);
        const firmBillsCount = db.prepare('SELECT COUNT(*) as count FROM bills WHERE firm_id = ?').get(id);
        const firmPartiesCount = db.prepare('SELECT COUNT(*) as count FROM parties WHERE firm_id = ?').get(id);
        
        if (firmStocksCount.count > 0 || firmBillsCount.count > 0 || firmPartiesCount.count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete firm with associated data. Remove all related data first.',
                details: {
                    stocks: firmStocksCount.count,
                    bills: firmBillsCount.count,
                    parties: firmPartiesCount.count
                }
            });
        }
        
        // Delete the firm
        const result = db.prepare('DELETE FROM firms WHERE id = ?').run(id);
        
        if (result.changes === 0) {
            return res.status(400).json({ error: 'No firm was deleted' });
        }
        
        res.json({ message: 'Firm deleted successfully' });
    } catch (err) {
        console.error('Error deleting firm:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Assign user to firm
export function assignUserToFirm(req, res) {
    // Validate that user is SUPERADMIN
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!currentUser || currentUser.role !== 'super_admin') {
        return res.status(403).json({ error: 'You are not permitted to perform this action' });
    }
    
    try {
        const { userId, firmId } = req.body;
        
        // Validate inputs
        if (!userId || !firmId) {
            return res.status(400).json({ error: 'User ID and Firm ID are required' });
        }
        
        // Check if user exists
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if firm exists
        const firm = db.prepare('SELECT * FROM firms WHERE id = ?').get(firmId);
        if (!firm) {
            return res.status(404).json({ error: 'Firm not found' });
        }
        
        // Check if user is already assigned to a different firm
        const currentUserFirm = db.prepare('SELECT firm_id FROM users WHERE id = ?').get(userId);
        if (currentUserFirm.firm_id && currentUserFirm.firm_id != firmId) {
            console.log(`User ${userId} was previously assigned to firm ${currentUserFirm.firm_id}, reassigning to ${firmId}`);
        }
        
        // Assign user to firm
        const result = db.prepare('UPDATE users SET firm_id = ? WHERE id = ?').run(firmId, userId);
        
        if (result.changes === 0) {
            return res.status(400).json({ error: 'Failed to assign user to firm' });
        }
        
        res.json({ message: 'User assigned to firm successfully' });
    } catch (err) {
        console.error('Error assigning user to firm:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get all users with their assigned firms
export function getAllUsersWithFirms(req, res) {
    // Validate that user is SUPERADMIN
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!currentUser || currentUser.role !== 'super_admin') {
        return res.status(403).json({ error: 'You are not permitted to perform this action' });
    }
    
    try {
        const users = db.prepare(`
            SELECT 
                u.id,
                u.fullname,
                u.username,
                u.email,
                u.firm_id,
                f.name as firm_name
            FROM users u
            LEFT JOIN firms f ON u.firm_id = f.id
            ORDER BY u.fullname ASC
        `).all();
        
        res.json({ users });
    } catch (err) {
        console.error('Error fetching users with firms:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
}