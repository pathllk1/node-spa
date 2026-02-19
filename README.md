# Node.js SPA with Dual Token Authentication

A secure Single Page Application (SPA) built with Node.js, Express, and Navigo.js featuring dual-token JWT authentication with automatic token refresh.

## Features

### Security
- **Dual Token System**: Access tokens (15 min) and Refresh tokens (30 days)
- **Automatic Token Refresh**: Seamless token refresh every 10 minutes
- **HTTP-only Cookies**: Tokens stored securely, immune to XSS
- **SameSite Protection**: CSRF protection via SameSite cookie attribute
- **Content Security Policy (CSP)**: Strict CSP headers for XSS protection
- **XSS Protection**: Multiple layers of XSS defense

### Authentication Flow
1. User logs in → receives both access and refresh tokens
2. Access token expires after 15 minutes
3. Middleware checks refresh token when access expires
4. New access token automatically generated and sent
5. Background refresh every 10 minutes keeps user logged in
6. User never interrupted during active sessions

### Architecture

#### Server Structure
```
server/
├── controllers/
│   ├── authController.js    # Authentication logic
│   └── pageController.js    # Page data endpoints
├── routes/
│   ├── authRoutes.js        # Auth routes
│   └── pageRoutes.js        # API routes
├── middleware/
│   ├── authMiddleware.js    # Token validation & refresh
│   └── securityMiddleware.js # CSP/XSS headers
├── utils/
│   ├── users.json           # Demo users database
│   └── tokenUtils.js        # JWT utilities
└── server.js                # Main server file
```

#### Client Structure
```
client/
├── public/
│   ├── cdns/
│   │   └── navigo.min.js    # Local Navigo.js
│   └── css/
│       └── style.css         # Styles
├── pages/
│   ├── home.js              # Public home page
│   ├── about.js             # Public about page
│   ├── login.js             # Login page
│   ├── dashboard.js         # Protected dashboard
│   └── profile.js           # Protected profile
├── components/
│   ├── navbar.js            # Navigation component
│   └── layout.js            # Layout wrapper
├── utils/
│   ├── api.js               # HTTP client
│   └── auth.js              # Auth manager
├── middleware/
│   └── authMiddleware.js    # Client-side route guards
├── index.html               # Main HTML file
└── app.js                   # Router setup
```

## Installation

1. Navigate to the project directory:
```bash
cd nodejs-spa-auth
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser to:
```
http://localhost:3000
```

## Demo Credentials

| Username | Password  | Role  |
|----------|-----------|-------|
| admin    | admin123  | admin |
| user     | user123   | user  |
| demo     | demo123   | user  |

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and receive tokens
- `POST /api/auth/logout` - Logout and clear tokens
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/refresh` - Manually refresh token (protected)

### Pages
- `GET /api/pages/public` - Public data
- `GET /api/pages/protected` - Protected data (auth required)
- `GET /api/pages/dashboard` - Dashboard data (auth required)
- `GET /api/pages/profile` - Profile data (auth required)

## Token Refresh Logic

The middleware implements the following logic:

1. **Both tokens valid** → Request proceeds
2. **Access expired, refresh valid** → Generate new access token, update cookie, proceed
3. **Refresh invalid** → Clear both tokens, return 401

This ensures:
- Users stay logged in during active sessions
- Expired sessions require re-login
- Minimal interruption to user experience

## Security Headers

The application sets the following security headers:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## Technologies

- **Backend**: Node.js, Express
- **Authentication**: JWT (jsonwebtoken)
- **Frontend Router**: Navigo.js
- **Security**: HTTP-only cookies, CSP headers
- **Architecture**: SPA with ES6 modules

## Testing the Auto-Refresh

1. Login to the application
2. Open browser DevTools → Network tab
3. Wait 10+ minutes while staying on a protected page
4. Watch for automatic `/api/auth/refresh` calls
5. Notice you remain logged in without interruption

## Production Considerations

For production deployment:

1. Change JWT secrets in `server/utils/tokenUtils.js`
2. Enable HTTPS and uncomment HSTS header
3. Set `NODE_ENV=production`
4. Use a real database instead of JSON file
5. Add rate limiting
6. Implement proper logging
7. Add input validation and sanitization
8. Consider adding 2FA

## License

MIT
