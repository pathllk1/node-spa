# PDF Generation System Documentation

## Overview

The PDF Generation System provides comprehensive financial document generation capabilities using pdfmake library. It creates professional-quality PDF reports for accounting and financial management, including ledger reports, trial balance, general ledger, and custom financial statements.

## Architecture

### Core Components
- **pdfmake Integration**: Server-side PDF generation using pdfmake library
- **Font Management**: Custom font support with DejaVu Sans family
- **Template System**: Reusable document templates for different report types
- **Dynamic Content**: Real-time data integration with database queries
- **Professional Layout**: Enterprise-grade document formatting and styling

### Technical Implementation

#### Font Configuration
```javascript
// Font definitions with proper path resolution
const fonts = {
  DejaVuSans: {
    normal: getFontPath('DejaVuSans.ttf'),
    bold: getFontPath('DejaVuSans-Bold.ttf'),
    italics: getFontPath('DejaVuSans-Oblique.ttf'),
    bolditalics: getFontPath('DejaVuSans-BoldOblique.ttf')
  }
};

// Font validation on startup
fontFiles.forEach(fontFile => {
  const fontPath = getFontPath(fontFile);
  if (!fs.existsSync(fontPath)) {
    console.warn(`Warning: Font file does not exist: ${fontPath}`);
  }
});
```

#### PDF Generation Flow
```javascript
// 1. Data retrieval from database
const data = await getLedgerData(firmId, filters);

// 2. Document definition creation
const docDefinition = {
  pageSize: 'A4',
  pageMargins: [20, 60, 20, 60],
  content: [...],
  styles: {...}
};

// 3. PDF generation and streaming
const pdfDoc = await printer.createPdfKitDocument(docDefinition);
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
pdfDoc.pipe(res);
pdfDoc.end();
```

## Available Reports

### 1. Account Ledger PDF

#### Features
- **Detailed Transaction History**: Complete chronological transaction listing for specific accounts
- **Running Balance Calculation**: Real-time balance computation for each transaction
- **Date Range Filtering**: Customizable reporting periods
- **Professional Formatting**: Header/footer with firm information, page numbering

#### API Endpoint
```javascript
GET /api/ledger/reports/account-ledger?account_head=AccountName&start_date=2024-01-01&end_date=2024-01-31
```

#### Report Structure
```
┌─────────────────────────────────────────────────────────────┐
│                    FIRM NAME                                │
│                    LEDGER REPORT                           │
│                                                            │
│ Account: Cash                                              │
│ Date Range: 01/01/2024 to 31/01/2024                       │
│ Generated on: 15/02/2024 10:30 AM                         │
│                                                            │
│ ┌─────────┬────────────┬──────────────┬─────────────┐      │
│ │ Date    │ Voucher No │ Narration    │ Debit/Credit│      │
│ ├─────────┼────────────┼──────────────┼─────────────┤      │
│ │ 15/01   │ PV/001/24  │ Office Rent  │ 10,000 DR   │      │
│ │ 20/01   │ RV/005/24  │ Customer Pay │ 15,000 CR   │      │
│ └─────────┴────────────┴──────────────┴─────────────┘      │
│                                                            │
│ SUMMARY:                                                   │
│ Total Debits: ₹25,000    Total Credits: ₹15,000           │
│ Closing Balance: ₹10,000 DR                               │
└─────────────────────────────────────────────────────────────┘
```

### 2. General Ledger PDF

#### Features
- **All Accounts Summary**: Complete overview of all ledger accounts
- **Balance Calculations**: Debit/credit totals and net balances for each account
- **Account Type Grouping**: Organized by asset, liability, income, expense categories
- **Multi-page Support**: Automatic page breaks for large datasets

#### API Endpoint
```javascript
GET /api/ledger/reports/general-ledger?start_date=2024-01-01&end_date=2024-01-31
```

#### Report Structure
```
GENERAL LEDGER REPORT
Firm: ABC Corporation
Date Range: January 2024

Account Head          Type    Debits     Credits    Balance
─────────────────────────────────────────────────────────────
Cash                  BANK    500,000    350,000    150,000 DR
Accounts Receivable   ASSET   750,000    650,000    100,000 DR
Office Equipment      ASSET   200,000         0    200,000 DR
Accounts Payable      LIAB         0    150,000    150,000 CR
Loans Payable         LIAB         0    300,000    300,000 CR
Sales Revenue         INC          0    800,000    800,000 CR
Office Expenses       EXP     120,000         0    120,000 DR
```

### 3. Trial Balance PDF

#### Features
- **Accounting Verification**: Ensures debits equal credits (fundamental accounting principle)
- **Period-end Reporting**: Month-end, quarter-end, and year-end trial balances
- **Balance Sheet Preparation**: Foundation for financial statement generation
- **Audit Trail**: Supports external audit and compliance requirements

#### API Endpoint
```javascript
GET /api/ledger/reports/trial-balance?start_date=2024-01-01&end_date=2024-01-31
```

#### Report Structure
```
TRIAL BALANCE
ABC Corporation
As of January 31, 2024

Account Head                Debits         Credits
─────────────────────────────────────────────────────
ASSETS:
  Cash                      150,000.00
  Accounts Receivable       100,000.00
  Inventory                  75,000.00
  Office Equipment          200,000.00

LIABILITIES:
                              50,000.00    Accounts Payable
                             300,000.00    Loans Payable

EQUITY:
                             175,000.00    Retained Earnings

INCOME:
                                           800,000.00    Sales Revenue

EXPENSES:
  Office Expenses           120,000.00
  Rent Expense               80,000.00

TOTALS:                     725,000.00    725,000.00
```

### 4. Account Type Summary PDF

#### Features
- **Category Analysis**: Grouped reporting by account types (Asset, Liability, Income, Expense)
- **Management Reporting**: High-level financial position overview
- **Trend Analysis**: Comparative analysis across periods
- **Decision Support**: Executive-level financial insights

#### API Endpoint
```javascript
GET /api/ledger/reports/account-type?start_date=2024-01-01&end_date=2024-01-31
```

## Technical Specifications

### PDF Generation Library
```javascript
// pdfmake configuration
const printer = new PdfPrinter(fonts);

// Document definition structure
const docDefinition = {
  pageSize: 'A4',
  pageMargins: [20, 60, 20, 60],
  defaultStyle: { font: 'DejaVuSans' },
  header: {...},
  content: [...],
  styles: {...}
};
```

### Font Management
- **DejaVu Sans Family**: Complete Unicode support including Indian Rupee symbol (₹)
- **Font Validation**: Automatic verification of font file existence on startup
- **Cross-platform Compatibility**: Consistent rendering across different operating systems

### Data Processing
```javascript
// BigInt handling for financial amounts
const records = rows.map(record => {
  const processedRecord = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'bigint') {
      processedRecord[key] = Number(value);
    } else {
      processedRecord[key] = value;
    }
  }
  return processedRecord;
});
```

### Formatting Functions
```javascript
// Indian Rupee formatting
const formatINR = (amount) => {
  return '₹ ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
};

// Date formatting for Indian locale
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-IN');
  } catch (e) {
    return dateString;
  }
};
```

## Security & Performance

### Access Control
- **Firm Isolation**: All reports filtered by `firm_id`
- **User Authentication**: JWT token validation required
- **Permission Checking**: Role-based report access control

### Performance Optimizations
- **Database Indexing**: Optimized queries for large datasets
- **Streaming Generation**: Memory-efficient PDF creation
- **Pagination Support**: Large report handling without memory issues
- **Caching Strategy**: Frequently requested reports can be cached

### File Handling
- **Secure Filenames**: Sanitized filenames preventing path traversal
- **Content-Type Headers**: Proper MIME type specification
- **Attachment Disposition**: Browser download prompts
- **Memory Management**: Efficient cleanup of PDF generation resources

## Integration Points

### Ledger System Integration
- **Real-time Data**: Direct integration with ledger database tables
- **Transaction Filtering**: Date range and account-specific filtering
- **Balance Calculations**: Automatic running balance computations
- **Multi-currency Support**: Extensible for international currencies

### User Interface Integration
- **Download Triggers**: Client-side buttons initiate PDF generation
- **Progress Indicators**: Loading states during report generation
- **Error Handling**: User-friendly error messages for failed generations
- **Preview Support**: Future enhancement for PDF preview capabilities

## API Endpoints

### Report Generation
```javascript
// Account Ledger PDF
GET /api/ledger/reports/account-ledger?account_head=AccountName&start_date=2024-01-01&end_date=2024-01-31

// General Ledger PDF
GET /api/ledger/reports/general-ledger?start_date=2024-01-01&end_date=2024-01-31

// Trial Balance PDF
GET /api/ledger/reports/trial-balance?start_date=2024-01-01&end_date=2024-01-31

// Account Type Summary PDF
GET /api/ledger/reports/account-type?start_date=2024-01-01&end_date=2024-01-31
```

### Response Format
```javascript
// Success Response: PDF file download
Content-Type: application/pdf
Content-Disposition: attachment; filename="report.pdf"

// Error Response: JSON
{
  "error": "No ledger records found for this account"
}
```

## Customization & Extensions

### Template Customization
```javascript
// Custom styling
const customStyles = {
  companyHeader: {
    fontSize: 16,
    bold: true,
    color: '#1f2937'
  },
  reportTitle: {
    fontSize: 20,
    bold: true,
    alignment: 'center'
  }
};
```

### Additional Reports
- **Balance Sheet**: Asset, liability, and equity statement
- **Profit & Loss**: Income and expense statement
- **Cash Flow Statement**: Operating, investing, and financing activities
- **Custom Reports**: Client-specific financial reports

### Branding Support
- **Company Logo**: Header logo integration
- **Color Schemes**: Custom color palettes for different firms
- **Footer Information**: Legal disclaimers and contact information
- **Multi-language**: Support for different language character sets

This PDF generation system provides enterprise-grade financial reporting capabilities with professional document formatting, comprehensive data integration, and scalable performance suitable for business accounting and compliance requirements.
