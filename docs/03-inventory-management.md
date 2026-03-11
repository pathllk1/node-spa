# Inventory Management System Documentation

## Overview

The Inventory Management System is a comprehensive business solution that handles stock tracking, sales transactions, party management, and financial reporting. It features batch-level inventory management, GST-compliant billing, and multi-firm support with complete audit trails. **Includes advanced bill cancellation functionality** for complete transaction reversal with stock restoration and financial adjustments.

## Architecture

### Core Components
- **Stock Management**: Batch-level inventory tracking with expiry dates and MRP
- **Party Management**: Customer and supplier management with GST details
- **Transaction Processing**: Sales bill generation with automatic calculations
- **Financial Integration**: Ledger postings for accounting integration
- **Reporting**: Comprehensive inventory and sales reports
- **PDF Generation**: Professional invoice and report generation

### Database Schema (Mongoose)

#### Stock Model
```javascript
const stockSchema = new Schema({
  firm_id: { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
  item:    { type: String, required: true },
  pno:     { type: String },
  oem:     { type: String },
  hsn:     { type: String },
  qty:     { type: Number, required: true, default: 0 },
  uom:     { type: String, default: 'PCS' },
  rate:    { type: Number, required: true, default: 0 },
  grate:   { type: Number, default: 0 },
  total:   { type: Number, default: 0 },
  mrp:     { type: Number },
  batches: [batchSchema], // Array of embedded subdocuments
  user:    { type: String }
}, { timestamps: true });
```

#### Party Model
```javascript
const partySchema = new Schema({
  firm_id:    { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
  firm:       { type: String, required: true },
  gstin:      { type: String },
  contact:    { type: String },
  state:      { type: String },
  state_code: { type: Number },
  addr:       { type: String },
  pin:        { type: String },
  pan:        { type: String },
  user:       { type: String }
}, { timestamps: true });
```

#### Bill Model
```javascript
const billSchema = new Schema({
  firm_id:          { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
  bno:              { type: String, required: true },
  bdate:            { type: String, required: true },
  party:            { type: String, required: true },
  addr:             { type: String },
  gstin:            { type: String },
  state:            { type: String },
  pin:              { type: String },
  state_code:       { type: Number },
  gtot:             { type: Number, required: true }, // Taxable amount
  ntot:             { type: Number, required: true }, // Grand total
  rof:              { type: Number, required: true }, // Rounding off
  type:             { type: String, default: 'SALES' },
  user:             { type: String },
  firm:             { type: String },
  party_id:         { type: Schema.Types.ObjectId, ref: 'Party' },
  other_charges:    [{ /* Embedded schema */ }],
  ref_no:           { type: String },
  vehicle_no:       { type: String },
  dispatch_through: { type: String },
  narration:        { type: String },
  reverse_charge:   { type: Number, default: 0 },
  cgst:             { type: Number, default: 0 },
  sgst:             { type: Number, default: 0 },
  igst:             { type: Number, default: 0 },
  // ... consignee fields ...
}, { timestamps: true });
```

#### Stock Register Model
```javascript
const stockRegSchema = new Schema({
  firm_id:   { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
  type:      { type: String, required: true }, // 'SALE', 'PURCHASE', etc.
  bno:       { type: String },
  bdate:     { type: String },
  party:     { type: String },
  item:      { type: String, required: true },
  narration: { type: String },
  batch:     { type: String },
  hsn:       { type: String },
  qty:       { type: Number, required: true },
  uom:       { type: String },
  rate:      { type: Number, required: true },
  grate:     { type: Number, default: 0 },
  disc:      { type: Number, default: 0 },
  total:     { type: Number, required: true },
  stock_id:  { type: Schema.Types.ObjectId, ref: 'Stock' },
  bill_id:   { type: Schema.Types.ObjectId, ref: 'Bill' },
  user:      { type: String },
  firm:      { type: String }
}, { timestamps: true });
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
await Ledger.create({
  firm_id: req.user.firm_id,
  account_head: party.firm,
  account_type: 'DEBTOR',
  debit_amount: ntot,
  credit_amount: 0,
  description: `Sales Bill No: ${meta.billNo}`
});

// GST Liability entries
if (cgst > 0) {
  await Ledger.create({
    firm_id: req.user.firm_id,
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
PUT    /api/inventory/sales/bills/:id/cancel  # Cancel bill with stock restoration
DELETE /api/inventory/sales/bills/:id         # Delete bill (admin only)
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
- Mongoose lean() queries for read-only endpoints
- Indexed columns for fast lookups
- Efficient populate() operations

### Batch Processing
- Bulk stock updates using insertMany/bulkWrite
- Transaction batching (Mongoose transactions where replica sets allow)
- Memory-efficient processing

### Caching Strategy
- Firm settings caching
- Frequently accessed data optimization
- Connection pooling with MongoDB

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
