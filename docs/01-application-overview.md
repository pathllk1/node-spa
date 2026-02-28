# Business Management Application - Overview

## Overview

This is a comprehensive business management Single Page Application (SPA) designed to handle multi-firm operations. The application provides several integrated modules including Human Resources (Master Roll & Wages), Inventory Management, and Financial Accounting (Ledger).

The application has recently undergone a major architectural migration, moving its data layer from a relational SQL database (SQLite/Turso via Prisma) to a document-oriented NoSQL database (**MongoDB via Mongoose**).

## Architecture

### Backend (Node.js + Express)
- **Framework**: Express.js with ES modules.
- **Database**: MongoDB (Object Data Modeling via Mongoose).
- **Authentication**: Dual-token JWT system (Access + Refresh tokens).
- **Security**: HTTP-only cookies, anti-CSRF tokens, XSS protection, and Content Security Policy (CSP) headers.
- **Architecture**: RESTful API with modular controllers, routes, and Mongoose models.

### Frontend (Vanilla JavaScript SPA)
- **Routing**: Client-side routing powered by `Navigo.js`.
- **Styling**: Tailwind CSS for responsive, utility-first styling.
- **Architecture**: Component-based ES6 modules utilizing lazy loading for optimal performance.
- **Data Grids**: Integrates `ag-grid-enterprise` for complex data tables (e.g., in the Super Admin panel).

## Core Features

### 1. Multi-Firm Architecture & Authentication
- **Multi-Tenant Design:** Supports multiple distinct business entities (Firms) within a single deployed instance.
- **Role-Based Access Control (RBAC):** Hierarchical roles including `super_admin`, `admin`, `manager`, and `user`.
- **Dual JWT Token Authentication:** Short-lived access tokens (15 minutes) and long-lived, rotatable refresh tokens (30 days) stored securely as HTTP-only cookies.

### 2. Human Resources (HR)
- **Master Roll:** Comprehensive employee record management including personal details, banking (with real-time IFSC lookup via Razorpay API), and compliance tracking (Aadhar, PAN, ESIC).
- **Wages Management:** Calculate, track, and record employee daily wages, deductions (EPF/ESIC), and generate payment histories.
- **Bulk Operations:** Excel-based bulk import and export capabilities.

### 3. Inventory & Sales Management
- **Stock Tracking:** Item and batch-level stock management supporting Units of Measure (UOM) and GST rate configurations.
- **Parties Management:** Maintain records for both customers and suppliers.
- **Billing & Invoicing:** Create sales bills with automatic GST calculations and PDF invoice generation. Includes features for bill cancellation and stock reversal.
- **Reporting:** Exportable reports for stock movement and sales history.

### 4. Financial Accounting (Ledger)
- **Double-Entry Bookkeeping:** A robust general ledger system.
- **Vouchers:** Manage Payment, Receipt, Contra, and Journal vouchers.
- **Financial Reporting:** Generate Trial Balances and detailed account-specific ledger reports.

### 5. Super Admin Dashboard
- **System Oversight:** Global view of all users and registered firms.
- **Firm Management:** A detailed wizard for creating and configuring new firms, including automated GST detail fetching.
- **User Assignment:** Interface to assign, reassign, or remove users from specific firms.

## Technical Stack

### Backend Dependencies
- `express`: Web server framework.
- `mongoose`: MongoDB object modeling.
- `jsonwebtoken`: JWT creation and verification.
- `bcrypt`: Password hashing.
- `cookie-parser`: Middleware to parse HTTP cookies.
- `pdfmake`: Server-side PDF generation for invoices and reports.
- `exceljs`: Parsing and generating Excel files for bulk operations.
- `xss`: Input sanitization to prevent Cross-Site Scripting.

### Frontend Technologies
- **Vanilla JavaScript (ES6 Modules)**
- **Tailwind CSS v4**
- **Navigo.js** (Routing)
- **Toastify.js** (Notifications)
- **ag-Grid** (Advanced data tables)
- **SheetJS / xlsx** (Client-side Excel parsing/exporting)

## Security Features

- **XSS Prevention:** Input sanitization middleware (`sanitizer.js`) and strict Content Security Policy headers.
- **CSRF Protection:** State-changing requests require a CSRF token validated via middleware.
- **Secure Sessions:** JWTs are stored in `HttpOnly`, `SameSite=Strict` cookies.
- **Data Isolation:** All database queries implicitly filter by `firm_id` (except for Super Admin operations) to ensure strict data tenancy.

## Deployment Configuration

The application is configured for deployment on **Vercel** as a serverless application.
- `vercel.json` provides routing rewrites, directing API calls to the serverless functions while allowing the SPA to handle frontend routing.
- The `api/index.js` file serves as the serverless entry point.