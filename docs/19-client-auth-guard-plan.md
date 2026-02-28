# Client-Side Authentication Guard Refactoring Plan

## 1. Analysis of Current Implementation

The current client-side authentication system relies on `client/utils/auth.js` (an `AuthManager` class), `client/middleware/authMiddleware.js` (route guards), and `client/utils/api.js` (fetch wrapper).

While functionally secure—because actual security is enforced by the backend using HttpOnly cookies—the client-side implementation has several critical architectural flaws that negatively impact User Experience (UX), performance, and maintainability.

### Identified Flaws

1. **Network-Blocking Route Transitions:**
   Every protected route in the Navigo router is guarded by `requireAuth()`. Currently, `requireAuth()` calls `authManager.checkAuth()`, which executes a network request (`GET /api/auth/me`). This means *every single page navigation* (e.g., clicking from Dashboard to Master Roll) pauses to wait for a server response before rendering the UI. This destroys the benefits of a Single Page Application (SPA).

2. **Ineffective Client State Caching:**
   The `AuthManager` has `this.currentUser` and `this.isAuthenticated` properties, but because `checkAuth()` forces a network call and overwrites these on every route change, the local state is underutilized.

3. **Lack of Global 401 Interception:**
   If a user leaves the application open, their session expires (both access and refresh tokens), and they click a button that triggers a background `fetch` (e.g., deleting a record), the backend will return a `401 Unauthorized`. Currently, `api.request()` in `utils/api.js` will simply throw an error. It does *not* automatically clear the user's state, stop the `refreshInterval`, or forcefully redirect them to `/login`.

4. **Decentralized Role-Based Access Control (RBAC):**
   Frontend RBAC is currently handled inside the individual page components after they load. For example, `superAdmin.js` loads, checks the role, and conditionally renders an "Access Denied" message. A robust SPA should intercept this at the router/middleware level, preventing the restricted component chunk from even being downloaded or executed if the user lacks permissions.

---

## 2. Comprehensive Refactoring Plan

To resolve these issues without taking shortcuts, we will implement a robust, modern SPA authentication flow.

### Phase 1: Optimize Route Guards (Eliminate Network Blocking)

**Goal:** Make page transitions instant by relying on cached client state, while trusting the global API interceptor (Phase 2) to catch actual session expirations.

1. **Update `AuthManager.js`:**
   - Introduce an `initialize()` method. This will be called *once* when the SPA first boots (in `app.js`). It will call `/api/auth/me` to establish initial state.
   - Modify `checkAuth()` to return the *cached* `this.isAuthenticated` synchronously. It should no longer make a network request.

2. **Update `authMiddleware.js`:**
   - Modify `requireAuth` and `guestOnly` to be synchronous, utilizing the cached `authManager.isLoggedIn()`.
   - Result: Navigating between pages will happen instantly based on local state.

### Phase 2: Implement Global API Interceptors

**Goal:** Ensure that any failed API call due to an expired session instantly logs the user out on the client side and redirects them to the login page.

1. **Update `utils/api.js` (`api.request`):**
   - Catch specific HTTP status codes, particularly `401`.
   - If a `401` is received, dispatch a custom global event (e.g., `window.dispatchEvent(new Event('session-expired'))`) OR call a tightly coupled logout function.

2. **Handle Session Expiry:**
   - When the `session-expired` event fires, `AuthManager` should automatically execute its cleanup logic (clear `currentUser`, set `isAuthenticated = false`, clear `refreshInterval`).
   - The router should forcefully navigate to `/login`.

### Phase 3: Centralize Frontend RBAC

**Goal:** Prevent unauthorized page components from executing by defining role requirements at the router definition level.

1. **Update `authMiddleware.js`:**
   - Create a new function: `requireRole(allowedRoles, router)`.
   - This guard will check `authManager.getUser().role` against the `allowedRoles` array.
   - If the user fails the check, route them to a dedicated `/unauthorized` page (or back to `/dashboard`).

2. **Update Router Definitions (`app.js`):**
   - Integrate the new `requireRole` check into the `navigate` helper.
   - Example:
     ```javascript
     const navigate = (loadFn, allowedRoles = null) => async (match) => {
       if (allowedRoles && !await requireRole(allowedRoles, router)) return;
       // ... existing load and render logic
     }

     router.on('/super-admin', navigate(loadSuperAdmin, ['super_admin']))
     ```

3. **Clean up Page Components:**
   - Remove the manual role checks from files like `superAdmin.js`, as the router will guarantee only authorized users can reach that code.

### Phase 4: Handle Initial App Load State (Hydration)

**Goal:** Prevent flickering or routing errors when a user hard-refreshes the page.

1. **Update `app.js` Entry Point:**
   - Before calling `router.resolve()`, show the global loading spinner.
   - Await `authManager.initialize()`. This determines exactly who the user is before any routes are evaluated.
   - Hide the spinner and allow `router.resolve()` to route them to their requested URL or kick them to `/login`.

---

## 3. Execution Strategy

This refactor touches the core routing and API utility layers of the application. It should be executed carefully in the following order:

1. **Commit 1:** Implement Phase 1 (AuthManager caching) and Phase 4 (App Initialization). This is the highest ROI fix for perceived performance.
2. **Commit 2:** Implement Phase 2 (Global 401 Interceptors) to ensure security and robust state cleanup aren't compromised by the caching.
3. **Commit 3:** Implement Phase 3 (Centralized RBAC) and clean up individual page components.

*Note: This document serves as a blueprint. Implementation of these code changes will be handled in subsequent development tasks.*