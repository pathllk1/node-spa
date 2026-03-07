# 403 Forbidden - Super Admin Password Update Debugging Guide

## Summary
You're getting HTTP 403 when trying to update passwords in the superAdmin panel. I've added detailed debugging to help identify the issue.

## What I've Done

### 1. Added Enhanced Logging to Authentication Middleware
The admin routes use two authentication systems that need to work together:
- **authMiddleware.js** - The authentication middleware (used by admin routes)
- **auth.js** - The role checking middleware (used by admin routes)

I've added comprehensive logging to both:
- Shows if tokens exist in cookies
- Logs decoded user role from JWT token
- Logs when req.user is set
- Shows exactly what role requireRole() sees before rejecting

### 2. Verified Database
✅ **Superadmin user exists with correct role:**
- Username: superadmin
- Role: super_admin (correct with underscore)
- Status: approved
- Email: superadmin@system.com

## How to Debug

### Step 1: Start the Server
```bash
npm start
```

Watch the server console output for the debug logs.

### Step 2: Reproduce the Error
1. Open browser console (F12)
2. Log in as superadmin (superadmin / superadmin123)
3. Navigate to Super Admin panel
4. Go to "User Password Management" tab
5. Try to update a user's password
6. You should see a 403 error

### Step 3: Check Server Console
Look for these log patterns:

```
[authMiddleware DEBUG] {
  accessTokenExists: true,
  refreshTokenExists: true,
  path: '/api/admin/super-admin/users/update-password',
  method: 'POST'
}

[authMiddleware] Access token valid, decoded user: {
  id: '...',
  username: 'superadmin',
  role: 'super_admin'   ← This should NOT be undefined
}

[authMiddleware] Setting req.user, now req.user.role is: super_admin

[requireRole DEBUG] {
  hasReqUser: true,
  userObj: { id: '...', username: 'superadmin', role: 'super_admin' },
  requiredRoles: [ 'super_admin' ],
  roleMatch: true
}
```

## Possible Issues

### Issue 1: Missing Cookies
If you see:
```
[authMiddleware DEBUG] { accessTokenExists: false, refreshTokenExists: false ... }
```
**Solution:** Check browser Network tab - ensure request includes cookies
- Look for "Cookie" header in request
- Check if credentials are being sent

### Issue 2: Role Missing from Token
If you see:
```
[authMiddleware] Access token valid, decoded user: {
  id: '...',
  username: 'superadmin',
  role: undefined   ← PROBLEM!
}
```
**Solution:** Token was generated without role field
- Check login process is working correctly
- Re-login and try again
- Clear browser cookies and login fresh

### Issue 3: Role Has Wrong Value
If you see:
```
⚠️ [requireRole] Role mismatch! User role="superadmin" not in required=['super_admin']
```
**Solution:** Role is stored as 'superadmin' instead of 'super_admin'
- Check if database has incorrect role values
- This would need database repair

### Issue 4: Middleware Not Being Called
If you don't see any [authMiddleware] or [requireRole] logs:
- Check that admin routes are properly mounted
- Verify request is actually going to the right endpoint
- Check browser Network tab for actual URL being called

## What to Share With Me

When you reproduce the error, please share:

1. **Full server console output** when you make the password update attempt
   - Copy-paste the entire section from the API request through the response

2. **Browser Network tab** details:
   - Request URL
   - Request method (POST)
   - Request headers (is Authorization/Cookie being sent?)
   - Response status (should see 403)
   - Response body

3. **Browser Console** any error messages

## Files Changed
- `/server/middleware/mongo/authMiddleware.js` - Added detailed logging
- `/server/middleware/mongo/auth.js` - Added detailed logging to requireRole
- `/server/utils/mongo/verify-superadmin-role.js` - Created verification script

## Manual Verification
Check database role:
```bash
node server/utils/mongo/verify-superadmin-role.js
```

Should show:
```
✅ Role is CORRECT: "super_admin"
✅ Status is approved
```
