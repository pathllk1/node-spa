# Inventory Management System Documentation

## Overview

The Inventory Management System is a comprehensive business solution that handles stock tracking, sales transactions, party management, and financial reporting. It features batch-level inventory management, GST-compliant billing, and multi-firm support with complete audit trails.

## Architecture

### Core Components
- **Stock Management**: Batch-level inventory tracking with expiry dates and MRP
- **Party Management**: Customer and supplier management with GST details
- **Transaction Processing**: Sales bill generation with automatic calculations
- **Financial Integration**: Ledger postings for accounting integration
- **Reporting**: Comprehensive inventory and sales reports
- **PDF Generation**: Professional invoice and report generation

### Database Schema

#### Stocks Table
```sql
CREATE TABLE stocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  item TEXT NOT NULL,
  pno TEXT,
  oem TEXT,
  hsn TEXT,
  qty REAL NOT NULL DEFAULT 0,
  uom TEXT DEFAULT 'PCS',
  rate REAL NOT NULL DEFAULT 0,
  grate REAL DEFAULT 0,
  total REAL DEFAULT 0,
  mrp REAL,
  batches TEXT, -- JSON array of batch details
  user TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id)
);
```

#### Parties Table
```sql
CREATE TABLE parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  firm TEXT NOT NULL,
  gstin TEXT,
  contact TEXT,
  state TEXT,
  state_code INTEGER,
  addr TEXT,
  pin TEXT,
  pan TEXT,
  user TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id)
);
```

#### Bills Table
```sql
CREATE TABLE bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  bno TEXT NOT NULL,
  bdate TEXT NOT NULL,
  party TEXT NOT NULL,
  addr TEXT,
  gstin TEXT,
  state TEXT,
  pin TEXT,
  state_code INTEGER,
  gtot REAL NOT NULL, -- Taxable amount
  ntot REAL NOT NULL, -- Grand total
  rof REAL NOT NULL,  -- Rounding off
  type TEXT DEFAULT 'SALES',
  user TEXT,
  firm TEXT,
  party_id INTEGER,
  other_charges TEXT, -- JSON array
  ref_no TEXT,
  vehicle_no TEXT,
  dispatch_through TEXT,
  narration TEXT,
  reverse_charge INTEGER DEFAULT 0,
  cgst REAL DEFAULT 0,
  sgst REAL DEFAULT 0,
  igst REAL DEFAULT 0,
  consignee_name TEXT,
  consignee_gstin TEXT,
  consignee_address TEXT,
  consignee_state TEXT,
  consignee_pin TEXT,
  consignee_state_code INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id),
  FOREIGN KEY (party_id) REFERENCES parties(id)
);
```

#### Stock Register Table
```sql
CREATE TABLE stock_reg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'SALE', 'PURCHASE', etc.
  bno TEXT,
  bdate TEXT,
  party TEXT,
  item TEXT NOT NULL,
  narration TEXT,
  batch TEXT,
  hsn TEXT,
  qty REAL NOT NULL,
  uom TEXT,
  rate REAL NOT NULL,
  grate REAL DEFAULT 0,
  disc REAL DEFAULT 0,
  total REAL NOT NULL,
  stock_id INTEGER,
  bill_id INTEGER,
  user TEXT,
  firm TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id),
  FOREIGN KEY (stock_id) REFERENCES stocks(id),
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);
```

## Stock Management

### Batch System Architecture
```javascript
// Batch structure stored as JSON in stocks.batches
{
  batch: "BATCH001",
  qty: 100,
  rate: 50.00,
  expiry: "2025-12-31",
  mrp: 60.00
}
```

### Stock Operations

#### Create Stock
```javascript
POST /api/inventory/sales/stocks
Body: {
  item: "Product Name",
  hsn: "12345678",
  qty: 100,
  rate: 50.00,
  uom: "PCS",
  batches: [{
    batch: "BATCH001",
    qty: 100,
    rate: 50.00,
    expiry: "2025-12-31",
    mrp: 60.00
  }]
}
```

**Logic:**
1. Check firm ownership
2. Validate batch data
3. Update existing batches or create new stock
4. Calculate totals from batch data
5. Store as JSON in database

#### Update Stock
- Supports batch-specific updates
- Maintains inventory consistency
- Updates total quantities automatically
- Preserves audit trail

#### Batch Deduction (Sales)
```javascript
// Automatic batch selection for sales
if (item.batchIndex !== undefined) {
  // Use specific batch index
  batchIndex = parseInt(item.batchIndex);
} else {
  // Match by batch value or find first available
  batchIndex = batches.findIndex(b => b.batch === item.batch);
}

// Verify sufficient quantity
if (batches[batchIndex].qty < requestedQty) {
  throw new Error('Insufficient quantity in batch');
}

// Deduct from specific batch
batches[batchIndex].qty -= requestedQty;
```

## Sales Transaction Processing

### Bill Creation Flow

#### 1. Bill Number Generation
```javascript
const billNo = await getNextBillNumber(req.user.firm_id);
// Server-side generation for consistency
```

#### 2. GST Calculations
```javascript
// Check GST settings
const gstEnabled = firmGstSetting?.setting_value === 'true';

// Calculate line totals
const lineVal = item.qty * item.rate * (1 - (item.disc || 0)/100);
const lineTax = gstEnabled ? lineVal * (item.grate / 100) : 0;

// Calculate GST distribution
if (meta.billType === 'intra-state') {
  cgst = (totalTax / 2) + (otherChargesGstTotal / 2);
  sgst = (totalTax / 2) + (otherChargesGstTotal / 2);
} else {
  igst = totalTax + otherChargesGstTotal;
}
```

#### 3. Stock Deduction
```javascript
// Process each cart item
for (const item of cart) {
  // Find specific batch
  // Verify quantity availability
  // Deduct from batch
  // Update stock totals
  // Create stock register entry
}
```

#### 4. Ledger Integration
```javascript
// Party Debtor entry
Ledger.create.run({
  account_head: party.firm,
  account_type: 'DEBTOR',
  debit_amount: ntot,
  credit_amount: 0,
  description: `Sales Bill No: ${meta.billNo}`
});

// GST Liability entries
if (cgst > 0) {
  Ledger.create.run({
    account_head: 'CGST Payable',
    account_type: 'LIABILITY',
    debit_amount: 0,
    credit_amount: cgst
  });
}
```

## Party Management

### Party Data Structure
```javascript
{
  id: 1,
  firm_id: 1,
  firm: "ABC Corporation",
  gstin: "22AAAAA0000A1Z5",
  contact: "+91-9876543210",
  state: "Maharashtra",
  state_code: 27,
  addr: "123 Business Street",
  pin: "400001",
  pan: "AAAAA0000A"
}
```

### GST Integration
- Automatic GSTIN validation
- State code mapping
- Intra-state vs Inter-state tax calculations
- Reverse charge mechanism support

## Reporting System

### Inventory Reports
- Stock levels by batch
- Stock movement history
- Party-wise item history
- Low stock alerts

### Sales Reports
- Bill-wise sales summary
- Party-wise sales analysis
- GST reports (CGST/SGST/IGST)
- Date-range filtering

### PDF Generation
```javascript
// Invoice PDF structure
const docDefinition = {
  pageSize: 'A4',
  content: [
    // Header with firm details
    // Bill information
    // Party details
    // Item table with batches
    // Tax calculations
    // Summary totals
  ],
  styles: {
    headerFirmName: { fontSize: 14, bold: true },
    title: { fontSize: 18, bold: true },
    tableHeader: { fontSize: 9, bold: true, fillColor: '#F9FAFB' }
  }
};
```

## API Endpoints

### Stock Management
```
GET    /api/inventory/sales/stocks           # Get all stocks
POST   /api/inventory/sales/stocks           # Create stock
GET    /api/inventory/sales/stocks/:id       # Get stock details
PUT    /api/inventory/sales/stocks/:id       # Update stock
DELETE /api/inventory/sales/stocks/:id       # Delete stock
```

### Party Management
```
GET    /api/inventory/sales/parties           # Get all parties
POST   /api/inventory/sales/parties           # Create party
```

### Transactions
```
POST   /api/inventory/sales/bills             # Create sales bill
GET    /api/inventory/sales/bills/:id         # Get bill details
GET    /api/inventory/sales/bills             # Get all bills
PUT    /api/inventory/sales/bills/:id         # Update bill
DELETE /api/inventory/sales/bills/:id         # Cancel bill
GET    /api/inventory/sales/bills/:id/pdf    # Generate PDF
```

### Stock Movements
```
GET    /api/inventory/sales/stock-movements           # Get movements
GET    /api/inventory/sales/stock-movements/:stockId  # Get by stock
POST   /api/inventory/sales/stock-movements           # Create movement
```

### Utilities
```
GET    /api/inventory/sales/other-charges-types       # Get charge types
GET    /api/inventory/sales/next-bill-number          # Preview bill number
GET    /api/inventory/sales/party-balance/:partyId    # Get party balance
POST   /api/inventory/sales/gst-lookup                # GST validation
```

## Security Features

### Multi-Firm Isolation
- All queries filtered by `firm_id`
- User permission validation
- Cross-firm data protection

### Audit Trail
- All changes logged with user information
- Timestamp tracking
- Transaction history preservation

### Data Validation
- Quantity availability checks
- Batch consistency validation
- GST compliance verification

## Performance Optimizations

### Database Queries
- Prepared statements for repeated queries
- Indexed columns for fast lookups
- Efficient JOIN operations

### Batch Processing
- Bulk stock updates
- Transaction batching
- Memory-efficient processing

### Caching Strategy
- Firm settings caching
- Frequently accessed data optimization
- Connection pooling with Turso

## Integration Points

### Financial System
- Automatic ledger postings
- GST liability tracking
- Party balance management

### External Services
- GST validation API
- Email notification system
- PDF delivery mechanisms

This inventory management system provides enterprise-grade functionality for businesses requiring detailed stock tracking, GST compliance, and comprehensive reporting capabilities.
