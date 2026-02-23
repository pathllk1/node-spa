# Vercel Deployment Guide

## Overview

This guide provides step-by-step instructions to deploy your Node.js SPA Business Management Application to Vercel.

## Prerequisites

1. **Vercel Account**: Create a free account at [vercel.com](https://vercel.com)
2. **Git Repository**: Your code must be in a Git repository (GitHub, GitLab, or Bitbucket)
3. **Environment Variables**: Turso database credentials and JWT secrets
4. **Node.js**: v18+ (Vercel uses Node.js 20.x by default)

## Step 1: Prepare Your Repository

### 1.1 Ensure Git is Initialized
```bash
git init
git add .
git commit -m "Initial commit - ready for Vercel deployment"
```

### 1.2 Push to GitHub (or GitLab/Bitbucket)
```bash
git remote add origin https://github.com/your-username/your-repo.git
git branch -M main
git push -u origin main
```

## Step 2: Configure Environment Variables

### 2.1 Create `.env.production` (for local testing)
```env
NODE_ENV=production
PORT=3000

# Database (Turso)
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# JWT Secrets (use strong, unique values in production)
ACCESS_TOKEN_SECRET=your-strong-access-token-secret-key-here
REFRESH_TOKEN_SECRET=your-strong-refresh-token-secret-key-here
JWT_SECRET=your-strong-jwt-secret-key-here
JWT_REFRESH_SECRET=your-strong-jwt-refresh-secret-key-here

# External APIs
RAPIDAPI_KEY=your-rapidapi-key-for-ifsc-lookup
```

### 2.2 Important Security Notes
- **NEVER commit `.env` files** to Git
- Use strong, unique secrets (minimum 32 characters)
- Rotate secrets regularly
- Use different secrets for development and production
- Store secrets securely in Vercel dashboard

## Step 3: Deploy to Vercel

### Option A: Using Vercel CLI (Recommended)

#### 3A.1 Install Vercel CLI
```bash
npm install -g vercel
```

#### 3A.2 Login to Vercel
```bash
vercel login
```

#### 3A.3 Deploy
```bash
vercel --prod
```

#### 3A.4 Add Environment Variables
During deployment, Vercel will prompt you to add environment variables. Alternatively, add them after deployment:

```bash
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
vercel env add ACCESS_TOKEN_SECRET
vercel env add REFRESH_TOKEN_SECRET
vercel env add JWT_SECRET
vercel env add JWT_REFRESH_SECRET
vercel env add RAPIDAPI_KEY
```

### Option B: Using Vercel Dashboard

#### 3B.1 Connect Repository
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Select your Git repository
4. Click "Import"

#### 3B.2 Configure Project
1. **Framework Preset**: Select "Other" (or "Node.js")
2. **Root Directory**: Leave as default (or set to `.`)
3. **Build Command**: Leave empty (uses `npm install` by default)
4. **Output Directory**: Leave empty
5. **Install Command**: `npm install`

#### 3B.3 Add Environment Variables
1. Click "Environment Variables"
2. Add each variable:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `ACCESS_TOKEN_SECRET`
   - `REFRESH_TOKEN_SECRET`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `RAPIDAPI_KEY`
3. Click "Deploy"

## Step 4: Verify Deployment

### 4.1 Check Deployment Status
```bash
vercel --prod
```

### 4.2 Test API Endpoints
```bash
# Test health check
curl https://your-app.vercel.app/api/auth/me

# Test login
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

### 4.3 Check Logs
```bash
vercel logs --prod
```

## Step 5: Configure Custom Domain (Optional)

### 5.1 Add Domain
1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Enter your custom domain
3. Follow DNS configuration instructions

### 5.2 Update DNS Records
Add the DNS records provided by Vercel to your domain registrar.

## Step 6: Set Up Continuous Deployment

### 6.1 Automatic Deployments
Vercel automatically deploys when you push to your Git repository:
- Push to `main` branch → Production deployment
- Push to other branches → Preview deployment

### 6.2 Deployment Previews
Every pull request gets a unique preview URL for testing.

## Troubleshooting

### Issue: "Cannot find module" errors

**Solution**: Ensure all dependencies are in `package.json`:
```bash
npm install --save missing-package
git add package.json package-lock.json
git commit -m "Add missing dependency"
git push
```

### Issue: Database connection fails

**Solution**: Verify environment variables:
```bash
vercel env list
```

Ensure `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set correctly.

### Issue: Static files not loading

**Solution**: Verify static file paths in `server/server.js`:
```javascript
app.use(express.static(join(__dirname, '../client')));
```

### Issue: CORS errors

**Solution**: Check security middleware in `server/middleware/securityMiddleware.js`. Ensure CORS is properly configured for your domain.

### Issue: Cookies not working

**Solution**: Ensure cookies are configured for production:
```javascript
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: true,  // HTTPS only
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000
});
```

### Issue: 502 Bad Gateway

**Solution**: 
1. Check server logs: `vercel logs --prod`
2. Verify database connection
3. Check for unhandled errors in server code
4. Increase function timeout in `vercel.json` if needed

## Performance Optimization

### 1. Enable Gzip Compression
Vercel automatically enables gzip compression.

### 2. Optimize Database Queries
- Add indexes to frequently queried columns
- Use prepared statements (already implemented)
- Implement query caching where appropriate

### 3. Optimize Frontend
- Lazy load page components (already implemented)
- Minify CSS and JavaScript
- Use CDN for static assets

### 4. Monitor Performance
Use Vercel Analytics:
1. Go to Project Settings → Analytics
2. Enable Web Analytics
3. Monitor Core Web Vitals

## Security Best Practices

### 1. Rotate Secrets Regularly
```bash
# Generate new secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update in Vercel dashboard
vercel env add NEW_SECRET_NAME
```

### 2. Enable HTTPS
Vercel automatically provides HTTPS with SSL certificates.

### 3. Set Security Headers
Already configured in `server/middleware/securityMiddleware.js`:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

### 4. Monitor Deployments
- Enable deployment notifications
- Review deployment logs regularly
- Set up error tracking (e.g., Sentry)

## Scaling Considerations

### 1. Database Scaling
- Turso automatically scales
- Monitor query performance
- Add indexes as needed

### 2. Function Scaling
- Vercel automatically scales serverless functions
- Monitor function duration and memory usage
- Optimize long-running operations

### 3. Static Asset Caching
- Vercel CDN caches static assets globally
- Configure cache headers in `vercel.json`

## Rollback Procedure

### 1. Rollback to Previous Deployment
```bash
vercel rollback --prod
```

### 2. Rollback to Specific Deployment
```bash
vercel list --prod
vercel promote <deployment-url>
```

## Monitoring and Maintenance

### 1. Set Up Error Tracking
Consider integrating Sentry or similar service:
```bash
npm install @sentry/node
```

### 2. Monitor Database Performance
- Check Turso dashboard for query performance
- Monitor connection pool usage
- Review slow query logs

### 3. Regular Backups
- Turso provides automatic backups
- Export data regularly for safety
- Test restore procedures

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Node.js Runtime](https://vercel.com/docs/functions/runtimes/node-js)
- [Turso Documentation](https://docs.turso.tech)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)

## Support

For issues or questions:
1. Check Vercel logs: `vercel logs --prod`
2. Review Turso dashboard for database issues
3. Check GitHub issues in your repository
4. Contact Vercel support: [vercel.com/support](https://vercel.com/support)
