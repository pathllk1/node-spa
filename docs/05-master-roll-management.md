# Master Roll Management System Documentation

## Overview

The Master Roll Management System provides comprehensive employee data management with complete audit trails, bulk operations, and firm-level data isolation. It serves as the central employee database for the entire business management application.

## Architecture

### Core Components
- **Employee Records**: Complete employee profile management
- **Firm Isolation**: Multi-tenant architecture with firm-based data separation
- **Audit Trail**: Complete activity logging for all changes
- **Bulk Operations**: Import, export, and bulk modifications
- **Search & Filtering**: Advanced search capabilities
- **Role-Based Access**: Different permissions for users, managers, and admins

### Database Schema

#### Master Rolls Table
```sql
CREATE TABLE master_rolls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  employee_name TEXT NOT NULL,
  father_husband_name TEXT,
  date_of_birth TEXT,
  aadhar TEXT UNIQUE NOT NULL,
  pan TEXT,
  phone_no TEXT NOT NULL,
  address TEXT NOT NULL,
  bank TEXT NOT NULL,
  account_no TEXT NOT NULL,
  ifsc TEXT,
  branch TEXT,
  uan TEXT,
  esic_no TEXT,
  s_kalyan_no TEXT,
  category TEXT,
  p_day_wage REAL,
  project TEXT,
  site TEXT,
  date_of_joining TEXT NOT NULL,
  date_of_exit TEXT,
  doe_rem TEXT,
  status TEXT DEFAULT 'Active',
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);
```

## Employee Data Structure

### Complete Employee Profile
```javascript
{
  id: 1,
  firm_id: 1,
  employee_name: "John Doe",
  father_husband_name: "Robert Doe",
  date_of_birth: "1990-01-15",
  aadhar: "123456789012",
  pan: "AAAAA0000A",
  phone_no: "9876543210",
  address: "123 Main Street, City, State - 400001",
  bank: "State Bank of India",
  account_no: "1234567890",
  ifsc: "SBIN0000123",
  branch: "Main Branch",
  uan: "123456789012",
  esic_no: "31/12345/67890",
  s_kalyan_no: "MH/123/456789",
  category: "Skilled",
  p_day_wage: 450.00,
  project: "Project Alpha",
  site: "Site 1",
  date_of_joining: "2023-01-01",
  date_of_exit: null,
  doe_rem: "Resigned",
  status: "Active",
  created_by: 1,
  updated_by: 1,
  created_at: "2023-01-01T10:00:00.000Z",
  updated_at: "2023-12-01T14:30:00.000Z"
}
```

## API Endpoints

### CRUD Operations
```
POST   /api/master-rolls           # Create employee
GET    /api/master-rolls           # Get all employees (firm-filtered)
GET    /api/master-rolls/:id       # Get employee by ID
PUT    /api/master-rolls/:id       # Update employee
DELETE /api/master-rolls/:id       # Delete employee
```

### Advanced Operations
```
GET    /api/master-rolls/search?q=query    # Search employees
GET    /api/master-rolls/stats             # Get statistics
GET    /api/master-rolls/:id/activity      # Get activity log
POST   /api/master-rolls/bulk-import       # Bulk import
POST   /api/master-rolls/bulk-create       # Bulk create
DELETE /api/master-rolls/bulk-delete       # Bulk delete
GET    /api/master-rolls/export            # Export data
```

## Firm-Level Data Isolation

### Access Control Logic
```javascript
// Role-based access control
if (role === 'super_admin') {
  // Access all firms
  rows = getAllStmt.all();
} else {
  // Access only own firm
  rows = getAllByFirmStmt.all(firm_id);
}
```

### Ownership Verification
```javascript
// Check firm ownership for operations
const ownership = checkFirmOwnership.get(masterId, firmId);
if (!ownership) {
  return res.status(404).json({
    error: 'Employee not found or access denied'
  });
}
```

## Audit Trail System

### Activity Logging
```javascript
// Automatic activity logging
const activities = db.prepare(`
  SELECT 
    'created' as action,
    created_at as timestamp,
    u.fullname as user_name
  FROM master_rolls mr
  LEFT JOIN users u ON u.id = mr.created_by
  WHERE mr.id = ?
  
  UNION ALL
  
  SELECT 
    'updated' as action,
    updated_at as timestamp,
    u.fullname as user_name
  FROM master_rolls mr
  LEFT JOIN users u ON u.id = mr.updated_by
  WHERE mr.id = ? AND mr.updated_at != mr.created_at
`).all(id, id);
```

### User Tracking
```javascript
// All operations track the user
const result = insertStmt.run(
  firm_id,
  employee_name,
  // ... other fields
  user_id,  // created_by
  user_id   // updated_by
);
```

## Bulk Operations

### Bulk Import
```javascript
POST /api/master-rolls/bulk-import
Body: {
  employees: [
    {
      employee_name: "John Doe",
      aadhar: "123456789012",
      phone_no: "9876543210",
      // ... other fields
    }
  ]
}

Response: {
  success: true,
  imported: 5,
  failed: 2,
  details: {
    success: [{ index: 0, id: 1, name: "John Doe" }],
    failed: [{ index: 6, name: "Jane Doe", error: "Duplicate Aadhar" }]
  }
}
```

### Bulk Delete
```javascript
DELETE /api/master-rolls/bulk-delete
Body: { ids: [1, 2, 3] }

Response: {
  success: true,
  deleted: 3,
  failed: 0,
  deleted_by: {
    id: 1,
    name: "Admin User",
    role: "admin"
  }
}
```

## Search and Filtering

### Advanced Search
```javascript
GET /api/master-rolls/search?q=john&limit=50&offset=0

// Searches across multiple fields:
- employee_name
- aadhar
- phone_no
- project
- site
```

### Statistics Dashboard
```javascript
GET /api/master-rolls/stats

Response: {
  success: true,
  data: {
    total_employees: 150,
    active_employees: 140,
    exited_employees: 10,
    total_projects: 5,
    total_sites: 8
  }
}
```

## Data Validation

### Required Fields Validation
```javascript
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
```

### Unique Constraints
```javascript
// Aadhar must be unique across the system
try {
  const result = insertStmt.run(...params);
} catch (err) {
  if (err.message.includes('UNIQUE constraint')) {
    return res.status(400).json({
      success: false,
      error: 'Employee with this Aadhar already exists'
    });
  }
}
```

## Export Functionality

### Multiple Formats
```javascript
GET /api/master-rolls/export?format=csv

// CSV Export with proper escaping
const headers = Object.keys(rows[0]).join(',');
const csvRows = rows.map(row =>
  Object.values(row).map(val =>
    typeof val === 'string' && val.includes(',')
      ? `"${val}"`
      : val
  ).join(',')
);
const csv = [headers, ...csvRows].join('\n');
```

### JSON Export
```javascript
GET /api/master-rolls/export?format=json

Response: {
  success: true,
  count: 150,
  data: [/* employee objects */]
}
```

## Performance Optimizations

### Prepared Statements
```javascript
const insertStmt = db.prepare(`
  INSERT INTO master_rolls (
    firm_id, employee_name, father_husband_name, date_of_birth,
    aadhar, pan, phone_no, address, bank, account_no, ifsc,
    branch, uan, esic_no, s_kalyan_no, category, p_day_wage,
    project, site, date_of_joining, date_of_exit, doe_rem,
    status, created_by, updated_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
```

### Indexed Queries
```javascript
// Optimized search with LIMIT/OFFSET
const searchStmt = db.prepare(`
  SELECT * FROM master_rolls
  WHERE firm_id = ? AND (
    employee_name LIKE ? OR aadhar LIKE ? OR
    phone_no LIKE ? OR project LIKE ? OR site LIKE ?
  )
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`);
```

## Security Features

### Firm-Based Access Control
- All queries filtered by `firm_id`
- Users can only access their firm's employees
- Super admins have cross-firm access

### Input Validation
- SQL injection prevention through prepared statements
- XSS protection through proper escaping
- Data type validation

### Audit Compliance
- Complete change history tracking
- User attribution for all operations
- Timestamp logging

## Integration Points

### Wages System Integration
- Employee data used for wage calculations
- Bank details for payment processing
- Project/site information for categorization

### Inventory System Integration
- Employee information for stock assignments
- Project tracking for resource allocation

### Reporting Integration
- Employee statistics for business analytics
- Export capabilities for external systems

This master roll system provides a robust foundation for employee management with enterprise-grade features including multi-tenancy, audit trails, bulk operations, and comprehensive data validation suitable for business operations.
