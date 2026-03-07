# Password Manager - Technical Implementation Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│         Super Admin Panel (superAdmin.js)        │
│  ┌──────────────────────────────────────────┐   │
│  │ Tab 1: Firm Management                    │   │
│  │ Tab 2: User Assignment                    │   │
│  │ Tab 3: Update Passwords ← NEW             │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  UserPasswordManager Component                   │
│  ┌───────────────────────────────────────────┐  │
│  │ • Init & Load Data                        │  │
│  │ • User Filtering                          │  │
│  │ • Password Validation                     │  │
│  │ • Strength Indicator                      │  │
│  │ • Confirmation Modal                      │  │
│  │ • Error Handling                          │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         ↓ HTTP Requests ↓ (Authenticated)
┌─────────────────────────────────────────────────┐
│        Express API (admin.js routes)            │
│  ┌───────────────────────────────────────────┐  │
│  │ GET  /admin/super-admin/users/...         │  │
│  │ POST /admin/super-admin/users/update-...  │  │
│  │ GET  /admin/super-admin/password-audit... │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         ↓ Mongoose Operations ↓
┌─────────────────────────────────────────────────┐
│         MongoDB Collections                      │
│  ├─ users (password field updated)             │
│  └─ admin_audit_logs (new entries created)     │
└─────────────────────────────────────────────────┘
```

## File Structure

```
project-root/
├── server/
│   ├── models/
│   │   ├── User.model.js (existing - fields used)
│   │   └── AdminAuditLog.model.js (NEW)
│   ├── routes/
│   │   └── mongo/
│   │       └── admin.js (ENHANCED +150 lines)
│   └── middleware/
│       └── mongo/
│           └── authMiddleware.js (used for JWT validation)
├── client/
│   ├── pages/
│   │   └── superAdmin.js (ENHANCED +5 lines)
│   └── components/
│       └── admin/
│           ├── userPasswordManager.js (NEW - 600+ lines)
│           └── toast.js (used for notifications)
└── package.json (no new dependencies needed)
```

## Database Schema

### AdminAuditLog Collection

```javascript
{
  _id: ObjectId,
  admin_id: ObjectId,              // FK to User
  target_user_id: ObjectId,        // FK to User (nullable)
  action: String,                  // 'password_change'
  details: {                       // Mixed type
    username: String,
    email: String,
    fullname: String
  },
  ip_address: String,              // IPv4/IPv6
  user_agent: String,              // Browser info
  status: String,                  // 'success' | 'failed'
  error_message: String,           // Nullable
  createdAt: Date,                 // Auto
  updatedAt: Date                  // Auto
}
```

### Indices

```javascript
// For efficient queries
db.admin_audit_logs.createIndex({ admin_id: 1, createdAt: -1 })
db.admin_audit_logs.createIndex({ target_user_id: 1, createdAt: -1 })
db.admin_audit_logs.createIndex({ action: 1, createdAt: -1 })
```

## API Endpoints

### 1. GET /api/admin/super-admin/users/for-password-update

**Purpose:** Fetch list of users that can have passwords changed

**Authorization:**
```
- Requires: JWT authentication
- Role: super_admin only
```

**Response (200 OK):**
```json
{
  "success": true,
  "users": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "id": "507f1f77bcf86cd799439011",
      "username": "john_doe",
      "email": "john@example.com",
      "fullname": "John Doe",
      "role": "manager",
      "status": "approved",
      "created_at": "2024-03-07T10:00:00Z",
      "firm_name": "ACME Corp",
      "firm_code": "ACME"
    }
  ]
}
```

**Error (401):**
```json
{
  "success": false,
  "message": "Authentication required"
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "Super admin privileges required"
}
```

---

### 2. POST /api/admin/super-admin/users/update-password

**Purpose:** Update a user's password

**Authorization:**
```
- Requires: JWT authentication
- Role: super_admin only
```

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "newPassword": "SecurePass@2024Update"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password updated successfully for John Doe",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "fullname": "John Doe"
  }
}
```

**Error (400):**
```json
{
  "success": false,
  "error": "User ID and new password are required"
}
```

**Error (400):**
```json
{
  "success": false,
  "error": "Password must be at least 8 characters long"
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "User not found or cannot modify super admin password"
}
```

**Error (500):**
```json
{
  "success": false,
  "error": "Failed to update password. Please try again."
}
```

---

### 3. GET /api/admin/super-admin/password-audit-log?page=1

**Purpose:** Fetch audit log of password changes

**Authorization:**
```
- Requires: JWT authentication
- Role: super_admin only
```

**Query Parameters:**
```
?page=1 (default: 1, range: 1+)
```

**Response (200 OK):**
```json
{
  "success": true,
  "logs": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "action": "password_change",
      "status": "success",
      "createdAt": "2024-03-07T14:30:00Z",
      "admin_name": "Super Administrator",
      "admin_username": "superadmin",
      "target_username": "john_doe",
      "target_fullname": "John Doe",
      "target_email": "john@example.com",
      "details": {
        "username": "john_doe",
        "email": "john@example.com",
        "fullname": "John Doe"
      },
      "error_message": null,
      "ip_address": "192.168.1.100"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

## Frontend Component Architecture

### Class: UserPasswordManager

```javascript
class UserPasswordManager {
  constructor(containerId)
  
  // Lifecycle Methods
  async init()                    // Initialize component
  async loadData()                // Fetch users and audit logs
  async render()                  // Render UI
  attachEventListeners()          // Attach event handlers
  
  // Data Methods
  applyFilters()                  // Filter users by search
  getRoleColor(role)              // Get badge color for role
  
  // Password Methods
  validatePassword(password)      // Returns array of errors
  getPasswordStrength(password)   // Returns {level, text, color}
  
  // Update Methods
  async updatePassword(userId)    // Main password update flow
  async showConfirmationModal()   // Show confirmation before update
}
```

### Component State

```javascript
this.users              // Array of users
this.auditLogs         // Array of audit logs
this.filteredUsers     // Filtered user array after search
this.newPasswords      // Map<userId, password>
this.searchTerm        // Current search string
this.editingUserId     // ID of user being edited
this.currentPage       // Current audit log page
```

### Event Flow

```
1. User clicks Edit button
   ↓
2. editingUserId set, component re-renders
   ↓
3. User types password in input field
   ↓
4. newPasswords Map updated on input
   ↓
5. Password strength indicator updates in real-time
   ↓
6. User clicks Update button
   ↓
7. Client-side validation (validatePassword)
   ↓
8. Confirmation modal shown
   ↓
9. User checks confirmation and clicks Update
   ↓
10. POST request sent to backend
    ↓
11. Backend validates and updates
    ↓
12. Audit log created
    ↓
13. Component reloads and displays success toast
```

## Backend Request Flow

```
POST /api/admin/super-admin/users/update-password
    ↓
[authenticateJWT] - Verify JWT token
    ↓
[requireRole('super_admin')] - Check user role
    ↓
Validate request body:
  ├─ userId exists
  ├─ newPassword exists
  └─ newPassword.length >= 8
    ↓
Query User by ID:
  ├─ Role !== 'super_admin'
  ├─ Exists
  └─ Return user data
    ↓
Hash password:
  └─ bcrypt.hash(newPassword, 12)
    ↓
Update User:
  ├─ password: hashedPassword
  ├─ failed_login_attempts: 0
  └─ account_locked_until: null
    ↓
Log to AdminAuditLog:
  ├─ admin_id: req.user.id
  ├─ target_user_id: userId
  ├─ action: 'password_change'
  ├─ status: 'success'
  ├─ ip_address: req.ip
  └─ details: user info
    ↓
Return success response
```

## Security Implementation

### 1. Password Hashing

```javascript
const bcrypt = require('bcrypt');

// Hashing on password update
const hashedPassword = await bcrypt.hash(newPassword, 12);
// 12 rounds takes ~100ms

// Never stored in plain text
// Never transmitted in logs
// Verified with bcrypt.compare() on login
```

### 2. Role-Based Access Control

```javascript
// Only super_admin can access endpoints
router.post(
  '/super-admin/users/update-password',
  authenticateJWT,           // Middleware 1: JWT verification
  requireRole('super_admin'), // Middleware 2: Role check
  async (req, res) => { ... }
);
```

### 3. Input Validation

```javascript
// Client-side
validatePassword(password) {
  const errors = [];
  if (!password) errors.push('Password is required');
  if (password.length < 8) errors.push('Min 8 chars');
  if (!/[A-Z]/.test(password)) errors.push('Need uppercase');
  // ... more validations
  return errors;
}

// Server-side (defensive programming)
if (!userId || !newPassword) {
  return res.status(400).json({
    success: false,
    error: 'User ID and new password are required'
  });
}
```

### 4. Audit Logging

```javascript
// Every action is logged
await AdminAuditLog.create({
  admin_id: adminId,
  target_user_id: userId,
  action: 'password_change',
  status: result ? 'success' : 'failed',
  details: { username, email, fullname },
  ip_address: clientIP,
  error_message: err?.message || null
});
```

## Error Handling Strategy

### Client-Side

```javascript
try {
  // Validate locally first
  const errors = this.validatePassword(newPassword);
  if (errors.length > 0) {
    toast.error(errors.join('\n'));
    return;
  }
  
  // Show warning modal
  const confirmed = await this.showConfirmationModal(user, newPassword);
  if (!confirmed) return;
  
  // Make API call
  const response = await fetch('/api/admin/super-admin/users/update-password', {
    method: 'POST',
    body: JSON.stringify({ userId, newPassword })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  // Success
  toast.success('Password updated successfully');
  
} catch (error) {
  // Display error
  toast.error('Failed: ' + error.message);
  console.error('Error:', error);
}
```

### Server-Side

```javascript
try {
  // Validation
  if (!userId || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'User ID and new password are required'
    });
  }
  
  // Check if user exists
  const user = await User.findOne({ _id: userId, role: { $ne: 'super_admin' } });
  if (!user) {
    // Log the failed attempt
    await AdminAuditLog.create({
      admin_id: adminId,
      target_user_id: userId,
      action: 'password_change',
      status: 'failed',
      error_message: 'User not found',
      ip_address: adminIp
    });
    
    return res.status(404).json({
      success: false,
      error: 'User not found or cannot modify super admin password'
    });
  }
  
  // Hash and update
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await User.findByIdAndUpdate(userId, { password: hashedPassword });
  
  // Log success
  await AdminAuditLog.create({
    admin_id: adminId,
    target_user_id: userId,
    action: 'password_change',
    status: 'success',
    details: { username: user.username, email: user.email },
    ip_address: adminIp
  });
  
  return res.json({ success: true, message: 'Password updated' });
  
} catch (error) {
  // Log error
  console.error('Error updating password:', error);
  
  await AdminAuditLog.create({
    admin_id: adminId,
    action: 'password_change',
    status: 'failed',
    error_message: error.message,
    ip_address: adminIp
  });
  
  return res.status(500).json({
    success: false,
    error: 'Failed to update password. Please try again.'
  });
}
```

## Testing Checklist

- [ ] Only super_admin can access endpoints
- [ ] Weak passwords are rejected with clear errors
- [ ] Strong password updates succeed
- [ ] Audit log captures all changes
- [ ] Password works on next login
- [ ] Old sessions are invalidated
- [ ] Account lockout is cleared
- [ ] IP address is logged correctly
- [ ] Modal confirmation blocks accidental updates
- [ ] Search filtering works in real-time
- [ ] Failed attempts are logged

## Performance Considerations

1. **Bcrypt Hashing** - 12 rounds takes ~100ms (intentionally slow)
2. **Database Queries** - Indexed queries for: admin_id, target_user_id, action
3. **Pagination** - Audit logs paginated at 20 per page
4. **Search** - Client-side filtering (fast for < 1000 users)
5. **Re-renders** - Component uses targeted re-renders

## Deployment Checklist

- [ ] Environment variables configured (.env)
- [ ] MongoDB connection working
- [ ] JWT secrets set (32+ bytes each)
- [ ] Bcrypt dependency available
- [ ] HTTPS enabled in production
- [ ] Rate limiting active
- [ ] Audit logs backed up regularly
- [ ] Access logs monitored
- [ ] Password policies documented
- [ ] User training completed

