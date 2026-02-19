'use strict';

import { db, Wage, MasterRoll } from '../utils/db.js';

/* --------------------------------------------------
   HELPER FUNCTIONS
-------------------------------------------------- */

/**
 * Get month end date (last day of the month)
 * @param {string} yearMonth - Format: YYYY-MM
 * @returns {string} - Format: YYYY-MM-DD
 */
function getMonthEndDate(yearMonth) {
  const [year, month] = yearMonth.split('-');
  const nextMonth = parseInt(month) === 12 ? '01' : String(parseInt(month) + 1).padStart(2, '0');
  const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : year;
  const lastDay = new Date(nextYear, parseInt(nextMonth) - 1, 0).getDate();
  return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Get month start date
 * @param {string} yearMonth - Format: YYYY-MM
 * @returns {string} - Format: YYYY-MM-DD
 */
function getMonthStartDate(yearMonth) {
  return `${yearMonth}-01`;
}

/**
 * Check if employee is eligible for wages in the given month
 * @param {object} employee - Master roll record
 * @param {string} yearMonth - Format: YYYY-MM
 * @returns {boolean}
 */
function isEmployeeEligible(employee, yearMonth) {
  const monthStart = getMonthStartDate(yearMonth);
  const monthEnd = getMonthEndDate(yearMonth);

  // Check joining date
  if (employee.date_of_joining > monthEnd) {
    return false;
  }

  // Check exit date - include if no exit date OR exit date is after month start
  if (employee.date_of_exit && employee.date_of_exit < monthStart) {
    return false;
  }

  return true;
}

/**
 * Calculate net salary from gross and deductions
 */
function calculateNetSalary(gross, epf, esic, otherDeduction, otherBenefit) {
  const totalDeductions = (epf || 0) + (esic || 0) + (otherDeduction || 0);
  const totalBenefits = otherBenefit || 0;
  return gross - totalDeductions + totalBenefits;
}

/**
 * Calculate per day wage
 */
function calculatePerDayWage(gross, wageDays) {
  return wageDays > 0 ? parseFloat((gross / wageDays).toFixed(2)) : 0;
}

/* --------------------------------------------------
   PREPARED STATEMENTS - NOW USING POSITIONAL PARAMETERS
-------------------------------------------------- */

const insertWageStmt = db.prepare(`
  INSERT INTO wages (
    firm_id,
    master_roll_id,
    p_day_wage,
    wage_days,
    project,
    site,
    gross_salary,
    epf_deduction,
    esic_deduction,
    other_deduction,
    other_benefit,
    net_salary,
    salary_month,
    paid_date,
    cheque_no,
    paid_from_bank_ac,
    created_by,
    updated_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const checkWageExistsStmt = db.prepare(`
  SELECT id FROM wages 
  WHERE firm_id = ? AND master_roll_id = ? AND salary_month = ?
`);

const getEmployeeDataStmt = db.prepare(`
  SELECT p_day_wage, project, site 
  FROM master_rolls 
  WHERE id = ? AND firm_id = ?
`);

/* --------------------------------------------------
   CONTROLLER FUNCTIONS
-------------------------------------------------- */

/**
 * Get employees eligible for wage creation in a given month
 * ✅ BUG FIX: Excludes employees who already have wages for the selected month
 * Filters by: firm, status=active, joining date, exit date, NOT already paid
 * Returns: employee with bank details, project, site
 */
export async function getEmployeesForWages(req, res) {
  try {
    const { month } = req.body;
    const userId = req.user.id;
    const firmId = req.user.firm_id;

    // Validate input
    if (!month) {
      return res.status(400).json({ success: false, message: 'Month required (format: YYYY-MM)' });
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM' });
    }

    // Get all active employees for the firm
    const employees = db.prepare(`
      SELECT 
        id,
        employee_name,
        bank,
        account_no,
        p_day_wage,
        project,
        site,
        date_of_joining,
        date_of_exit,
        status,
        aadhar
      FROM master_rolls
      WHERE firm_id = ? AND status = 'Active'
      ORDER BY employee_name
    `).all(firmId);

    // Get employees who already have wages for this month (BUG FIX)
    const paidEmployeeIds = db.prepare(`
      SELECT master_roll_id 
      FROM wages 
      WHERE firm_id = ? AND salary_month = ?
    `).all(firmId, month).map(row => row.master_roll_id);

    const paidEmployeeIdsSet = new Set(paidEmployeeIds);

    // Filter: eligible + not already paid
    const eligibleEmployees = employees
      .filter(emp => {
        // Must be eligible for the month
        if (!isEmployeeEligible(emp, month)) return false;
        
        // Must NOT already have wages for this month
        if (paidEmployeeIdsSet.has(emp.id)) return false;
        
        return true;
      })
      .map(emp => {
        // Get last wage days from previous wages for convenience
        const lastWage = Wage.getLastWageForEmployee.get(emp.id, firmId);
        const lastWageDays = lastWage ? lastWage.wage_days : 26;
        const lastGrossSalary = lastWage ? lastWage.gross_salary : (emp.p_day_wage || 0) * 26;

        return {
          master_roll_id: emp.id,
          employee_name: emp.employee_name,
          aadhar: emp.aadhar,
          bank: emp.bank,
          account_no: emp.account_no,
          p_day_wage: emp.p_day_wage || 0,
          project: emp.project || '',
          site: emp.site || '',
          last_wage_days: lastWageDays,
          last_gross_salary: lastGrossSalary,
          date_of_joining: emp.date_of_joining,
          date_of_exit: emp.date_of_exit
        };
      });

    res.json({
      success: true,
      data: eligibleEmployees,
      meta: {
        total: eligibleEmployees.length,
        total_active: employees.length,
        already_paid: paidEmployeeIds.length,
        month: month,
        firmId: firmId
      }
    });

  } catch (error) {
    console.error('Error fetching employees for wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/**
 * Get existing wage records for a specific month (for MANAGE/EDIT view)
 * Returns: full wage details with employee info for editing
 */
export async function getExistingWagesForMonth(req, res) {
  try {
    const { month } = req.query;
    const firmId = req.user.firm_id;

    if (!month) {
      return res.status(400).json({ success: false, message: 'Month required (format: YYYY-MM)' });
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM' });
    }

    // Get all wages for this month with employee details
    const wages = db.prepare(`
      SELECT 
        w.id,
        w.master_roll_id,
        w.p_day_wage,
        w.wage_days,
        w.project,
        w.site,
        w.gross_salary,
        w.epf_deduction,
        w.esic_deduction,
        w.other_deduction,
        w.other_benefit,
        w.net_salary,
        w.salary_month,
        w.paid_date,
        w.cheque_no,
        w.paid_from_bank_ac,
        w.created_at,
        w.updated_at,
        mr.employee_name,
        mr.aadhar,
        mr.bank,
        mr.account_no,
        cu.fullname as created_by_name,
        uu.fullname as updated_by_name
      FROM wages w
      JOIN master_rolls mr ON mr.id = w.master_roll_id
      LEFT JOIN users cu ON cu.id = w.created_by
      LEFT JOIN users uu ON uu.id = w.updated_by
      WHERE w.firm_id = ? AND w.salary_month = ?
      ORDER BY mr.employee_name
    `).all(firmId, month);

    res.json({
      success: true,
      data: wages,
      meta: {
        total: wages.length,
        month: month,
        firmId: firmId
      }
    });

  } catch (error) {
    console.error('Error fetching existing wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/**
 * Create wages in bulk (for CREATE mode)
 */
export async function createWagesBulk(req, res) {
  try {
    const { month, wages } = req.body;
    const userId = req.user.id;
    const firmId = req.user.firm_id;

    // Validate input
    if (!month || !wages || !Array.isArray(wages) || wages.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid wage data. Provide month and wages array.' });
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM' });
    }

    // Process wages (without transaction wrapper to avoid rollback issues)
    const results = [];

    for (const wage of wages) {
      try {
        // Validate required fields
        if (!wage.master_roll_id || wage.gross_salary === undefined || !wage.wage_days) {
          results.push({
            master_roll_id: wage.master_roll_id,
            success: false,
            message: 'Missing required fields: master_roll_id, gross_salary, wage_days'
          });
          continue;
        }

        // Check if wage already exists
        const existingWage = checkWageExistsStmt.get(firmId, wage.master_roll_id, month);
        if (existingWage) {
          results.push({
            master_roll_id: wage.master_roll_id,
            success: false,
            message: 'Wage already exists for this employee in this month'
          });
          continue;
        }

        // Get employee data for additional fields
        const employee = getEmployeeDataStmt.get(wage.master_roll_id, firmId);

        if (!employee) {
          results.push({
            master_roll_id: wage.master_roll_id,
            success: false,
            message: 'Employee not found'
          });
          continue;
        }

        // Calculate per day wage
        const perDayWage = calculatePerDayWage(wage.gross_salary, wage.wage_days);

        // Calculate net salary
        const netSalary = calculateNetSalary(
          wage.gross_salary,
          wage.epf_deduction,
          wage.esic_deduction,
          wage.other_deduction,
          wage.other_benefit
        );

        // Insert wage with positional parameters
        const result = insertWageStmt.run(
          firmId,
          wage.master_roll_id,
          perDayWage,
          wage.wage_days,
          employee.project || null,
          employee.site || null,
          wage.gross_salary,
          wage.epf_deduction || 0,
          wage.esic_deduction || 0,
          wage.other_deduction || 0,
          wage.other_benefit || 0,
          netSalary,
          month,
          wage.paid_date || null,
          wage.cheque_no || null,
          wage.paid_from_bank_ac || null,
          userId,
          userId
        );

        results.push({
          master_roll_id: wage.master_roll_id,
          wage_id: result.lastInsertRowid,
          success: true
        });

      } catch (error) {
        results.push({
          master_roll_id: wage.master_roll_id,
          success: false,
          message: error.message
        });
      }
    }
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Wages created successfully. Success: ${successCount}, Failed: ${failureCount}`,
      results: results,
      meta: {
        total: wages.length,
        success: successCount,
        failed: failureCount,
        month: month
      }
    });

  } catch (error) {
    console.error('Error creating wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/**
 * Update a single wage (for INDIVIDUAL EDIT)
 */
export async function updateWage(req, res) {
  try {
    const { id } = req.params;
    const { 
      wage_days, 
      gross_salary, 
      epf_deduction, 
      esic_deduction, 
      other_deduction, 
      other_benefit,
      paid_date,
      cheque_no,
      paid_from_bank_ac
    } = req.body;
    const userId = req.user.id;
    const firmId = req.user.firm_id;

    // Validate required fields
    if (!wage_days || gross_salary === undefined) {
      return res.status(400).json({ success: false, message: 'wage_days and gross_salary are required' });
    }

    // Get existing wage to verify ownership
    const existingWage = Wage.getById.get(parseInt(id), firmId);
    if (!existingWage) {
      return res.status(404).json({ success: false, message: 'Wage record not found or access denied' });
    }

    // Calculate new values
    const perDayWage = calculatePerDayWage(gross_salary, wage_days);
    const netSalary = calculateNetSalary(
      gross_salary,
      epf_deduction,
      esic_deduction,
      other_deduction,
      other_benefit
    );

    const result = db.prepare(`
      UPDATE wages
      SET 
        p_day_wage = ?,
        wage_days = ?,
        gross_salary = ?,
        epf_deduction = ?,
        esic_deduction = ?,
        other_deduction = ?,
        other_benefit = ?,
        net_salary = ?,
        paid_date = ?,
        cheque_no = ?,
        paid_from_bank_ac = ?,
        updated_by = ?,
        updated_at = datetime('now')
      WHERE id = ? AND firm_id = ?
    `).run(
      perDayWage,
      wage_days,
      gross_salary,
      epf_deduction || 0,
      esic_deduction || 0,
      other_deduction || 0,
      other_benefit || 0,
      netSalary,
      paid_date || null,
      cheque_no || null,
      paid_from_bank_ac || null,
      userId,
      parseInt(id),
      firmId
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Wage record not found' });
    }

    // Return updated wage
    const updatedWage = Wage.getById.get(parseInt(id), firmId);

    res.json({ 
      success: true, 
      message: 'Wage updated successfully',
      data: updatedWage
    });

  } catch (error) {
    console.error('Error updating wage:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/**
 * ✨ NEW: Bulk update wages (for BULK EDIT mode)
 * Updates multiple wage records at once
 */
export async function updateWagesBulk(req, res) {
  try {
    const { wages } = req.body;
    const userId = req.user.id;
    const firmId = req.user.firm_id;

    // Validate input
    if (!wages || !Array.isArray(wages) || wages.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid wage data. Provide wages array.' });
    }

    // Process wage updates (without transaction wrapper to avoid rollback issues)
    const results = [];

    for (const wage of wages) {
      try {
        // Validate required fields
        if (!wage.id || !wage.wage_days || wage.gross_salary === undefined) {
          results.push({
            id: wage.id,
            success: false,
            message: 'Missing required fields: id, wage_days, gross_salary'
          });
          continue;
        }

        // Verify ownership
        const existingWage = Wage.getById.get(parseInt(wage.id), firmId);
        if (!existingWage) {
          results.push({
            id: wage.id,
            success: false,
            message: 'Wage record not found or access denied'
          });
          continue;
        }

        // Calculate new values
        const perDayWage = calculatePerDayWage(wage.gross_salary, wage.wage_days);
        const netSalary = calculateNetSalary(
          wage.gross_salary,
          wage.epf_deduction,
          wage.esic_deduction,
          wage.other_deduction,
          wage.other_benefit
        );

        // Update wage
        const result = db.prepare(`
          UPDATE wages
          SET 
            p_day_wage = ?,
            wage_days = ?,
            gross_salary = ?,
            epf_deduction = ?,
            esic_deduction = ?,
            other_deduction = ?,
            other_benefit = ?,
            net_salary = ?,
            paid_date = ?,
            cheque_no = ?,
            paid_from_bank_ac = ?,
            updated_by = ?,
            updated_at = datetime('now')
          WHERE id = ? AND firm_id = ?
        `).run(
          perDayWage,
          wage.wage_days,
          wage.gross_salary,
          wage.epf_deduction || 0,
          wage.esic_deduction || 0,
          wage.other_deduction || 0,
          wage.other_benefit || 0,
          netSalary,
          wage.paid_date || null,
          wage.cheque_no || null,
          wage.paid_from_bank_ac || null,
          userId,
          parseInt(wage.id),
          firmId
        );

        results.push({
          id: wage.id,
          success: result.changes > 0,
          message: result.changes > 0 ? 'Updated' : 'No changes made'
        });

      } catch (error) {
        results.push({
          id: wage.id,
          success: false,
          message: error.message
        });
      }
    }
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Wages updated successfully. Success: ${successCount}, Failed: ${failureCount}`,
      results: results,
      meta: {
        total: wages.length,
        success: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    console.error('Error bulk updating wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/**
 * Delete a single wage
 */
export async function deleteWage(req, res) {
  try {
    const { id } = req.params;
    const firmId = req.user.firm_id;

    // Verify wage exists and belongs to firm
    const existingWage = Wage.getById.get(parseInt(id), firmId);
    if (!existingWage) {
      return res.status(404).json({ success: false, message: 'Wage record not found or access denied' });
    }

    const result = Wage.delete.run(parseInt(id), firmId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Wage record not found' });
    }

    res.json({ 
      success: true, 
      message: 'Wage deleted successfully',
      deletedId: parseInt(id)
    });

  } catch (error) {
    console.error('Error deleting wage:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/**
 * ✨ NEW: Bulk delete wages
 */
export async function deleteWagesBulk(req, res) {
  try {
    const { ids } = req.body;
    const firmId = req.user.firm_id;

    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid data. Provide ids array.' });
    }

    // Process wage deletions (without transaction wrapper to avoid rollback issues)
    const results = [];

    for (const id of ids) {
      try {
        // Verify ownership before deleting
        const existingWage = Wage.getById.get(parseInt(id), firmId);
        if (!existingWage) {
          results.push({
            id: id,
            success: false,
            message: 'Wage record not found or access denied'
          });
          continue;
        }

        const result = Wage.delete.run(parseInt(id), firmId);

        results.push({
          id: id,
          success: result.changes > 0,
          message: result.changes > 0 ? 'Deleted' : 'Not found'
        });

      } catch (error) {
        results.push({
          id: id,
          success: false,
          message: error.message
        });
      }
    }
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Wages deleted successfully. Success: ${successCount}, Failed: ${failureCount}`,
      results: results,
      meta: {
        total: ids.length,
        success: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    console.error('Error bulk deleting wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/**
 * Get wage by ID
 */
export async function getWageById(req, res) {
  try {
    const { id } = req.params;
    const firmId = req.user.firm_id;

    const wage = Wage.getById.get(parseInt(id), firmId);

    if (!wage) {
      return res.status(404).json({ success: false, message: 'Wage record not found or access denied' });
    }

    res.json({ success: true, data: wage });

  } catch (error) {
    console.error('Error fetching wage:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/**
 * Get wages for a specific month (backward compatibility)
 * DEPRECATED: Use getExistingWagesForMonth instead
 */
export async function getWagesForMonth(req, res) {
  try {
    const { month } = req.query;
    const firmId = req.user.firm_id;

    if (!month) {
      return res.status(400).json({ success: false, message: 'Month required (format: YYYY-MM)' });
    }

    const wages = Wage.getByFirmAndMonth.all(firmId, month);

    res.json({
      success: true,
      data: wages,
      meta: {
        total: wages.length,
        month: month
      }
    });

  } catch (error) {
    console.error('Error fetching wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}