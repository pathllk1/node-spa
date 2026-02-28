# Authentication & Authorization System

## Overview

The application utilizes a highly secure, dual-token JWT (JSON Web Token) architecture with a seamless, automatic refresh mechanism. It is built to support a multi-tenant (multi-firm) environment, enforcing strict role-based access control (RBAC) and data isolation using MongoDB.

## Architecture & Token Lifecycle

### Dual Token Flow
- **Access Token (`accessToken`):**
  - **Lifespan:** Short-lived (15 minutes).
  - **Purpose:** Used to authorize every protected API request. Contains user identity and role claims (ID, username, role, firm_id).
- **Refresh Token (`refreshToken`):**
  - **Lifespan:** Long-lived (30 days).
  - **Purpose:** Used exclusively to obtain a new Access Token without requiring the user to log in again.

### Storage & Security
Both tokens are generated on the backend and sent to the client as **`HttpOnly` cookies**.
- **Security Benefit:** `HttpOnly` cookies cannot be accessed by client-side JavaScript, rendering them immune to Cross-Site Scripting (XSS) attacks designed to steal session tokens.
- **CSRF Protection:** The application uses `SameSite=Strict` attributes on the cookies and implements an explicit CSRF token pattern (`x-csrf-token` header) to protect state-changing endpoints (POST, PUT, DELETE).

### Automatic Token Refresh (Middleware)
The authentication logic is handled seamlessly via Express middleware (`server/middleware/mongo/authMiddleware.js`):
1. **Request Interception:** The middleware intercepts an API call and checks the `accessToken` cookie.
2. **Access Token Valid:** If valid, the request proceeds.
3. **Access Token Expired/Missing:**
   - The middleware checks for the `refreshToken` cookie.
   - It decodes the refresh token and verifies its signature.
   - It performs a database lookup (`RefreshToken` model) to ensure the token hash exists and has not been revoked or expired.
   - If valid, a **new Access Token** is generated, attached to the response as a new cookie, and the original API request is allowed to proceed transparently to the user.
4. **Refresh Token Invalid/Expired:** The user's cookies are cleared, and a 401 Unauthorized response is sent, forcing a new login.

## Core Components

### 1. Authentication Controller (`authController.js`)
Handles the primary login and logout flows.

**Login Process (`POST /api/auth/login`):**
1. Receives `username` (or email) and `password`.
2. Queries the `User` collection (using Mongoose).
3. Verifies both the **User** and their assigned **Firm** have an `approved` status.
4. Verifies the password against the stored bcrypt hash.
5. Generates the Access and Refresh tokens.
6. Hashes the Refresh token (SHA-256) and stores it in the `RefreshToken` collection linked to the user's ID.
7. Sets the secure cookies and returns the user payload.

**Logout Process (`POST /api/auth/logout`):**
1. Hashes the provided Refresh token and deletes it from the database (token revocation).
2. Clears all authentication cookies from the client.

### 2. Token Utilities (`tokenUtils.js`)
Centralized functions for token management using the `jsonwebtoken` library.
- `generateTokenPair(user)`: Creates both tokens.
- `verifyAccessToken(token)` & `verifyRefreshToken(token)`: Validates signatures and expiration.

## Database Schema (Mongoose Models)

### `User` Model
Stores account information and credentials.
- `username` (String, Unique)
- `email` (String, Unique)
- `password` (String, Bcrypt hashed)
- `role` (Enum: `super_admin`, `admin`, `manager`, `user`)
- `status` (Enum: `pending`, `approved`, `rejected`)
- `firm_id` (ObjectId, Reference to `Firm` model)

### `Firm` Model
Represents a business entity.
- `name` (String, Unique)
- `code` (String, Unique)
- `status` (Enum: `pending`, `approved`, `rejected`)
- Dozens of other business-specific fields (GST, banking, address, etc.)

### `RefreshToken` Model
Tracks active, valid sessions to allow for server-side revocation.
- `user_id` (ObjectId, Reference to `User`)
- `token_hash` (String, SHA-256 hash of the raw token string)
- `expires_at` (Date, TTL index for automatic cleanup)

## User Roles & Permissions (RBAC)

Access control is enforced via the `requireRole` middleware, ensuring routes are restricted appropriately:

1. **`super_admin`:** Global system administrator. Can create and manage all Firms and all Users. Operates independently of any specific `firm_id`.
2. **`admin`:** Firm-level administrator. Can manage settings and users *only* within their assigned `firm_id`.
3. **`manager`:** Can perform most daily operations (e.g., bulk import/export, editing critical records) within their assigned `firm_id`, but cannot manage other users.
4. **`user`:** Basic access for daily data entry and viewing within their assigned `firm_id`. Restricted from destructive actions (like deleting records).

## Data Isolation (Multi-Tenancy)
For roles other than `super_admin`, every database query executed by the controllers explicitly includes the `firm_id` extracted from the user's Access Token.
- Example: `await MasterRoll.find({ firm_id: req.user.firm_id })`
- This guarantees that a user in Firm A can never accidentally or maliciously read or modify data belonging to Firm B.

## Client-Side Integration

The Vanilla JS frontend utilizes a utility class (`client/utils/auth.js`) to manage state:
- **`requireAuth(router)`**: Route guard used in page components before rendering. It makes an API call to `/api/auth/me` to verify the session is active.
- **CSRF Fetch Wrapper (`client/utils/api.js`)**: The `fetchWithCSRF` utility automatically intercepts API requests to add the `x-csrf-token` header, reading it from the non-HttpOnly `csrfToken` cookie.