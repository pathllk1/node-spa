# Node.js SPA Business Management Application

## Overview

This is a comprehensive business management Single Page Application (SPA) built with Node.js, Express, and vanilla JavaScript. The application provides multiple business management modules including inventory management, wages management, master roll management, and authentication system.

## Architecture

### Backend (Node.js + Express)
- **Framework**: Express.js with ES modules
- **Database**: MongoDB (Object Data Modeling via Mongoose)
- **Authentication**: JWT dual-token system (Access + Refresh tokens)
- **Security**: HTTP-only cookies, CSRF protection, CSP headers, XSS protection
- **Architecture**: RESTful API with modular controllers and routes

### Frontend (Vanilla JavaScript SPA)
- **Routing**: Navigo.js for client-side routing
- **Styling**: TailwindCSS with custom gradients and responsive design
- **Architecture**: Component-based with lazy loading
- **State Management**: Client-side authentication state management

## Core Features

### 1. Authentication System
- Dual JWT token authentication (15min access, 30 days refresh)
- Automatic token refresh
- HTTP-only cookies with SameSite protection
- Role-based access control
- Password hashing with bcrypt
- Multi-firm user isolation

### 2. Inventory Management System
- Dashboard with overview metrics
- Product categories management
- Supplier management
- Stock tracking and movement
- Sales tracking with **bill cancellation functionality**
- Comprehensive reporting system
- Stock movement tracking
- GST-compliant billing with automatic calculations

### 3. Master Roll Management
- Employee master data management
- Personnel records with **IFSC bank lookup integration**
- Organizational hierarchy
- Complete employee profile management (Aadhar, PAN, banking details)
- **Real-time IFSC validation** with Razorpay API integration
- Bulk import/export operations

### 4. Wages Management
- Employee wages dashboard
- Salary calculations
- Payment tracking
- Wage reports and analytics

### 5. Financial Accounting System
- **Double-Entry Bookkeeping**: Complete ledger management with automated transaction posting
- **Payment & Receipt Vouchers**: Manual accounting entries for cash/bank transactions
- **Journal Entries**: Multi-line general journal entries for complex accounting adjustments
- **Financial Reporting**: Account ledger, general ledger, trial balance, and PDF reports
- **GST Integration**: Tax-compliant transaction processing and reporting
- **Multi-firm Accounting**: Complete financial isolation between business entities

### 6. Advanced Data Features
- **IFSC Lookup System**: Real-time bank and branch validation using Razorpay API
- **Bill Cancellation**: Complete bill reversal with stock restoration and financial adjustments
- **PDF Report Generation**: Professional financial document creation with custom formatting
- **Multi-firm Data Isolation**: Complete security separation between firms
- **Complete Audit Trails**: Full transaction history and user attribution
- **Bulk Operations**: Import, export, and batch processing capabilities

### 7. Reporting System
- Inventory reports
- Sales reports with cancellation tracking
- Financial reports
- Custom date-range filtering
- Export capabilities (Excel, CSV, PDF)

## Technical Stack

### Backend Dependencies
- `express`: Web framework
- `mongoose`: MongoDB object modeling
- `jsonwebtoken`: JWT token handling
- `bcrypt`: Password hashing
- `cookie-parser`: Cookie handling
- `pdfmake`: PDF generation
- `exceljs`: Excel generation
- `dotenv`: Environment variables

### Frontend Technologies
- Vanilla JavaScript with ES6 modules
- TailwindCSS for styling
- Navigo.js for routing
- Font Awesome for icons

## Database Schema

The application uses MongoDB with the following key collections:
- `users`: User authentication and profiles
- `firms`: Multi-firm support
- `stocks`, `parties`, `bills`: Inventory management collections
- `wages`: Wages management collection
- `master_rolls`: Employee master data
- `refresh_tokens`: Active user sessions

## Security Features

- Content Security Policy (CSP) headers
- XSS protection middleware
- Secure cookie configuration
- Input validation and sanitization
- Authentication middleware for protected routes
- Automatic token refresh mechanism

## Performance Optimizations

- Lazy loading of page components
- Code splitting with dynamic imports
- Efficient database queries with proper indexing
- Client-side caching for authentication state
- Optimized bundle size with TailwindCSS purging

## Development Features

- Hot reloading with nodemon
- ES6 module support
- Environment-based configuration
- Comprehensive error handling
- Development vs production logging

## API Structure

```
/api/auth/*          - Authentication endpoints
/api/admin/*         - Administrative functions
/api/inventory/*     - Inventory management
/api/wages/*        - Wages management
/api/master-rolls/* - Master roll management
/api/settings/*     - Application settings
```

## Client Routes

```
/                     - Home page
/about               - About page
/login               - Authentication
/dashboard           - Main dashboard
/profile             - User profile
/master-roll         - Employee master roll
/wages-dashboard     - Wages management
/inventory/*         - Inventory module pages
```

This application provides a complete business management solution with modern web technologies, focusing on security, performance, and user experience.
