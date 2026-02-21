# Troubleshooting Guide and FAQ

## Overview

This comprehensive troubleshooting guide provides solutions to common issues encountered when deploying, configuring, and using the Node.js SPA Business Management Application. It includes FAQs, error codes, debugging techniques, and preventive maintenance procedures.

## Quick Start Troubleshooting

### Application Won't Start

**Symptoms:**
- Server fails to start
- Port 3000 already in use
- Environment variable errors

**Solutions:**

```bash
# Check if port is in use
lsof -i :3000
kill -9 <PID>

# Validate environment variables
node -e "console.log(require('dotenv').config())"

# Check Node.js version
node --version  # Should be 18.0.0+

# Verify dependencies
npm ls --depth=0

# Start with verbose logging
DEBUG=* npm start
```

### Database Connection Issues

**Symptoms:**
- "Database connection failed" errors
- Turso authentication errors
- Timeout errors

**Solutions:**

```bash
# Test Turso connection
turso db ping your-database-name

# Verify database URL format
echo $TURSO_DATABASE_URL  # Should start with libsql://

# Check authentication token
turso db tokens list

# Test database connectivity
node -e "
const { createClient } = require('@libsql/client');
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});
client.execute('SELECT 1').then(() => console.log('Connected'));
"
```

### Authentication Problems

**Symptoms:**
- Cannot login
- Invalid token errors
- Session expires immediately

**Solutions:**

```bash
# Check JWT secrets
echo $ACCESS_TOKEN_SECRET | wc -c  # Should be >32 characters
echo $REFRESH_TOKEN_SECRET | wc -c  # Should be >32 characters

# Verify cookie settings
curl -I http://localhost:3000/api/auth/me  # Check Set-Cookie headers

# Test token generation
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({ test: true }, process.env.ACCESS_TOKEN_SECRET);
console.log('Token generated successfully');
"
```

## Error Codes and Solutions

### HTTP Status Codes

#### 400 Bad Request
**Common Causes:**
- Missing required fields
- Invalid data format
- Validation errors

**Examples:**
```json
{
  "success": false,
  "error": "Missing required field: employee_name"
}
```

**Solutions:**
```javascript
// Validate request body before API calls
const requiredFields = ['employee_name', 'aadhar', 'phone_no'];
const missingFields = requiredFields.filter(field => !req.body[field]);

if (missingFields.length > 0) {
  return res.status(400).json({
    success: false,
    error: `Missing required fields: ${missingFields.join(', ')}`
  });
}
```

#### 401 Unauthorized
**Common Causes:**
- Missing authentication token
- Expired token
- Invalid token format

**Examples:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED"
}
```

**Solutions:**
```javascript
// Check token in localStorage
const token = localStorage.getItem('accessToken');
if (!token) {
  window.location.href = '/login';
}

// Include token in API calls
const response = await fetch('/api/master-rolls', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

#### 403 Forbidden
**Common Causes:**
- Insufficient permissions
- Firm access denied
- User not approved

**Examples:**
```json
{
  "success": false,
  "error": "Employee not found or access denied"
}
```

**Solutions:**
```bash
# Check user role and firm access
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/auth/me

# Verify firm approval status
SELECT status FROM firms WHERE id = ?;
SELECT approved FROM users WHERE id = ?;
```

#### 404 Not Found
**Common Causes:**
- Invalid API endpoint
- Resource doesn't exist
- Incorrect URL parameters

**Examples:**
```json
{
  "success": false,
  "error": "Employee not found"
}
```

**Solutions:**
```javascript
// Verify API endpoint exists
const endpoints = [
  '/api/master-rolls',
  '/api/inventory/stocks',
  '/api/auth/login'
];

// Check URL parameters
const employeeId = 123;
const response = await fetch(`/api/master-rolls/${employeeId}`);
// Should be: GET /api/master-rolls/123
```

#### 409 Conflict
**Common Causes:**
- Duplicate data
- Unique constraint violations

**Examples:**
```json
{
  "success": false,
  "error": "Employee with this Aadhar already exists"
}
```

**Solutions:**
```sql
-- Check for duplicates before insertion
SELECT COUNT(*) as count FROM master_rolls
WHERE aadhar = ? AND firm_id = ?;

-- Handle unique constraint violations
try {
  const result = db.run(insertQuery, params);
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    throw new Error('Duplicate entry found');
  }
  throw error;
}
```

#### 500 Internal Server Error
**Common Causes:**
- Database connection issues
- Code errors
- Memory issues
- External service failures

**Examples:**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

**Solutions:**
```bash
# Check application logs
pm2 logs business-app --lines 100

# Monitor memory usage
pm2 monit

# Check database status
turso db show your-database-name

# Restart application
pm2 restart business-app
```

## Module-Specific Issues

### Master Roll Management Issues

#### IFSC Lookup Not Working

**Symptoms:**
- IFSC field doesn't auto-populate bank/branch
- "IFSC lookup failed" errors
- Loading spinner stays indefinitely

**Solutions:**
```javascript
// Check IFSC format validation
function validateIFSC(ifsc) {
  return ifsc && ifsc.length === 11 && /^[A-Z0-9]+$/.test(ifsc);
}

// Verify API endpoint
const response = await fetch(`/api/master-rolls/lookup-ifsc/${ifsc}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) {
  const error = await response.json();
  console.error('IFSC lookup failed:', error);
}
```

#### Bulk Import Failures

**Symptoms:**
- Excel import fails
- Partial import success
- Duplicate Aadhar errors

**Solutions:**
```javascript
// Validate Excel format before upload
function validateExcelData(data) {
  const requiredHeaders = ['Employee Name', 'Aadhar', 'Phone'];
  const headers = Object.keys(data[0] || {});

  const missingHeaders = requiredHeaders.filter(h =>
    !headers.some(header => header.toLowerCase().includes(h.toLowerCase()))
  );

  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
  }
}

// Handle duplicate records
const results = {
  success: [],
  failed: []
};

for (const record of data) {
  try {
    await createEmployee(record);
    results.success.push(record);
  } catch (error) {
    results.failed.push({
      record,
      error: error.message
    });
  }
}
```

### Inventory Management Issues

#### Bill Cancellation Errors

**Symptoms:**
- "Bill is already cancelled" error
- Stock restoration failures
- Ledger deletion issues

**Solutions:**
```javascript
// Check bill status before cancellation
const bill = await getBillById(billId, firmId);
if (bill.status === 'CANCELLED') {
  throw new Error('Bill is already cancelled');
}

// Verify stock availability for restoration
for (const item of bill.items) {
  const stock = await getStockById(item.stock_id, firmId);
  // Ensure stock can accommodate restored quantities
}

// Atomic cancellation transaction
const db = await getDatabaseConnection();
await db.transaction(async () => {
  // Update bill status
  await updateBillStatus(billId, 'CANCELLED');

  // Restore stock quantities
  await restoreStockQuantities(bill.items);

  // Delete ledger entries
  await deleteLedgerEntries(billId);
});
```

#### GST Calculation Errors

**Symptoms:**
- Incorrect tax amounts
- Inter-state vs intra-state confusion
- Reverse charge issues

**Solutions:**
```javascript
// Validate GST settings
const gstEnabled = firmGstSetting?.setting_value === 'true';
const billType = determineBillType(party.state_code, firm.state_code);

// Calculate GST correctly
function calculateGST(lineValue, gstRate, billType) {
  if (!gstEnabled) return 0;

  if (billType === 'intra-state') {
    // CGST + SGST
    return (lineValue * gstRate / 100) / 2;
  } else {
    // IGST
    return lineValue * gstRate / 100;
  }
}
```

### Authentication Issues

#### Token Refresh Failures

**Symptoms:**
- User logged out unexpectedly
- "Token expired" errors
- Refresh token invalid

**Solutions:**
```javascript
// Implement automatic token refresh
class AuthManager {
  constructor() {
    this.refreshPromise = null;
  }

  async refreshToken() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin'
    });

    try {
      const response = await this.refreshPromise;
      if (response.ok) {
        const data = await response.json();
        // Update stored tokens
        this.updateTokens(data);
      }
    } finally {
      this.refreshPromise = null;
    }
  }
}
```

## Performance Issues

### Slow Page Loads

**Symptoms:**
- Pages take >3 seconds to load
- Large data tables slow to render
- API calls timeout

**Solutions:**
```javascript
// Implement pagination for large datasets
const pageSize = 25;
const currentPage = 1;

const response = await fetch(
  `/api/master-rolls?page=${currentPage}&limit=${pageSize}&search=${searchTerm}`
);

// Virtual scrolling for large tables
function renderVirtualTable(data, container) {
  const visibleRows = 50;
  const rowHeight = 40;
  const totalHeight = data.length * rowHeight;

  container.style.height = `${totalHeight}px`;

  // Only render visible rows
  const startIndex = Math.floor(scrollTop / rowHeight);
  const endIndex = Math.min(startIndex + visibleRows, data.length);

  // Render visible portion
  renderRows(data.slice(startIndex, endIndex), startIndex);
}
```

### High Memory Usage

**Symptoms:**
- Application crashes with out-of-memory errors
- PM2 restarts application frequently
- Slow response times

**Solutions:**
```javascript
// Implement memory monitoring
const memwatch = require('memwatch-next');

memwatch.on('leak', (info) => {
  console.error('Memory leak detected:', info);
  // Log memory usage
  const usage = process.memoryUsage();
  console.log(`RSS: ${usage.rss}, Heap: ${usage.heapUsed}/${usage.heapTotal}`);
});

// Optimize database queries
const optimizedQuery = db.prepare(`
  SELECT mr.*,
         u_creator.fullname as created_by_name
  FROM master_rolls mr
  LEFT JOIN users u_creator ON u_creator.id = mr.created_by
  WHERE mr.firm_id = ?
  ORDER BY mr.created_at DESC
  LIMIT ? OFFSET ?
`);

// Use streaming for large exports
function streamExport(res, query) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=data.csv');

  const stream = db.iterate(query);
  for (const row of stream) {
    res.write(formatCSVRow(row));
  }
  res.end();
}
```

### Database Performance Issues

**Symptoms:**
- Slow query execution
- Database connection timeouts
- High CPU usage on database

**Solutions:**
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_master_rolls_firm_aadhar ON master_rolls(firm_id, aadhar);
CREATE INDEX idx_master_rolls_firm_phone ON master_rolls(firm_id, phone_no);
CREATE INDEX idx_bills_firm_date ON bills(firm_id, bdate);
CREATE INDEX idx_stocks_firm_item ON stocks(firm_id, item);

-- Optimize complex queries
EXPLAIN QUERY PLAN
SELECT mr.*, f.name as firm_name
FROM master_rolls mr
JOIN firms f ON f.id = mr.firm_id
WHERE mr.firm_id = ? AND mr.status = ?
ORDER BY mr.created_at DESC
LIMIT ? OFFSET ?;

-- Use prepared statements
const stmt = db.prepare('SELECT * FROM master_rolls WHERE firm_id = ?');
const rows = stmt.all(firmId);
```

## Network and Connectivity Issues

### API Timeout Errors

**Symptoms:**
- "Network request failed" errors
- Timeout after 30 seconds
- Intermittent connection failures

**Solutions:**
```javascript
// Implement retry logic with exponential backoff
class ApiClient {
  async request(url, options = {}, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (response.ok) {
          return response;
        }

        // Retry on server errors (5xx)
        if (response.status >= 500 && attempt < retries) {
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
          continue;
        }

        return response;
      } catch (error) {
        if (error.name === 'AbortError' && attempt < retries) {
          // Timeout - retry
          await this.delay(Math.pow(2, attempt) * 1000);
          continue;
        }
        throw error;
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### CORS Issues

**Symptoms:**
- "CORS error" in browser console
- Preflight request failures
- API calls blocked by browser

**Solutions:**
```javascript
// Configure CORS properly
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from development and production domains
    const allowedOrigins = [
      'http://localhost:3000',
      'https://your-domain.com',
      'https://www.your-domain.com'
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

## File Upload Issues

### Large File Upload Failures

**Symptoms:**
- "Request entity too large" errors
- Upload timeouts
- Incomplete file uploads

**Solutions:**
```javascript
// Configure file upload limits
const multer = require('multer');
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Validate file types
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Nginx configuration for large uploads
// client_max_body_size 50M;
// client_body_timeout 300s;
// proxy_read_timeout 300s;
```

## Security Issues

### Cookie Security Problems

**Symptoms:**
- Cookies not being set
- Authentication fails in production
- "Secure cookie" warnings

**Solutions:**
```javascript
// Configure cookies properly for different environments
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 15 * 60 * 1000, // 15 minutes for access token
  domain: process.env.NODE_ENV === 'production' ? '.your-domain.com' : undefined
};

// Set cookies with proper options
res.cookie('accessToken', token, cookieOptions);
```

### XSS Protection Issues

**Symptoms:**
- Content Security Policy violations
- Inline script execution blocked
- Mixed content warnings

**Solutions:**
```javascript
// Implement Content Security Policy
const cspOptions = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // For inline event handlers
      "https://unpkg.com", // For external libraries
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // For inline styles
      "https://fonts.googleapis.com"
    ],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://ifsc.razorpay.com"]
  }
};

app.use(helmet.contentSecurityPolicy(cspOptions));
```

## Frequently Asked Questions

### General Questions

**Q: How do I reset a user's password?**
A: Password reset is currently handled by administrators. Use the user management interface to update passwords or contact the system administrator.

**Q: How do I export data for external systems?**
A: Use the export endpoints:
- Master rolls: `GET /api/master-rolls/export?format=csv`
- Bills: `GET /api/inventory/sales/bills/export`
- Include date filters for specific time ranges.

**Q: How do I set up multi-firm support?**
A: Multi-firm support is automatic. Each user belongs to a firm, and all data is isolated by `firm_id`. Create firms through the admin interface.

**Q: What are the system limits?**
A:
- Employees per firm: Unlimited
- Bills per firm: Unlimited
- File upload size: 10MB per file
- API rate limit: 1000 requests/hour per IP
- Bulk operations: 1000 records per operation

### Technical Questions

**Q: How do I monitor application performance?**
A: Use PM2 monitoring: `pm2 monit`. Check logs with `pm2 logs`. Monitor database with Turso dashboard.

**Q: How do I backup my data?**
A: Turso provides automatic backups. For manual backups:
```bash
turso db shell your-db ".backup backup.db"
```

**Q: How do I update the application?**
A:
```bash
# Stop application
pm2 stop business-app

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run migrations if any
npm run migrate

# Start application
pm2 start business-app
```

**Q: How do I troubleshoot high memory usage?**
A:
```bash
# Check memory usage
pm2 monit

# Enable garbage collection logging
node --expose-gc --max-old-space-size=4096 server/server.js

# Profile memory usage
npm install -g clinic
clinic heapprofiler -- node server/server.js
```

### Business Logic Questions

**Q: How does bill cancellation work?**
A: Bill cancellation:
1. Marks bill as 'CANCELLED'
2. Restores stock quantities to batches
3. Deletes associated ledger entries
4. Maintains audit trail with cancellation reason

**Q: How does IFSC lookup work?**
A: IFSC lookup:
1. User enters 11-character IFSC code
2. System calls Razorpay public API
3. Bank and branch details are auto-populated
4. Manual entry possible if API fails

**Q: How are GST calculations handled?**
A: GST calculations:
- Intra-state: CGST + SGST (split tax rate)
- Inter-state: IGST (full tax rate)
- Reverse charge supported
- Automatic state code validation

**Q: How does stock batch management work?**
A: Stock batches:
- FIFO (First In, First Out) deduction
- Batch-specific expiry dates
- MRP tracking per batch
- Automatic batch consolidation

This troubleshooting guide should resolve most common issues. For additional support, check the application logs, monitor system resources, and ensure all configurations are correct.
