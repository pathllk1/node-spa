# Wages Management System Documentation

## Overview

The Wages Management System provides comprehensive payroll processing for employees, including wage calculation, deductions, benefits, and payment tracking. It supports both individual and bulk operations with automatic EPF and ESIC calculations compliant with Indian labor laws.

## Architecture

### Core Components
- **Employee Eligibility**: Automatic filtering based on joining/exit dates and payment status
- **Wage Calculation**: Automatic EPF (12%, max ₹1800) and ESIC (0.75%) calculations
- **Bulk Operations**: Create, update, and delete multiple wage records simultaneously
- **Payment Tracking**: Cheque numbers, payment dates, and bank account tracking
- **Audit Trail**: Full tracking of changes with user information

### Database Schema

#### Wages Table
```sql
CREATE TABLE wages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  master_roll_id INTEGER NOT NULL,
  p_day_wage REAL NOT NULL DEFAULT 0,
  wage_days INTEGER NOT NULL DEFAULT 26,
  project TEXT,
  site TEXT,
  gross_salary REAL NOT NULL DEFAULT 0,
  epf_deduction REAL DEFAULT 0,
  esic_deduction REAL DEFAULT 0,
  other_deduction REAL DEFAULT 0,
  other_benefit REAL DEFAULT 0,
  net_salary REAL NOT NULL DEFAULT 0,
  salary_month TEXT NOT NULL, -- YYYY-MM format
  paid_date TEXT,
  cheque_no TEXT,
  paid_from_bank_ac TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id),
  FOREIGN KEY (master_roll_id) REFERENCES master_rolls(id)
);
```

## Wage Calculation Logic

### Automatic Calculations
```javascript
// EPF Calculation (12% of gross, max ₹1800)
const epfDeduction = Math.min(
  Math.round(grossSalary * 0.12), 
  1800
);

// ESIC Calculation (0.75% of gross, rounded up)
const esicDeduction = Math.ceil(grossSalary * 0.0075);

// Net Salary
const netSalary = grossSalary - totalDeductions + totalBenefits;
```

### Eligibility Rules
```javascript
function isEmployeeEligible(employee, yearMonth) {
  const monthStart = `${yearMonth}-01`;
  const monthEnd = getMonthEndDate(yearMonth);

  // Check joining date (must be before or on month end)
  if (employee.date_of_joining > monthEnd) return false;

  // Check exit date (must be after month start or null)
  if (employee.date_of_exit && employee.date_of_exit < monthStart) return false;

  return true;
}
```

### Per-Day Wage Calculation
```javascript
const perDayWage = wageDays > 0 
  ? parseFloat((grossSalary / wageDays).toFixed(2)) 
  : 0;
```

## API Endpoints

### Employee Selection
```
GET /api/wages/employees?month=YYYY-MM
```
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "master_roll_id": 1,
      "employee_name": "John Doe",
      "aadhar": "123456789012",
      "bank": "SBI",
      "account_no": "1234567890",
      "p_day_wage": 500,
      "last_wage_days": 26,
      "last_gross_salary": 13000,
      "date_of_joining": "2023-01-01",
      "date_of_exit": null
    }
  ],
  "meta": {
    "total": 10,
    "total_active": 12,
    "already_paid": 2,
    "month": "2024-01"
  }
}
```

### Bulk Wage Creation
```
POST /api/wages/create
Body: {
  "month": "2024-01",
  "wages": [
    {
      "master_roll_id": 1,
      "gross_salary": 13000,
      "wage_days": 26,
      "epf_deduction": 1560,
      "esic_deduction": 98,
      "other_deduction": 0,
      "other_benefit": 0,
      "paid_date": "2024-01-31",
      "cheque_no": "CH001",
      "paid_from_bank_ac": "123456789"
    }
  ]
}
```

### Wage Management
```
GET /api/wages/manage?month=YYYY-MM
PUT /api/wages/bulk-update
PUT /api/wages/:id
DELETE /api/wages/:id
DELETE /api/wages/bulk-delete
```

## Client-Side Features

### Dual-Mode Interface
- **Create Mode**: Select eligible employees and create wages for a specific month
- **Manage Mode**: View, edit, and manage existing wage records

### Bulk Operations
```javascript
// Select multiple employees/wages
const selectedEmployeeIds = new Set([1, 2, 3]);

// Bulk create wages
await api.post('/api/wages/create', { 
  month: selectedMonth, 
  wages: wageRecords 
});

// Bulk update wages
await api.put('/api/wages/bulk-update', { 
  wages: wagesToUpdate 
});
```

### Real-Time Calculations
```javascript
// Auto-calculate when wage_days or gross_salary changes
if (field === 'wage_days' || field === 'gross_salary') {
  const dailyRate = wageData[empId].p_day_wage || 0;
  const wageDays = wageData[empId].wage_days || 26;
  
  wageData[empId].gross_salary = parseFloat((dailyRate * wageDays).toFixed(2));
  
  // Recalculate deductions
  wageData[empId].epf_deduction = Math.min(
    Math.round(wageData[empId].gross_salary * 0.12), 
    1800
  );
  wageData[empId].esic_deduction = Math.ceil(
    wageData[empId].gross_salary * 0.0075
  );
}
```

### Advanced Filtering
```javascript
const filters = {
  searchTerm: 'John', // Name, Aadhar, Account No
  bankFilter: 'SBI',
  projectFilter: 'Project A',
  siteFilter: 'Site 1',
  paidFilter: 'all' // 'all', 'paid', 'unpaid'
};
```

### Excel Export
```javascript
function exportToExcel() {
  const data = employees.map(emp => ({
    'Employee Name': emp.employee_name,
    'Bank': emp.bank,
    'Account No': emp.account_no,
    'Per Day Wage': wage.p_day_wage,
    'Wage Days': wage.wage_days,
    'Gross Salary': wage.gross_salary,
    'EPF': wage.epf_deduction,
    'ESIC': wage.esic_deduction,
    'Net Salary': calculateNetSalary(...)
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Wages');
  XLSX.writeFile(wb, `Wages_${month}_create.xlsx`);
}
```

## Security Features

### Firm-Level Isolation
- All queries filtered by `firm_id`
- Users can only access wages for their firm
- Employee data protected by firm boundaries

### Duplicate Prevention
```javascript
// Check for existing wages before creation
const existingWage = checkWageExistsStmt.get(firmId, wage.master_roll_id, month);
if (existingWage) {
  return { success: false, message: 'Wage already exists for this employee' };
}
```

### Validation Rules
- Wage days: 1-31
- EPF deduction: max ₹1800
- No negative values allowed
- Required fields validation

## Business Rules

### Salary Month Processing
- Wages are processed monthly (YYYY-MM format)
- Employees can only receive one wage per month
- Joining/exit dates determine eligibility
- Previous month's data used as defaults

### EPF & ESIC Compliance
- EPF: 12% of basic salary, capped at ₹1800
- ESIC: 0.75% of gross salary, rounded up
- Calculations follow Indian labor law requirements

### Payment Tracking
- Cheque numbers for payment tracking
- Payment dates for audit purposes
- Bank account information from master roll
- Payment status tracking

## Performance Optimizations

### Prepared Statements
```javascript
const insertWageStmt = db.prepare(`
  INSERT INTO wages (
    firm_id, master_roll_id, p_day_wage, wage_days,
    gross_salary, epf_deduction, esic_deduction,
    net_salary, salary_month, paid_date, cheque_no,
    paid_from_bank_ac, created_by, updated_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
```

### Bulk Operations
- Single transaction for multiple records
- Optimized database queries
- Client-side batching for large datasets

### Efficient Filtering
- Server-side filtering with indexed columns
- Debounced search input
- Pagination support for large datasets

## Error Handling

### Validation Errors
```javascript
// Required fields validation
if (!wage.master_roll_id || wage.gross_salary === undefined || !wage.wage_days) {
  results.push({
    success: false,
    message: 'Missing required fields: master_roll_id, gross_salary, wage_days'
  });
  continue;
}
```

### Duplicate Detection
```javascript
// Check for existing wages
const existingWage = Wage.getByFirmAndMonth.get(firmId, month, masterRollId);
if (existingWage) {
  return res.status(400).json({ 
    success: false, 
    error: 'Wage already exists for this employee in this month' 
  });
}
```

### Bulk Operation Results
```javascript
const results = wages.map(wage => ({
  master_roll_id: wage.master_roll_id,
  success: true/false,
  message: error_description,
  wage_id: created_id
}));
```

This wages management system provides a complete payroll solution with automated calculations, bulk operations, and comprehensive audit trails suitable for business operations.
