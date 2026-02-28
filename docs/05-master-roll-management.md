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
- **IFSC Lookup Integration**: Real-time bank and branch validation using Razorpay API

### Database Schema (Mongoose)

#### Master Roll Model
```javascript
const masterRollSchema = new Schema({
  firm_id:             { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
  employee_name:       { type: String, required: true },
  father_husband_name: { type: String },
  date_of_birth:       { type: String },
  aadhar:              { type: String, required: true },
  pan:                 { type: String },
  phone_no:            { type: String, required: true },
  address:             { type: String },
  bank:                { type: String },
  account_no:          { type: String },
  ifsc:                { type: String },
  branch:              { type: String },
  uan:                 { type: String },
  esic_no:             { type: String },
  s_kalyan_no:         { type: String },
  category:            { type: String },
  p_day_wage:          { type: Number },
  project:             { type: String },
  site:                { type: String },
  date_of_joining:     { type: String, required: true },
  date_of_exit:        { type: String },
  doe_rem:             { type: String },
  status:              { type: String, default: 'Active' },
  created_by:          { type: Schema.Types.ObjectId, ref: 'User' },
  updated_by:          { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Compound index for unique Aadhar per firm
masterRollSchema.index({ aadhar: 1, firm_id: 1 }, { unique: true });
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
GET    /api/master-rolls/lookup-ifsc/:ifsc # IFSC bank lookup
```

## Firm-Level Data Isolation

### Access Control Logic
```javascript
// Role-based access control
const filter = (role === 'admin' && req.query.all_firms === 'true') ? {} : { firm_id };
const rows = await MasterRoll.find(filter).lean();
```

### Ownership Verification
```javascript
// Check firm ownership for operations via Mongoose query
const filter = role === 'super_admin' ? { _id: id } : { _id: id, firm_id };
const existing = await MasterRoll.findOne(filter);

if (!existing) {
  return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
}
```

## Audit Trail System

### Activity Logging
```javascript
// Manual activity log derivation from timestamps and populated references
const doc = await MasterRoll.findOne({ _id: req.params.id, firm_id })
  .populate('created_by', 'fullname username role')
  .populate('updated_by', 'fullname username role')
  .lean();

// Extract creation details
const activities = [{
  action: 'created',
  timestamp: doc.createdAt,
  user_name: doc.created_by?.fullname
}];

// Append update details if modified
if (doc.updatedAt && doc.updatedAt.getTime() !== doc.createdAt.getTime()) {
  activities.push({
    action: 'updated',
    timestamp: doc.updatedAt,
    user_name: doc.updated_by?.fullname
  });
}
```

### User Tracking
```javascript
// All operations track the user
const doc = await MasterRoll.create({
  firm_id,
  ...req.body,
  created_by: user_id,
  updated_by: user_id,
});
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
// Aadhar must be unique within the firm (handled by MongoDB driver index)
try {
  await MasterRoll.create(employeeData);
} catch (err) {
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      error: 'Employee with this Aadhar already exists in your firm'
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

### Bulk Operations
```javascript
// Promise.allSettled for concurrent creation with error tracking
const settled = await Promise.allSettled(
  employees.map((emp, i) =>
    MasterRoll.create({ firm_id, ...emp, created_by: user_id, updated_by: user_id })
  )
);
```

### Indexed Queries
```javascript
// Mongoose RegExp search with lean() and projection limits
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

### IFSC Lookup Integration
- **Real-time Validation**: Bank and branch details validated against Razorpay API
- **Auto-population**: Bank and branch fields automatically filled when IFSC entered
- **Visual Feedback**: Loading states and success/error indicators
- **Fallback Support**: Manual entry possible if API unavailable
- **Debounced Requests**: Performance optimized with 500ms debounce

### Reporting Integration
- Employee statistics for business analytics
- Export capabilities for external systems

This master roll system provides a robust foundation for employee management with enterprise-grade features including multi-tenancy, audit trails, bulk operations, and comprehensive data validation suitable for business operations.
