/**
 * Bill Number Generator
 * Generates unique bill and voucher numbers per firm and financial year
 */

import { db } from './db.js';

/**
 * Get current financial year (April to March)
 * @returns {string} Financial year in format "YY-YY" (e.g., "24-25")
 */
function getCurrentFinancialYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  if (month >= 4) {
    // April onwards - current FY
    const startYear = year.toString().slice(-2);
    const endYear = (year + 1).toString().slice(-2);
    return `${startYear}-${endYear}`;
  } else {
    // Jan-Mar - previous FY
    const startYear = (year - 1).toString().slice(-2);
    const endYear = year.toString().slice(-2);
    return `${startYear}-${endYear}`;
  }
}

/**
 * Validate financial year format
 * @param {string} fy - Financial year string
 * @throws {Error} If format is invalid
 */
function validateFinancialYear(fy) {
  const fyRegex = /^\d{2}-\d{2}$/;
  if (!fyRegex.test(fy)) {
    throw new Error(`Invalid financial year format: ${fy}. Expected format: YY-YY`);
  }
}

/**
 * Generate next bill number atomically
 * @param {number} firmId - The firm ID
 * @param {string} billType - Bill type (SALES, PURCHASE, etc.)
 * @param {string} financialYear - Optional financial year (defaults to current)
 * @returns {string} The generated bill number
 */
function getNextBillNumber(firmId, billType = 'SALES', financialYear = null) {
  const fy = financialYear || getCurrentFinancialYear();
  validateFinancialYear(fy);

  // Determine prefix based on bill type
  let prefix;
  switch (billType.toUpperCase()) {
    case 'SALES':
      prefix = 'INV';
      break;
    case 'PURCHASE':
      prefix = 'PUR';
      break;
    case 'CREDIT_NOTE':
      prefix = 'CN';
      break;
    case 'DEBIT_NOTE':
      prefix = 'DN';
      break;
    case 'DELIVERY_NOTE':
      prefix = 'DLN';
      break;
    default:
      prefix = 'BILL';
  }

  // Use transaction to ensure atomicity
  const result = db.transaction(() => {
    // Get or create sequence record
    let seqRecord = db.prepare(`
      SELECT id, last_sequence 
      FROM bill_sequences 
      WHERE firm_id = ? AND financial_year = ? AND (voucher_type IS NULL OR voucher_type = '')
    `).get(firmId, fy);

    if (!seqRecord) {
      // Create new sequence record
      db.prepare(`
        INSERT INTO bill_sequences (firm_id, financial_year, last_sequence, voucher_type)
        VALUES (?, ?, 0, NULL)
      `).run(firmId, fy);

      seqRecord = db.prepare(`
        SELECT id, last_sequence 
        FROM bill_sequences 
        WHERE firm_id = ? AND financial_year = ? AND (voucher_type IS NULL OR voucher_type = '')
      `).get(firmId, fy);
    }

    // Increment sequence
    const nextSequence = seqRecord.last_sequence + 1;

    // Update sequence
    db.prepare(`
      UPDATE bill_sequences 
      SET last_sequence = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextSequence, seqRecord.id);

    // Generate bill number
    const billNo = `${prefix}F${firmId}-${String(nextSequence).padStart(4, '0')}/${fy}`;

    return billNo;
  })();

  return result;
}

/**
 * Generate next voucher number atomically
 * @param {number} firmId - The firm ID
 * @param {string} voucherType - 'PAYMENT', 'RECEIPT', or 'JOURNAL'
 * @param {string} financialYear - Optional financial year (defaults to current)
 * @returns {string} The generated voucher number
 */
function getNextVoucherNumber(firmId, voucherType, financialYear = null) {
  const fy = financialYear || getCurrentFinancialYear();
  validateFinancialYear(fy);

  // Validate voucher type
  const validTypes = ['PAYMENT', 'RECEIPT', 'JOURNAL'];
  if (!validTypes.includes(voucherType.toUpperCase())) {
    throw new Error(`Invalid voucher type: ${voucherType}. Must be PAYMENT, RECEIPT, or JOURNAL.`);
  }

  // Determine prefix
  let prefix;
  switch (voucherType.toUpperCase()) {
    case 'PAYMENT':
      prefix = 'PV';
      break;
    case 'RECEIPT':
      prefix = 'RV';
      break;
    case 'JOURNAL':
      prefix = 'JV';
      break;
  }

  // Use transaction to ensure atomicity
  const result = db.transaction(() => {
    // Get or create sequence record for this voucher type
    let seqRecord = db.prepare(`
      SELECT id, last_sequence 
      FROM bill_sequences 
      WHERE firm_id = ? AND financial_year = ? AND voucher_type = ?
    `).get(firmId, fy, voucherType);

    if (!seqRecord) {
      // Create new sequence record
      db.prepare(`
        INSERT INTO bill_sequences (firm_id, financial_year, last_sequence, voucher_type)
        VALUES (?, ?, 0, ?)
      `).run(firmId, fy, voucherType);

      seqRecord = db.prepare(`
        SELECT id, last_sequence 
        FROM bill_sequences 
        WHERE firm_id = ? AND financial_year = ? AND voucher_type = ?
      `).get(firmId, fy, voucherType);
    }

    // Increment sequence
    const nextSequence = seqRecord.last_sequence + 1;

    // Validate sequence limit (max 9999 per type per year)
    if (nextSequence > 9999) {
      throw new Error(`Voucher sequence limit exceeded for Firm ${firmId} in FY ${fy}. Max 9999 vouchers per type per year allowed.`);
    }

    // Update sequence
    db.prepare(`
      UPDATE bill_sequences 
      SET last_sequence = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextSequence, seqRecord.id);

    // Generate voucher number
    const voucherNo = `${prefix}F${firmId}-${String(nextSequence).padStart(4, '0')}/${fy}`;

    return voucherNo;
  })();

  return result;
}

/**
 * Preview next bill number WITHOUT incrementing the sequence
 * @param {number} firmId - The firm ID
 * @param {string} billType - Bill type (SALES, PURCHASE, etc.)
 * @param {string} financialYear - Optional financial year (defaults to current)
 * @returns {string} The preview bill number
 */
function previewNextBillNumber(firmId, billType = 'SALES', financialYear = null) {
  const fy = financialYear || getCurrentFinancialYear();
  validateFinancialYear(fy);

  // Determine prefix based on bill type
  let prefix;
  switch (billType.toUpperCase()) {
    case 'SALES':
      prefix = 'INV';
      break;
    case 'PURCHASE':
      prefix = 'PUR';
      break;
    case 'CREDIT_NOTE':
      prefix = 'CN';
      break;
    case 'DEBIT_NOTE':
      prefix = 'DN';
      break;
    case 'DELIVERY_NOTE':
      prefix = 'DLN';
      break;
    default:
      prefix = 'BILL';
  }

  // Get sequence record WITHOUT incrementing
  let seqRecord = db.prepare(`
    SELECT id, last_sequence 
    FROM bill_sequences 
    WHERE firm_id = ? AND financial_year = ? AND (voucher_type IS NULL OR voucher_type = '')
  `).get(firmId, fy);

  if (!seqRecord) {
    // If no record exists, the next sequence will be 1
    const nextSequence = 1;
    const billNo = `${prefix}F${firmId}-${String(nextSequence).padStart(4, '0')}/${fy}`;
    return billNo;
  }

  // Calculate what the next sequence WOULD be
  const nextSequence = seqRecord.last_sequence + 1;
  const billNo = `${prefix}F${firmId}-${String(nextSequence).padStart(4, '0')}/${fy}`;

  return billNo;
}

export {
  getCurrentFinancialYear,
  validateFinancialYear,
  getNextBillNumber,
  getNextVoucherNumber,
  previewNextBillNumber
};
