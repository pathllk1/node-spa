# Comprehensive API Reference

## Introduction
This document provides a comprehensive reference for the RESTful API endpoints in the Business Management Application.

The API is built using Node.js and Express, backed by a **MongoDB** database (via Mongoose). All data exchanged is in JSON format.

## Base URL
All API requests must be prefixed with:
`/api`

## Authentication & Security
- **JSON Web Tokens (JWT):** The API utilizes a dual-token system (Access + Refresh).
- **Cookies:** Tokens are transmitted and stored strictly via `HttpOnly` cookies. You *do not* need to pass `Authorization: Bearer <token>` headers manually in your client requests if cookies are configured to be sent (e.g., `credentials: 'same-origin'` in Fetch).
- **CSRF Protection:** All state-changing requests (`POST`, `PUT`, `DELETE`, `PATCH`) require a CSRF token. The token must be read from the `csrfToken` cookie and sent in the `x-csrf-token` header.

---

## 1. Authentication Endpoints
**Base Path:** `/api/auth`

| Method | Endpoint | Description | Auth Required | Request Body |
| :--- | :--- | :--- | :---: | :--- |
| `POST` | `/login` | Authenticate user and issue tokens | No | `{ username, password }` |
| `POST` | `/logout` | Invalidate tokens and clear cookies | Yes | None |
| `GET` | `/me` | Retrieve the currently authenticated user's profile | Yes | None |
| `POST` | `/refresh` | Explicitly request a new Access Token (usually handled automatically by middleware) | Yes (Refresh Token) | None |

---

## 2. Admin & Super Admin Endpoints
**Base Path:** `/api/admin`
These endpoints require specific elevated roles (`admin` or `super_admin`).

| Method | Endpoint | Description | Role Required | Request Body |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/users` | Get all users (excluding super_admins) | `super_admin` | None |
| `GET` | `/users/pending` | Get all users awaiting approval | `super_admin` | None |
| `PATCH`| `/users/:id/status`| Approve, reject, or suspend a user | `super_admin` | `{ status: "approved"\|"rejected"\|"pending" }` |
| `POST` | `/users` | Create a new user within the admin's firm | `admin` | `{ fullname, username, email, password, role }` |
| `GET` | `/firms` | List all firms | `super_admin` | None |
| `POST` | `/firms` | Create a new firm (and optionally its first admin account) | `super_admin` | `{ name, email, ..., [admin_account: {}] }` |
| `PUT` | `/firms/:id` | Update a firm's details | `super_admin` | `{ [updated_fields] }` |
| `DELETE`|`/firms/:id` | Delete a firm (fails if data exists) | `super_admin` | None |
| `POST` | `/assign-user-to-firm` | Assign or remove a user from a firm | `super_admin` | `{ userId, firmId }` (null `firmId` unassigns) |
| `GET` | `/users-with-firms` | List users and their assigned firm | `admin` \| `super_admin` | None |
| `GET` | `/super-admin/stats`| Get global system statistics | `super_admin` | None |

---

## 3. Master Roll (HR) Endpoints
**Base Path:** `/api/master-rolls`
Manages employee records for a specific firm.

| Method | Endpoint | Description | Auth Required | Notes |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/` | List all employees for the user's firm | Yes | Supports filtering/sorting |
| `POST` | `/` | Add a new employee to the firm | Yes | |
| `GET` | `/:id` | Get details of a specific employee | Yes | |
| `PUT` | `/:id` | Update an employee record | Yes | |
| `DELETE`| `/:id` | Remove an employee record | Yes (Manager/Admin) | |
| `GET` | `/search` | Search employee records | Yes | Query param `?q=` required |
| `GET` | `/stats` | Get employee statistics (total, active, exited) | Yes | |
| `POST` | `/bulk` | Bulk create/import employees from an array | Yes (Manager/Admin) | Array of employee objects |
| `DELETE`| `/bulk-delete`| Delete multiple employees | Yes (Manager/Admin) | `{ ids: ["id1", "id2"] }` |
| `GET` | `/export` | Export master roll data | Yes | Query param `?format=csv` |
| `GET` | `/lookup-ifsc/:ifsc`| External lookup for bank details via IFSC | Yes | Code must be 11 chars |

---

## 4. Wages Endpoints
**Base Path:** `/api/wages`
Manages daily wages, salary calculations, and payment history.

| Method | Endpoint | Description | Auth Required | Notes |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/` | List all wages for the firm | Yes | |
| `POST` | `/` | Add a new wage record | Yes | |
| `GET` | `/:id` | Get specific wage details | Yes | |
| `PUT` | `/:id` | Update a wage record | Yes | |
| `DELETE`| `/:id` | Delete a wage record | Yes (Manager/Admin) | |
| `GET` | `/manage` | Get wages management view for a specific month | Yes | Query param `?month=YYYY-MM` |
| `POST` | `/save-all` | Bulk save multiple wage entries | Yes | |
| `GET` | `/history/:employee_id` | Get the entire wage history for an employee | Yes | |
| `GET` | `/stats` | Get wages statistics | Yes | |

---

## 5. Inventory (Sales) Endpoints
**Base Path:** `/api/inventory/sales`
Manages parties (customers/suppliers), stock, bills, and GST lookups.

| Method | Endpoint | Description | Auth Required | Notes |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/dashboard` | Get sales overview statistics | Yes | |
| `GET` | `/lookup-gst` | Fetch details from external GST API | Yes | Query param `?gstin=` |
| `GET` | `/party` | List all parties | Yes | |
| `POST` | `/party` | Create a new party | Yes | |
| `PUT` | `/party/:id` | Update a party | Yes | |
| `DELETE`| `/party/:id` | Delete a party | Yes | |
| `GET` | `/stock` | List all stock items (supports batch filtering) | Yes | |
| `POST` | `/stock` | Create a new stock item | Yes | |
| `PUT` | `/stock/:id` | Update a stock item | Yes | |
| `DELETE`| `/stock/:id` | Delete a stock item | Yes | |
| `POST` | `/bill` | Create a new sales bill | Yes | |
| `GET` | `/bill/:id` | Get details of a specific bill | Yes | |
| `PUT` | `/bill/:id/cancel`| Cancel a bill (reverses stock movement) | Yes (Manager/Admin)| |
| `GET` | `/bills/report` | Generate a sales report | Yes | Supports date filters |
| `GET` | `/bills/export` | Export bills to Excel | Yes | |

---

## 6. Ledger (Accounting) Endpoints
**Base Path:** `/api/ledger`
Manages double-entry bookkeeping, journal entries, and vouchers.

| Method | Endpoint | Description | Auth Required | Notes |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/accounts` | List all unique account heads | Yes | |
| `GET` | `/account-details`| Get detailed ledger for a specific account head | Yes | Query param `?head=` |
| `GET` | `/trial-balance`| Generate a trial balance report | Yes | |
| `POST` | `/journal-entry`| Create a new journal entry | Yes | Requires balanced debits/credits |
| `GET` | `/journal-entries`| List all journal entries | Yes | |
| `GET` | `/journal-entry/:id`| Get a specific journal entry | Yes | |
| `GET` | `/vouchers` | List all vouchers | Yes | |
| `POST` | `/voucher` | Create a new voucher (Payment, Receipt, Contra) | Yes | |
| `GET` | `/voucher/:id` | Get details of a specific voucher | Yes | |

---

## 7. Settings Endpoints
**Base Path:** `/api/settings`
Manages firm-specific configurations and sequences.

| Method | Endpoint | Description | Auth Required | Notes |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/` | Get current firm settings | Yes | |
| `PUT` | `/` | Update firm settings | Yes (Admin) | |
| `GET` | `/sequences` | Get current bill/voucher sequence numbers | Yes | |
| `PUT` | `/sequences` | Update sequence numbers | Yes (Admin) | |

---

## HTTP Response Codes
The API uses conventional HTTP response codes to indicate the success or failure of an API request.

*   **200 OK:** The request was successful.
*   **201 Created:** A new resource was successfully created.
*   **400 Bad Request:** The request was malformed or missing required parameters.
*   **401 Unauthorized:** Authentication failed (e.g., missing or invalid JWT cookies).
*   **403 Forbidden:** The authenticated user lacks the necessary role or permissions to perform the action.
*   **404 Not Found:** The requested resource does not exist (or does not belong to the user's firm).
*   **409 Conflict:** The request conflicts with the current state of the server (e.g., duplicate username).
*   **500 Internal Server Error:** An unexpected error occurred on the server.