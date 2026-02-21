# Authentication System Documentation

## Overview

The authentication system implements a robust dual JWT token architecture with automatic refresh capabilities, designed for business management applications with multi-firm support and role-based access control. **Enhanced with comprehensive security features, automatic token management, and enterprise-grade session handling.**

## Architecture

### Dual Token System
- **Access Token**: Short-lived (15 minutes) for API authorization
- **Refresh Token**: Long-lived (30 days) for token renewal
- **Automatic Refresh**: Seamless token renewal without user interaction
- **Secure Storage**: HTTP-only cookies with cryptographic security

### Security Features
- HTTP-only cookies with SameSite protection
- Secure cookie configuration for production
- Content Security Policy (CSP) headers
- XSS protection middleware
- Password hashing with bcrypt (12 salt rounds)
- Multi-firm user isolation with strict data separation
- Comprehensive audit logging for all authentication events

## Core Components

### 1. Authentication Controller (`authController.js`)

#### Login Process
```javascript
POST /api/auth/login
Body: { username, password }
```

**Flow:**
1. Validates username/password presence
2. Attempts user lookup by email or username
3. Verifies firm approval status
4. Checks user approval status
5. Compares password with bcrypt
6. Updates last login timestamp
7. Generates token pair
8. Sets secure HTTP-only cookies
9. Returns user data (excluding password)

#### Token Generation
```javascript
const { accessToken, refreshToken } = generateTokenPair(user);
```

**Cookie Configuration:**
- `accessToken`: httpOnly=true, secure, sameSite=strict, maxAge=15min
- `refreshToken`: httpOnly=true, secure, sameSite=strict, maxAge=30days
- `tokenExpiry`: Client-readable expiry timestamp

### 2. Authentication Middleware (`authMiddleware.js`)

#### Automatic Token Refresh Logic
```javascript
export const authMiddleware = async (req, res, next) => {
  // 1. Extract tokens from cookies
  // 2. Try to verify access token
  // 3. If access token expired, verify refresh token
  // 4. Generate new access token if refresh valid
  // 5. Set new cookies and continue
  // 6. Clear cookies if refresh invalid
}
```

#### Optional Authentication
```javascript
export const optionalAuth = async (req, res, next) => {
  // Allows routes to work with or without authentication
}
```

### 3. Token Utilities (`tokenUtils.js`)

#### JWT Configuration
```javascript
const ACCESS_TOKEN_SECRET = 'your-access-token-secret-key-change-in-production';
const REFRESH_TOKEN_SECRET = 'your-refresh-token-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';
```

#### Token Payload
```javascript
const payload = {
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  firm_id: user.firm_id
};
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  fullname TEXT,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  firm_id INTEGER,
  status TEXT DEFAULT 'pending',
  last_login TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (firm_id) REFERENCES firms(id)
);
```

### Firms Table
```sql
CREATE TABLE firms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending'
);
```

### Refresh Tokens Table
```sql
CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## API Endpoints

### Public Endpoints
```
POST /api/auth/login
Body: { username, password }
Response: { success, message, user }
```

### Protected Endpoints
```
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/refresh
```

## User Roles & Permissions

### Role Types
- `super_admin`: System administrator
- `admin`: Firm administrator
- `user`: Regular user
- `manager`: Department manager

### Firm-Based Isolation
- Users are associated with firms (`firm_id`)
- All data queries include firm filtering
- Firm approval required for login
- User approval required for access

## Client-Side Integration

### Authentication State Management
```javascript
// Check authentication status
const checkAuth = async () => {
  const response = await fetch('/api/auth/me', {
    credentials: 'same-origin'
  });
  return response.ok ? await response.json() : null;
};
```

### Automatic Token Refresh
- Client monitors `tokenExpiry` cookie
- Refreshes tokens 1 minute before expiry
- Handles token refresh failures gracefully

## Security Best Practices

### Password Security
- Bcrypt hashing with salt rounds
- No plain text password storage
- Secure password reset mechanisms

### Cookie Security
- HTTP-only cookies prevent XSS access
- SameSite=strict prevents CSRF
- Secure flag in production
- Appropriate expiry times

### Session Management
- Automatic logout on refresh token expiry
- Token invalidation on logout
- Session tracking and monitoring

## Error Handling

### Authentication Errors
- 400: Missing credentials
- 401: Invalid credentials / Session expired
- 403: Account/firm not approved
- 404: User not found
- 500: Server error

### Client-Side Error Handling
```javascript
const handleAuthError = (error) => {
  if (error.status === 401) {
    // Redirect to login
    window.location.href = '/login';
  }
};
```

## Configuration

### Environment Variables
```env
NODE_ENV=production
ACCESS_TOKEN_SECRET=your-secure-access-secret
REFRESH_TOKEN_SECRET=your-secure-refresh-secret
TURSO_DATABASE_URL=your-turso-url
TURSO_AUTH_TOKEN=your-turso-token
```

## Testing

### Login Flow Testing
1. Valid credentials → Success with cookies
2. Invalid credentials → 401 error
3. Unapproved user → 403 error
4. Expired session → Automatic refresh
5. Invalid refresh → Logout redirect

### Security Testing
1. Cookie access attempts (should fail)
2. Token tampering (should fail)
3. Cross-site requests (should be blocked)
4. Session hijacking prevention

This authentication system provides enterprise-grade security with user-friendly automatic session management, making it suitable for business applications requiring robust access control and multi-tenant support.
