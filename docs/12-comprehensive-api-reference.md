# Complete API Reference Documentation

## Overview

This document provides a comprehensive reference for all API endpoints available in the Node.js SPA Business Management Application. The API follows RESTful conventions with JSON responses and JWT authentication.

## Authentication & CSRF

The API uses **HTTP-only cookies** for JWT authentication, meaning you do not need to manually attach an `Authorization` header if your client supports cookies (e.g., `credentials: 'same-origin'` in `fetch`).

Additionally, all state-changing endpoints (POST, PUT, DELETE, PATCH) require a CSRF token to be sent in the headers.

```javascript
// Example of a state-changing request
const csrfToken = getCookie('csrfToken'); // Custom helper to read non-HttpOnly cookie
const headers = {
  'Content-Type': 'application/json',
  'x-csrf-token': csrfToken
};
```

## API Structure

```
├── /api/auth/*          - Authentication endpoints
├── /api/admin/*         - Administrative functions
├── /api/inventory/*     - Inventory management
├── /api/master-rolls/* - Employee master roll
├── /api/wages/*        - Wages management
├── /api/settings/*     - Application settings
```

---

## 1. Authentication API

### POST /api/auth/login
Authenticate user and receive JWT tokens.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "string",
    "fullname": "string",
    "email": "string",
    "role": "admin|manager|user",
    "firm_id": 1
  }
}
```

**Cookies Set:**
- `accessToken`: JWT access token (15min expiry)
- `refreshToken`: JWT refresh token (30 days expiry)
- `tokenExpiry`: Expiry timestamp for client-side refresh

### POST /api/auth/logout
Clear authentication tokens and log out user (Requires CSRF Token).

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /api/auth/me
Get current authenticated user information.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "string",
    "fullname": "string",
    "role": "admin|manager|user",
    "firm_id": 1
  }
}
```

### POST /api/auth/refresh
Refresh access token using refresh token.

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed"
}
```

---

## 2. Master Roll API

### Employee CRUD Operations

#### POST /api/master-rolls
Create new employee record.

**Request Body:**
```json
{
  "employee_name": "string",
  "father_husband_name": "string",
  "date_of_birth": "YYYY-MM-DD",
  "aadhar": "12-digit number",
  "pan": "10-character PAN",
  "phone_no": "10-digit number",
  "address": "string",
  "bank": "string",
  "account_no": "string",
  "ifsc": "11-character IFSC",
  "branch": "string",
  "uan": "string",
  "esic_no": "string",
  "s_kalyan_no": "string",
  "category": "string",
  "p_day_wage": 450.00,
  "project": "string",
  "site": "string",
  "date_of_joining": "YYYY-MM-DD",
  "date_of_exit": "YYYY-MM-DD",
  "doe_rem": "string",
  "status": "Active|Inactive|On Leave|Suspended"
}
```

**Response:**
```json
{
  "success": true,
  "id": 123,
  "message": "Employee added to master roll",
  "created_by": {
    "id": 1,
    "name": "Admin User",
    "username": "admin"
  }
}
```

#### GET /api/master-rolls
Get all employees for user's firm (paginated).

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search term

**Response:**
```json
{
  "success": true,
  "count": 150,
  "data": [
    {
      "id": 1,
      "employee_name": "John Doe",
      "father_husband_name": "Robert Doe",
      "date_of_birth": "1990-01-15",
      "aadhar": "123456789012",
      "pan": "AAAAA0000A",
      "phone_no": "9876543210",
      "address": "123 Main Street",
      "bank": "State Bank of India",
      "account_no": "1234567890",
      "ifsc": "SBIN0001234",
      "branch": "Main Branch",
      "uan": "123456789012",
      "esic_no": "31/12345/67890",
      "s_kalyan_no": "MH/123/456789",
      "category": "Skilled",
      "p_day_wage": 450.00,
      "project": "Project Alpha",
      "site": "Site 1",
      "date_of_joining": "2023-01-01",
      "date_of_exit": null,
      "doe_rem": null,
      "status": "Active",
      "created_at": "2023-01-01T10:00:00.000Z",
      "updated_at": "2023-12-01T14:30:00.000Z"
    }
  ]
}
```

#### GET /api/master-rolls/:id
Get specific employee by ID.

**Response:**
```json
{
  "success": true,
  "data": { /* employee object */ }
}
```

#### PUT /api/master-rolls/:id
Update employee record.

**Request Body:** Same as create, only changed fields required.

**Response:**
```json
{
  "success": true,
  "message": "Employee updated successfully",
  "updated_by": 1
}
```

#### DELETE /api/master-rolls/:id
Delete employee record.

**Response:**
```json
{
  "success": true,
  "message": "Employee deleted successfully"
}
```

### Advanced Master Roll Operations

#### GET /api/master-rolls/search
Search employees across multiple fields.

**Query Parameters:**
- `q`: Search query
- `limit`: Maximum results (default: 50)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [ /* employee objects */ ]
}
```

#### GET /api/master-rolls/stats
Get employee statistics for user's firm.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_employees": 150,
    "active_employees": 140,
    "exited_employees": 10,
    "total_projects": 5,
    "total_sites": 8
  }
}
```

#### GET /api/master-rolls/:id/activity
Get activity log for specific employee.

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "action": "created",
      "timestamp": "2023-01-01T10:00:00.000Z",
      "user_name": "Admin User",
      "username": "admin",
      "user_role": "admin"
    },
    {
      "action": "updated",
      "timestamp": "2023-12-01T14:30:00.000Z",
      "user_name": "Manager User",
      "username": "manager",
      "user_role": "manager"
    }
  ]
}
```

#### GET /api/master-rolls/lookup-ifsc/:ifsc
Lookup bank and branch details using IFSC code via Razorpay API.

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "ifsc": "SBIN0001234",
    "bank": "State Bank of India",
    "branch": "Main Branch",
    "address": "123 Main Street, Mumbai",
    "city": "Mumbai",
    "state": "Maharashtra",
    "district": "Mumbai",
    "bankcode": "SBIN",
    "micr": "400002001"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "IFSC 'INVALID12' not found. Please check the code."
}
```

### Bulk Operations

#### POST /api/master-rolls/bulk-import
Bulk import employees from Excel/CSV.

**Request Body:** FormData with file
**Response:**
```json
{
  "success": true,
  "imported": 95,
  "failed": 5,
  "details": {
    "success": [/* imported records */],
    "failed": [/* failed records with errors */]
  }
}
```

#### POST /api/master-rolls/bulk-create
Bulk create multiple employees.

**Request Body:**
```json
[
  { /* employee object 1 */ },
  { /* employee object 2 */ }
]
```

**Response:**
```json
{
  "success": true,
  "message": "Processed 100 rows.",
  "imported": 95,
  "failed": 5,
  "errors": ["Duplicate Aadhar: 123456789012"]
}
```

#### DELETE /api/master-rolls/bulk-delete
Bulk delete multiple employees.

**Request Body:**
```json
{
  "ids": [1, 2, 3, 4, 5]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deleted 5 out of 5 employees",
  "deleted": 5,
  "failed": 0,
  "failedIds": [],
  "deleted_by": {
    "id": 1,
    "name": "Admin User",
    "username": "admin",
    "role": "admin"
  }
}
```

#### GET /api/master-rolls/export
Export employee data.

**Query Parameters:**
- `format`: 'json' or 'csv' (default: json)

**Response:** JSON array or CSV file download

---

## 3. Ledger System API

### Account Management

#### GET /api/ledger/accounts
Get all ledger accounts with balances for current firm.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "account_head": "Cash",
      "account_type": "BANK",
      "total_debit": 50000.00,
      "total_credit": 25000.00,
      "balance": 25000.00
    }
  ]
}
```

#### GET /api/ledger/accounts/:accountHead
Get detailed transaction history for specific account.

**Query Parameters:**
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD

#### GET /api/ledger/account-types
Get account type summaries.

#### GET /api/ledger/suggestions
Get account head suggestions for autocomplete.

**Query Parameters:**
- `q`: Search term

### Financial Reports

#### GET /api/ledger/reports/account-ledger
Generate account ledger PDF report.

**Query Parameters:**
- `account_head`: Account name (required)
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD

**Response:** PDF file download

#### GET /api/ledger/reports/general-ledger
Generate general ledger PDF report.

**Query Parameters:**
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD

**Response:** PDF file download

#### GET /api/ledger/reports/trial-balance
Generate trial balance PDF report.

**Query Parameters:**
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD

**Response:** PDF file download

#### GET /api/ledger/reports/account-type
Generate account type summary PDF report.

**Query Parameters:**
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD

**Response:** PDF file download

---

## 4. Voucher System API

### Payment & Receipt Vouchers

#### POST /api/ledger/vouchers
Create payment or receipt voucher.

**Request Body:**
```json
{
  "voucher_type": "PAYMENT",
  "party_id": 1,
  "amount": 10000.00,
  "payment_mode": "Cash",
  "narration": "Office supplies payment",
  "transaction_date": "2024-01-15",
  "bank_account_id": null
}
```

#### GET /api/ledger/vouchers
Get vouchers with pagination and filtering.

**Query Parameters:**
- `voucher_type`: 'PAYMENT' or 'RECEIPT'
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD
- `party_id`: Party ID
- `search`: Search term
- `page`: Page number
- `limit`: Items per page

#### GET /api/ledger/vouchers/:id
Get specific voucher details.

#### PUT /api/ledger/vouchers/:id
Update existing voucher.

#### GET /api/ledger/vouchers/parties/:partyId
Get vouchers for specific party.

#### GET /api/ledger/vouchers/summary
Get voucher statistics.

---

## 5. Journal Entry System API

### General Journal Entries

#### POST /api/ledger/journal-entries
Create journal entry with multiple lines.

**Request Body:**
```json
{
  "entries": [
    {
      "account_head": "Equipment",
      "account_type": "ASSET",
      "debit_amount": 50000.00,
      "credit_amount": 0,
      "narration": "Purchase of equipment"
    },
    {
      "account_head": "Cash",
      "account_type": "BANK",
      "debit_amount": 0,
      "credit_amount": 50000.00,
      "narration": "Payment for equipment"
    }
  ],
  "narration": "Equipment purchase transaction",
  "transaction_date": "2024-01-15"
}
```

#### GET /api/ledger/journal-entries
Get journal entries with pagination and filtering.

**Query Parameters:**
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD
- `search`: Search term
- `page`: Page number
- `limit`: Items per page

#### GET /api/ledger/journal-entries/:id
Get specific journal entry with all lines.

#### PUT /api/ledger/journal-entries/:id
Update existing journal entry.

#### DELETE /api/ledger/journal-entries/:id
Delete journal entry.

#### GET /api/ledger/journal-entries/summary
Get journal entry statistics.

---

## 6. Inventory Management API

### Stock Management

#### GET /api/inventory/sales/stocks
Get all stocks for user's firm.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "item": "Product Name",
      "hsn": "12345678",
      "qty": 100.00,
      "uom": "PCS",
      "rate": 50.00,
      "grate": 18.00,
      "total": 5000.00,
      "mrp": 60.00,
      "batches": "[{\"batch\":\"BATCH001\",\"qty\":100,\"rate\":50,\"expiry\":\"2025-12-31\",\"mrp\":60}]",
      "created_at": "2023-01-01T10:00:00.000Z"
    }
  ]
}
```

#### POST /api/inventory/sales/stocks
Create new stock item.

**Request Body:**
```json
{
  "item": "Product Name",
  "hsn": "12345678",
  "qty": 100,
  "uom": "PCS",
  "rate": 50.00,
  "batches": [
    {
      "batch": "BATCH001",
      "qty": 100,
      "rate": 50.00,
      "expiry": "2025-12-31",
      "mrp": 60.00
    }
  ]
}
```

#### GET /api/inventory/sales/stocks/:id
Get specific stock item.

#### PUT /api/inventory/sales/stocks/:id
Update stock item.

#### DELETE /api/inventory/sales/stocks/:id
Delete stock item.

### Party Management

#### GET /api/inventory/sales/parties
Get all parties for user's firm.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "firm": "ABC Corporation",
      "gstin": "22AAAAA0000A1Z5",
      "contact": "+91-9876543210",
      "state": "Maharashtra",
      "state_code": 27,
      "addr": "123 Business Street",
      "pin": "400001",
      "pan": "AAAAA0000A"
    }
  ]
}
```

#### POST /api/inventory/sales/parties
Create new party.

**Request Body:**
```json
{
  "firm": "ABC Corporation",
  "gstin": "22AAAAA0000A1Z5",
  "contact": "+91-9876543210",
  "state": "Maharashtra",
  "state_code": 27,
  "addr": "123 Business Street",
  "pin": "400001",
  "pan": "AAAAA0000A"
}
```

### Bill Management

#### POST /api/inventory/sales/bills
Create sales bill with automatic stock deduction and ledger posting.

**Request Body:**
```json
{
  "party_id": 1,
  "items": [
    {
      "stock_id": 1,
      "batch": "BATCH001",
      "qty": 10,
      "rate": 50.00,
      "disc": 0,
      "grate": 18.00
    }
  ],
  "other_charges": [
    {
      "name": "Transport",
      "amount": 100.00,
      "gst_rate": 18.00
    }
  ],
  "narration": "Sales bill description"
}
```

**Response:**
```json
{
  "success": true,
  "bill_no": "SL/001/2024",
  "id": 123,
  "message": "Bill created successfully"
}
```

#### GET /api/inventory/sales/bills
Get all bills for user's firm.

**Query Parameters:**
- `page`, `limit`, `search`, `status`, `date_from`, `date_to`

#### GET /api/inventory/sales/bills/:id
Get specific bill details.

#### PUT /api/inventory/sales/bills/:id
Update bill (if not cancelled).

#### PUT /api/inventory/sales/bills/:id/cancel
Cancel bill with stock restoration and financial reversal.

**Request Body:**
```json
{
  "reason": "CUSTOMER_REQUEST",
  "remarks": "Customer requested cancellation due to wrong item"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bill cancelled successfully"
}
```

#### GET /api/inventory/sales/bills/:id/pdf
Generate PDF invoice for bill.

**Response:** PDF file download

### Stock Movements

#### GET /api/inventory/sales/stock-movements
Get stock movement history.

**Query Parameters:**
- `type`, `batchFilter`, `searchTerm`, `page`, `limit`, `partyId`, `stockId`

#### GET /api/inventory/sales/stock-movements/:stockId
Get movements for specific stock item.

#### POST /api/inventory/sales/stock-movements
Create stock movement (receipt, transfer, adjustment).

### Utility Endpoints

#### GET /api/inventory/sales/other-charges-types
Get available other charges types.

#### GET /api/inventory/sales/next-bill-number
Get preview of next bill number.

#### GET /api/inventory/sales/party-balance/:partyId
Get party account balance.

#### POST /api/inventory/sales/gst-lookup
Validate GST number.

**Request Body:**
```json
{
  "gstin": "22AAAAA0000A1Z5"
}
```

---

## 4. Wages Management API

### GET /api/wages/dashboard
Get wages dashboard data.

### GET /api/wages/employees
Get employees for wages calculation.

### POST /api/wages/calculate
Calculate wages for employees.

**Request Body:**
```json
{
  "employee_ids": [1, 2, 3],
  "month": "2024-01",
  "working_days": 26
}
```

### GET /api/wages/reports
Get wages reports.

### POST /api/wages/export
Export wages data.

---

## 5. Administrative API

### Firm Management

#### GET /api/admin/firms
Get all firms (super admin only).

#### POST /api/admin/firms
Create new firm.

#### GET /api/admin/firms/:id
Get firm details.

#### PUT /api/admin/firms/:id
Update firm.

### User Management

#### GET /api/admin/users
Get all users.

#### POST /api/admin/users
Create new user.

#### PUT /api/admin/users/:id
Update user.

#### DELETE /api/admin/users/:id
Delete user.

### System Settings

#### GET /api/admin/settings
Get system settings.

#### PUT /api/admin/settings
Update system settings.

---

## Error Response Format

All API errors follow this standard format:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE" // Optional error code
}
```

### Common HTTP Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid/missing token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict (duplicate data)
- **500**: Internal Server Error

### Authentication Errors

```json
{
  "success": false,
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED"
}
```

### Validation Errors

```json
{
  "success": false,
  "error": "Missing required field: employee_name",
  "code": "VALIDATION_ERROR"
}
```

### Permission Errors

```json
{
  "success": false,
  "error": "Employee not found or access denied",
  "code": "PERMISSION_DENIED"
}
```

---

## Rate Limiting

- **General API**: 1000 requests per hour per IP
- **Authentication**: 5 login attempts per 15 minutes per IP
- **Bulk Operations**: 10 bulk operations per hour per user
- **File Uploads**: 50MB total upload per hour per user

---

## Data Types and Validation

### Employee Data Validation
- **employee_name**: Required, string, 1-100 chars
- **aadhar**: Required, unique, exactly 12 digits
- **phone_no**: Required, exactly 10 digits
- **date_of_birth**: Required, valid date, not future
- **date_of_joining**: Required, valid date, not future
- **p_day_wage**: Optional, positive number, max 2 decimals

### Stock Data Validation
- **item**: Required, string, 1-200 chars
- **hsn**: Required, 4-8 digits
- **qty**: Required, positive number
- **rate**: Required, positive number, max 2 decimals
- **batches**: Required, valid JSON array

### Bill Data Validation
- **party_id**: Required, valid party ID
- **items**: Required, non-empty array
- **item.qty**: Required, positive number, available stock check
- **item.rate**: Required, positive number

### IFSC Validation
- **ifsc**: Required, exactly 11 characters, valid format
- **Auto-lookup**: Bank and branch populated from Razorpay API

---

## Pagination

Most list endpoints support pagination:

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

**Response Format:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "pages": 15
  }
}
```

---

## File Upload Handling

### Supported Formats
- **Excel**: .xlsx, .xls (for bulk import)
- **Images**: .jpg, .png, .gif (for profile pictures)
- **Documents**: .pdf (for reports)

### Upload Endpoints
- `POST /api/master-rolls/bulk-import` - Employee bulk import
- `POST /api/inventory/sales/import` - Inventory import

### File Size Limits
- **Excel files**: 10MB max
- **Images**: 5MB max
- **Documents**: 25MB max

---

## WebSocket Support (Future)

Real-time notifications for:
- Bill status changes
- Stock level alerts
- User activity updates
- System announcements

---

## API Versioning

Current API version: v1

All endpoints are prefixed with `/api/`. Future versions will use:
- `/api/v2/` for version 2
- `/api/v1/` for legacy support

---

## Testing the API

### Using cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Get employees (use token from login)
curl -X GET http://localhost:3000/api/master-rolls \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using JavaScript

```javascript
// Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'password' })
});

// Authenticated requests automatically use HTTP-only cookies
const response = await fetch('/api/master-rolls', {
  credentials: 'same-origin' // Ensures cookies are sent
});

// State-changing requests need CSRF token
const csrfToken = document.cookie.split('; ').find(row => row.startsWith('csrfToken=')).split('=')[1];
const createResponse = await fetch('/api/master-rolls', {
  method: 'POST',
  credentials: 'same-origin',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken
  },
  body: JSON.stringify({ /* employee data */ })
});
```

This comprehensive API reference covers all endpoints available in the business management application, providing developers with complete information for integration and testing.
