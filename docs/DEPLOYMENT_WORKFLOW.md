# Deployment Workflow - Step by Step

## Phase 1: Pre-Deployment (Day 1)

### 1.1 Code Review
- [ ] Review all recent changes
- [ ] Check for console.log/console.error statements
- [ ] Verify no hardcoded credentials
- [ ] Check for TODO/FIXME comments
- [ ] Run linter if available

### 1.2 Local Testing
```bash
# Install dependencies
npm install

# Start development server
npm start

# Test in browser
# - Navigate to http://localhost:3000
# - Test login with demo credentials
# - Test all main features
# - Check browser console for errors
```

### 1.3 Environment Setup
```bash
# Create .env.production for local testing
cp .env.example .env.production

# Update with production values:
# - TURSO_DATABASE_URL
# - TURSO_AUTH_TOKEN
# - Strong JWT secrets
# - RAPIDAPI_KEY
```

### 1.4 Database Verification
```bash
# Verify Turso database is accessible
# - Check Turso dashboard
# - Verify database URL is correct
# - Verify auth token is valid
# - Check database size and performance
```

---

## Phase 2: Deployment Preparation (Day 1-2)

### 2.1 Git Repository
```bash
# Ensure all changes are committed
git status

# Add all files
git add .

# Commit with descriptive message
git commit -m "Prepare for Vercel deployment - add configuration files"

# Push to remote
git push origin main
```

### 2.2 Vercel Account Setup
- [ ] Create Vercel account (if not already done)
- [ ] Verify email
- [ ] Connect GitHub/GitLab/Bitbucket account
- [ ] Create new project

### 2.3 Install Vercel CLI
```bash
# Install globally
npm install -g vercel

# Verify installation
vercel --version
```

---

## Phase 3: Initial Deployment (Day 2)

### 3.1 Login to Vercel
```bash
# Login to Vercel
vercel login

# Verify login
vercel whoami
```

### 3.2 Deploy to Production
```bash
# Deploy to production
vercel --prod

# This will:
# - Build the project
# - Deploy to Vercel
# - Provide deployment URL
# - Show deployment status
```

### 3.3 Note Deployment URL
```
Your deployment URL: https://your-app.vercel.app
```

---

## Phase 4: Environment Variables (Day 2)

### 4.1 Add Variables via CLI
```bash
# Add each environment variable
vercel env add TURSO_DATABASE_URL
# Paste: libsql://your-database.turso.io

vercel env add TURSO_AUTH_TOKEN
# Paste: your-auth-token

vercel env add ACCESS_TOKEN_SECRET
# Paste: your-strong-secret-key

vercel env add REFRESH_TOKEN_SECRET
# Paste: your-strong-secret-key

vercel env add JWT_SECRET
# Paste: your-strong-secret-key

vercel env add JWT_REFRESH_SECRET
# Paste: your-strong-secret-key

vercel env add RAPIDAPI_KEY
# Paste: your-api-key

vercel env add NODE_ENV
# Paste: production
```

### 4.2 Verify Variables
```bash
# List all environment variables
vercel env list
```

### 4.3 Redeploy with Variables
```bash
# Redeploy to apply environment variables
vercel --prod
```

---

## Phase 5: Post-Deployment Testing (Day 2-3)

### 5.1 Health Check
```bash
# Test health endpoint
curl https://your-app.vercel.app/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-02-21T...","environment":"production"}
```

### 5.2 API Testing
```bash
# Test login endpoint
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Test protected route
curl https://your-app.vercel.app/api/auth/me \
  -H "Cookie: accessToken=your-token"
```

### 5.3 Frontend Testing
- [ ] Open https://your-app.vercel.app in browser
- [ ] Verify page loads without errors
- [ ] Check browser console for errors
- [ ] Test login functionality
- [ ] Test navigation between pages
- [ ] Test on mobile devices
- [ ] Test on different browsers

### 5.4 Feature Testing
- [ ] Test authentication (login/logout)
- [ ] Test protected routes
- [ ] Test inventory features
- [ ] Test wages features
- [ ] Test master roll features
- [ ] Test ledger features
- [ ] Test PDF generation
- [ ] Test Excel export

### 5.5 Performance Testing
```bash
# Check deployment logs
vercel logs --prod

# Monitor performance
# - Check response times
# - Monitor error rates
# - Check database performance
```

---

## Phase 6: Monitoring Setup (Day 3)

### 6.1 Enable Vercel Analytics
1. Go to Vercel Dashboard → Project Settings → Analytics
2. Enable Web Analytics
3. Monitor Core Web Vitals

### 6.2 Set Up Error Tracking (Optional)
```bash
# Install Sentry (optional)
npm install @sentry/node

# Configure in server/server.js
# - Initialize Sentry
# - Set up error handler
# - Configure environment
```

### 6.3 Configure Monitoring Alerts
1. Go to Vercel Dashboard → Project Settings → Alerts
2. Set up alerts for:
   - Deployment failures
   - High error rates
   - Performance degradation

### 6.4 Set Up Log Monitoring
```bash
# View logs in real-time
vercel logs --prod --follow

# Filter logs
vercel logs --prod --since 1h
```

---

## Phase 7: Post-Deployment Maintenance (Ongoing)

### Daily Tasks
- [ ] Check error logs: `vercel logs --prod`
- [ ] Monitor database performance
- [ ] Verify backups are running
- [ ] Check for security alerts

### Weekly Tasks
- [ ] Review analytics
- [ ] Check performance metrics
- [ ] Review error patterns
- [ ] Test critical workflows

### Monthly Tasks
- [ ] Rotate JWT secrets
- [ ] Update dependencies: `npm update`
- [ ] Review security updates
- [ ] Optimize database queries
- [ ] Test disaster recovery

### Quarterly Tasks
- [ ] Security audit
- [ ] Performance optimization
- [ ] Capacity planning
- [ ] Backup verification

---

## Troubleshooting During Deployment

### Issue: Deployment Fails
```bash
# Check build logs
vercel logs --prod

# Common causes:
# - Missing dependencies
# - Syntax errors
# - Environment variables not set
# - Database connection issues

# Solution:
# 1. Fix the issue locally
# 2. Commit and push
# 3. Redeploy: vercel --prod
```

### Issue: Application Crashes After Deployment
```bash
# Check server logs
vercel logs --prod

# Common causes:
# - Missing environment variables
# - Database connection failed
# - Unhandled errors in code

# Solution:
# 1. Verify environment variables
# 2. Check database connection
# 3. Review error logs
# 4. Rollback if necessary: vercel rollback --prod
```

### Issue: Static Files Not Loading
```bash
# Check file paths
# - Verify files exist in /client/public
# - Check vercel.json routes
# - Verify express.static path

# Solution:
# 1. Verify file locations
# 2. Check configuration
# 3. Redeploy: vercel --prod
```

### Issue: Database Connection Fails
```bash
# Verify environment variables
vercel env list

# Check Turso dashboard
# - Verify database is running
# - Check connection limits
# - Review query performance

# Solution:
# 1. Verify credentials
# 2. Check database status
# 3. Restart database if needed
# 4. Redeploy: vercel --prod
```

---

## Rollback Procedure

If critical issues occur:

### Step 1: Identify Previous Deployment
```bash
# List deployments
vercel list --prod

# Find the last stable deployment
```

### Step 2: Rollback
```bash
# Rollback to previous deployment
vercel rollback --prod

# Or promote specific deployment
vercel promote <deployment-url>
```

### Step 3: Verify Rollback
```bash
# Check current deployment
vercel list --prod

# Test application
curl https://your-app.vercel.app/api/health
```

### Step 4: Fix Issues
```bash
# Fix the issue locally
# Test thoroughly
# Commit and push
# Redeploy: vercel --prod
```

---

## Deployment Checklist

### Before Deployment
- [ ] All code committed and pushed
- [ ] No console errors locally
- [ ] All tests passing
- [ ] Environment variables prepared
- [ ] Database verified
- [ ] Security review completed

### During Deployment
- [ ] Deployment completes successfully
- [ ] Environment variables added
- [ ] Redeployment completes successfully
- [ ] No build errors

### After Deployment
- [ ] Health check passes
- [ ] API endpoints working
- [ ] Frontend loads correctly
- [ ] Authentication works
- [ ] Database operations work
- [ ] Static files load
- [ ] HTTPS working
- [ ] Monitoring configured
- [ ] Logs reviewed
- [ ] Team notified

---

## Communication Template

### Pre-Deployment Notification
```
Subject: Deployment Scheduled - [App Name]

We are planning to deploy [App Name] to production on [Date] at [Time].

Expected downtime: None (zero-downtime deployment)
Changes: [List major changes]
Rollback plan: Available if needed

Please report any issues to [Contact].
```

### Post-Deployment Notification
```
Subject: Deployment Complete - [App Name]

[App Name] has been successfully deployed to production.

Deployment URL: https://your-app.vercel.app
Deployment Time: [Time]
Changes: [List major changes]

Please test and report any issues.
```

### Incident Notification
```
Subject: URGENT - Deployment Issue - [App Name]

We have identified an issue with the current deployment.

Issue: [Description]
Status: [Investigating/Fixing/Resolved]
ETA: [Time]
Workaround: [If available]

We apologize for any inconvenience.
```

---

## Success Metrics

### Deployment Success
- ✅ Deployment completes without errors
- ✅ All environment variables set correctly
- ✅ Application loads and responds
- ✅ Database connectivity verified
- ✅ Authentication working
- ✅ No critical errors in logs

### Post-Deployment Success
- ✅ All features working as expected
- ✅ Performance acceptable (< 3s page load)
- ✅ Error rate < 0.1%
- ✅ Uptime > 99.9%
- ✅ User feedback positive
- ✅ Monitoring configured

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Pre-Deployment | 1 day | Preparation |
| Deployment Preparation | 1 day | Setup |
| Initial Deployment | 30 min | Execution |
| Environment Variables | 15 min | Configuration |
| Post-Deployment Testing | 1 day | Verification |
| Monitoring Setup | 2 hours | Configuration |
| Maintenance | Ongoing | Operations |

**Total Time to Production: 2-3 days**

---

## Contact & Support

- **Vercel Support**: https://vercel.com/support
- **Turso Support**: https://turso.tech/support
- **GitHub Issues**: [Your Repository]
- **Internal Contact**: [Your Team Lead]

---

## Sign-Off

- [ ] Deployment completed successfully
- [ ] All tests passed
- [ ] Monitoring configured
- [ ] Team notified
- [ ] Documentation updated

**Deployment Date**: _______________
**Deployed By**: _______________
**Verified By**: _______________
**Approved By**: _______________

---

Good luck with your deployment! 🚀
