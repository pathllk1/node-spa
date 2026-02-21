# Ledger, Voucher & Journal System Documentation

## Overview

The Ledger, Voucher, and Journal system forms the core accounting engine of the business management application. It provides comprehensive double-entry bookkeeping functionality with multi-firm support, complete audit trails, and financial reporting capabilities. The system handles all financial transactions including payments, receipts, journal entries, and automatic ledger postings from sales/purchase transactions.

## Architecture

### Core Components
- **Ledger System**: Central transaction recording with double-entry bookkeeping
- **Voucher System**: Payment and receipt voucher management
- **Journal Entry System**: General journal entries for complex transactions
- **Financial Reporting**: Trial balance, general ledger, and account-specific reports
- **PDF Generation**: Professional financial document generation
- **Audit Trail**: Complete transaction history and user attribution

### Database Schema

#### Ledger Table (Core Transaction Table)
```sql
CREATE TABLE ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL,
  voucher_id INTEGER NOT NULL,
  voucher_type TEXT NOT NULL, -- 'PAYMENT', 'RECEIPT', 'JOURNAL', 'SALES', 'PURCHASE'
  voucher_no TEXT NOT NULL,
  account_head TEXT NOT NULL,
  account_type TEXT NOT NULL, -- 'DEBTOR', 'CREDITOR', 'BANK', 'CASH', 'GENERAL'
  debit_amount REAL DEFAULT 0,
  credit_amount REAL DEFAULT 0,
  narration TEXT,
  party_id INTEGER,
  bank_account_id INTEGER,
  transaction_date TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id),
  FOREIGN KEY (party_id) REFERENCES parties(id),
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
);
```

## Ledger System

### Core Functionality

#### Double-Entry Bookkeeping
Every financial transaction creates balanced debit and credit entries:
- **Debit**: Increases asset/expense accounts, decreases liability/equity accounts
- **Credit**: Decreases asset/expense accounts, increases liability/equity accounts

#### Account Types
- **ASSETS**: Cash, Bank, Inventory, Fixed Assets
- **LIABILITIES**: Loans, Creditors, Taxes Payable
- **EQUITY**: Capital, Retained Earnings
- **INCOME**: Sales Revenue, Interest Income
- **EXPENSES**: Operating Costs, Salaries, Rent

### API Endpoints

#### GET /api/ledger/accounts
Get all account heads with balances for current firm.

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
- `start_date`: Filter from date (YYYY-MM-DD)
- `end_date`: Filter to date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "voucher_id": 12345,
      "voucher_type": "PAYMENT",
      "voucher_no": "PV/001/2024",
      "debit_amount": 10000.00,
      "credit_amount": 0.00,
      "narration": "Office rent payment",
      "transaction_date": "2024-01-15",
      "created_by": "admin"
    }
  ]
}
```

#### GET /api/ledger/account-types
Get account type summaries with aggregated balances.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "account_type": "BANK",
      "account_count": 3,
      "total_debit": 150000.00,
      "total_credit": 75000.00,
      "total_balance": 75000.00
    }
  ]
}
```

#### GET /api/ledger/suggestions
Get account head suggestions for autocomplete.

**Query Parameters:**
- `q`: Search query (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "account_head": "Cash",
      "account_type": "BANK"
    },
    {
      "account_head": "State Bank of India",
      "account_type": "BANK"
    }
  ]
}
```

## Voucher System

### Payment & Receipt Vouchers

#### Core Features
- **Payment Vouchers**: Money going out (to suppliers, expenses, etc.)
- **Receipt Vouchers**: Money coming in (from customers, income, etc.)
- **Double-Entry Automation**: Automatic ledger posting
- **Multi-Party Support**: Link transactions to customers/suppliers
- **Bank Integration**: Support for multiple bank accounts
- **Audit Trail**: Complete transaction history

### Voucher Types

#### Payment Voucher (PV)
**Business Logic:**
- Debit: Expense/Party Account
- Credit: Cash/Bank Account

**Example:** Paying supplier ₹10,000
- Debit: Supplier A/C (Party) ₹10,000
- Credit: Cash A/C ₹10,000

#### Receipt Voucher (RV)
**Business Logic:**
- Debit: Cash/Bank Account
- Credit: Income/Party Account

**Example:** Receiving payment from customer ₹15,000
- Debit: Cash A/C ₹15,000
- Credit: Customer A/C (Party) ₹15,000

### API Endpoints

#### POST /api/ledger/vouchers
Create new payment or receipt voucher.

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

**Response:**
```json
{
  "success": true,
  "message": "PAYMENT voucher created successfully",
  "voucherId": 12345,
  "voucherNo": "PV/001/2024"
}
```

#### GET /api/ledger/vouchers
Get all vouchers with pagination and filtering.

**Query Parameters:**
- `voucher_type`: 'PAYMENT' or 'RECEIPT'
- `start_date`: Filter from date
- `end_date`: Filter to date
- `party_id`: Filter by party
- `search`: Search in voucher number or narration
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "vouchers": [
    {
      "voucher_id": 12345,
      "voucher_type": "PAYMENT",
      "voucher_no": "PV/001/2024",
      "transaction_date": "2024-01-15",
      "amount": 10000.00,
      "party_name": "Office Supplies Ltd",
      "payment_mode": "Cash",
      "narration": "Office supplies payment"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

#### GET /api/ledger/vouchers/:id
Get specific voucher details.

**Response:**
```json
{
  "success": true,
  "data": {
    "voucher_id": 12345,
    "voucher_type": "PAYMENT",
    "voucher_no": "PV/001/2024",
    "transaction_date": "2024-01-15",
    "narration": "Office supplies payment",
    "party_id": 1,
    "party_name": "Office Supplies Ltd",
    "amount": 10000.00,
    "payment_mode": "Cash"
  }
}
```

#### PUT /api/ledger/vouchers/:id
Update existing voucher.

**Request Body:** Same as create, only changed fields required.

#### GET /api/ledger/vouchers/parties/:partyId
Get all vouchers for specific party.

#### GET /api/ledger/vouchers/summary
Get voucher summary statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_receipts": 500000.00,
    "total_payments": 350000.00,
    "recent_transactions_count": 25
  }
}
```

## Journal Entry System

### General Journal Entries

#### Core Features
- **Multi-Line Entries**: Support for complex transactions with multiple debits/credits
- **Balanced Entries**: Automatic validation that debits equal credits
- **Flexible Accounting**: Handle any type of accounting adjustment
- **Audit Compliance**: Complete transaction traceability

#### Business Use Cases
- **Adjusting Entries**: Correcting previous period errors
- **Accrual Entries**: Recording revenues/expenses not yet received/paid
- **Asset Disposals**: Recording sale of fixed assets
- **Depreciation**: Periodic asset value adjustments
- **Provisions**: Creating allowances for expected losses

### Journal Entry Structure

#### Multi-Line Journal Entry
Each journal entry can have multiple lines, each with:
- **Account Head**: Which account is affected
- **Account Type**: Classification of the account
- **Debit Amount**: Money flowing into the account
- **Credit Amount**: Money flowing out of the account
- **Narration**: Description of the transaction line

#### Balance Validation
**Rule:** Total Debits = Total Credits

**Example Journal Entry:** Equipment purchase worth ₹50,000 (paid in cash)
```
Account Head          | Debit    | Credit
----------------------|----------|---------
Equipment (Asset)     | 50,000   | -
Cash (Asset)          | -        | 50,000
```

### API Endpoints

#### POST /api/ledger/journal-entries
Create new journal entry with multiple lines.

**Request Body:**
```json
{
  "entries": [
    {
      "account_head": "Equipment",
      "account_type": "ASSET",
      "debit_amount": 50000.00,
      "credit_amount": 0,
      "narration": "Purchase of new equipment"
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

**Response:**
```json
{
  "success": true,
  "message": "Journal entry created successfully",
  "journalEntryId": 67890,
  "journalEntryNo": "JE/001/2024",
  "totalDebits": 50000.00,
  "totalCredits": 50000.00
}
```

#### GET /api/ledger/journal-entries
Get all journal entries with pagination and filtering.

**Query Parameters:**
- `start_date`: Filter from date
- `end_date`: Filter to date
- `search`: Search in journal number or narration
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "journalEntries": [
    {
      "voucher_no": "JE/001/2024",
      "voucher_id": 67890,
      "transaction_date": "2024-01-15",
      "narration": "Equipment purchase transaction",
      "total_debit": 50000.00,
      "total_credit": 50000.00
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

#### GET /api/ledger/journal-entries/:id
Get specific journal entry with all lines.

**Response:**
```json
{
  "success": true,
  "voucher_id": 67890,
  "voucher_type": "JOURNAL",
  "voucher_no": "JE/001/2024",
  "transaction_date": "2024-01-15",
  "narration": "Equipment purchase transaction",
  "entries": [
    {
      "account_head": "Equipment",
      "account_type": "ASSET",
      "debit_amount": 50000.00,
      "credit_amount": 0,
      "narration": "Purchase of new equipment"
    },
    {
      "account_head": "Cash",
      "account_type": "BANK",
      "debit_amount": 0,
      "credit_amount": 50000.00,
      "narration": "Payment for equipment"
    }
  ]
}
```

#### PUT /api/ledger/journal-entries/:id
Update existing journal entry.

**Request Body:** Same structure as create.

#### DELETE /api/ledger/journal-entries/:id
Delete journal entry (removes all associated ledger entries).

#### GET /api/ledger/journal-entries/summary
Get journal entry statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_journal_entries": 25,
    "recent_journal_entries_count": 5
  }
}
```

## Financial Reporting

### PDF Report Generation

#### Available Reports
- **Account Ledger**: Detailed transaction history for specific account
- **General Ledger**: Summary of all accounts with balances
- **Trial Balance**: List of all accounts with debit/credit balances
- **Account Type Summary**: Grouped balances by account type

### API Endpoints

#### GET /api/ledger/reports/account-ledger
Generate account ledger PDF.

**Query Parameters:**
- `account_head`: Account to report on
- `start_date`: Report start date
- `end_date`: Report end date

#### GET /api/ledger/reports/general-ledger
Generate general ledger PDF.

#### GET /api/ledger/reports/trial-balance
Generate trial balance PDF.

#### GET /api/ledger/reports/account-type
Generate account type summary PDF.

## Integration Points

### Sales/Purchase Integration
- **Automatic Ledger Posting**: Sales and purchases automatically create ledger entries
- **GST Accounting**: Integrated GST liability tracking
- **Party Balance Updates**: Customer/supplier balances maintained automatically

### Bank Account Integration
- **Multi-Bank Support**: Link transactions to specific bank accounts
- **Account Validation**: Bank account ownership verification
- **Masked Account Numbers**: Security for sensitive banking information

### Party Management Integration
- **Customer/Supplier Tracking**: Link transactions to business parties
- **Outstanding Balance Management**: Automatic balance calculations
- **Credit Terms**: Support for credit-based transactions

## Security & Audit Features

### Multi-Firm Isolation
- **Firm-Based Access**: All queries filtered by `firm_id`
- **Data Separation**: Complete isolation between firms
- **Permission Validation**: User role and firm access verification

### Audit Trail
- **Complete Logging**: All transactions logged with user attribution
- **Timestamp Tracking**: Precise transaction timing
- **Change History**: Modification tracking for all entries
- **Compliance Ready**: Audit-ready financial records

### Data Integrity
- **Balance Validation**: Automatic debit/credit balance verification
- **Transaction Atomicity**: All-or-nothing transaction processing
- **Foreign Key Constraints**: Referential integrity enforcement
- **BigInt Handling**: Proper handling of large financial amounts

## Performance Optimizations

### Database Optimizations
- **Indexed Queries**: Optimized for common query patterns
- **Prepared Statements**: Efficient query execution
- **Batch Processing**: Bulk operations for large datasets
- **Connection Pooling**: Efficient database connections

### Caching Strategy
- **Account Balance Caching**: Frequently accessed balance information
- **Query Result Caching**: Expensive query result storage
- **Report Caching**: Generated report temporary storage

### Query Optimization
- **Pagination Support**: Efficient large dataset handling
- **Filtered Queries**: Targeted data retrieval
- **Aggregate Functions**: Efficient summary calculations
- **Date Range Filtering**: Optimized date-based queries

## Error Handling

### Validation Errors
- **Balance Mismatch**: Debits must equal credits
- **Invalid Accounts**: Account existence verification
- **Permission Errors**: Firm access validation
- **Data Type Errors**: Proper data format enforcement

### Transaction Failures
- **Rollback Support**: Failed transactions automatically rolled back
- **Error Logging**: Comprehensive error tracking and reporting
- **Recovery Procedures**: Clear error recovery instructions
- **User Feedback**: Meaningful error messages for users

## Business Rules

### Accounting Principles
- **Double-Entry**: Every transaction has equal debits and credits
- **Account Classification**: Proper asset/liability/equity/income/expense classification
- **Period End Processing**: Month-end and year-end procedures
- **Audit Compliance**: GAAP and local accounting standard compliance

### Transaction Rules
- **No Negative Amounts**: All amounts must be positive
- **Single Account Type**: Each entry affects one account type
- **Narration Requirements**: All transactions must have descriptions
- **Date Validation**: Transaction dates cannot be in the future

This comprehensive Ledger, Voucher, and Journal system provides enterprise-grade accounting functionality suitable for businesses requiring accurate financial tracking, audit compliance, and automated financial reporting.
