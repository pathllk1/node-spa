# Node.js SPA Business Management Application

## Overview

This is a comprehensive business management Single Page Application (SPA) built with Node.js, Express, and vanilla JavaScript. The application provides multiple business management modules including inventory management, wages management, master roll management, and authentication system.

## Architecture

### Backend (Node.js + Express)
- **Framework**: Express.js with ES modules
- **Database**: Turso (SQLite cloud database)
- **Authentication**: JWT dual-token system (Access + Refresh tokens)
- **Security**: HTTP-only cookies, CSP headers, XSS protection
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

### 2. Inventory Management System
- Dashboard with overview metrics
- Product categories management
- Supplier management
- Stock tracking and movement
- Sales tracking
- Comprehensive reporting system
- Stock movement tracking

### 3. Wages Management
- Employee wages dashboard
- Salary calculations
- Payment tracking
- Wage reports and analytics

### 4. Master Roll Management
- Employee master data management
- Personnel records
- Organizational hierarchy

### 5. Reporting System
- Inventory reports
- Sales reports
- Financial reports
- Custom date-range filtering
- Export capabilities

## Technical Stack

### Backend Dependencies
- `express`: Web framework
- `libsql`: Turso database client
- `jsonwebtoken`: JWT token handling
- `bcrypt`: Password hashing
- `cookie-parser`: Cookie handling
- `pdfmake`: PDF generation
- `dotenv`: Environment variables

### Frontend Technologies
- Vanilla JavaScript with ES6 modules
- TailwindCSS for styling
- Navigo.js for routing
- Font Awesome for icons

## Database Schema

The application uses Turso (SQLite cloud) with the following key tables:
- `users`: User authentication and profiles
- `firms`: Multi-firm support
- `inventory_*`: Inventory management tables
- `wages_*`: Wages management tables
- `master_roll_*`: Employee master data

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
