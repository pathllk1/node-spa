# Vercel Deployment Checklist

## Pre-Deployment Verification

### Code Quality
- [ ] All console.error/console.log statements are appropriate for production
- [ ] No hardcoded credentials in code (all in environment variables)
- [ ] No TODO or FIXME comments in critical paths
- [ ] All imports are correct and modules exist
- [ ] No circular dependencies

### Security
- [ ] JWT secrets are strong (32+ characters, random)
- [ ] Different secrets for development and production
- [ ] HTTPS is enforced in production
- [ ] Cookies have httpOnly and secure flags
- [ ] CORS is properly configured
- [ ] CSP headers are set correctly
- [ ] No sensitive data in error messages
- [ ] Database credentials are in environment variables only

### Database
- [ ] Turso database is created and accessible
- [ ] Database URL is correct
- [ ] Auth token is valid and not expired
- [ ] All tables are created (automatic on first run)
- [ ] Database backups are configured
- [ ] Connection pooling is optimized

### Frontend
- [ ] All static assets are in `/client/public`
- [ ] CSS is compiled and minified
- [ ] No broken image or asset links
- [ ] Responsive design works on mobile
- [ ] All pages load without errors
- [ ] API endpoints are correct for production

### API Endpoints
- [ ] All routes are tested and working
- [ ] Error handling is comprehensive
- [ ] Rate limiting is configured (if needed)
- [ ] Pagination is implemented for large datasets
- [ ] Timeout values are appropriate

### Performance
- [ ] Database queries are optimized
- [ ] Indexes are created on frequently queried columns
- [ ] Lazy loading is implemented for pages
- [ ] Static assets are cached appropriately
- [ ] No N+1 query problems
- [ ] Response times are acceptable

### Monitoring & Logging
- [ ] Error logging is configured
- [ ] Request logging is appropriate
- [ ] No sensitive data in logs
- [ ] Log levels are set correctly for production
- [ ] Monitoring alerts are configured

## Deployment Steps

### Step 1: Repository Setup
- [ ] Code is committed to Git
- [ ] Repository is pushed to GitHub/GitLab/Bitbucket
- [ ] `.env` file is in `.gitignore`
- [ ] `.vercelignore` is configured
- [ ] `vercel.json` is configured

### Step 2: Environment Variables
- [ ] Create `.env.production` locally for testing
- [ ] Verify all required variables are set:
  - [ ] `TURSO_DATABASE_URL`
  - [ ] `TURSO_AUTH_TOKEN`
  - [ ] `ACCESS_TOKEN_SECRET`
  - [ ] `REFRESH_TOKEN_SECRET`
  - [ ] `JWT_SECRET`
  - [ ] `JWT_REFRESH_SECRET`
  - [ ] `RAPIDAPI_KEY`
  - [ ] `NODE_ENV=production`

### Step 3: Local Testing
- [ ] Run `npm install` successfully
- [ ] Run `npm start` and verify server starts
- [ ] Test API endpoints locally
- [ ] Test authentication flow
- [ ] Test database connectivity
- [ ] Test static file serving

### Step 4: Vercel Deployment
- [ ] Install Vercel CLI: `npm install -g vercel`
- [ ] Login to Vercel: `vercel login`
- [ ] Deploy: `vercel --prod`
- [ ] Add environment variables in Vercel dashboard
- [ ] Verify deployment is successful

### Step 5: Post-Deployment Testing
- [ ] Check deployment status in Vercel dashboard
- [ ] Test health endpoint: `GET /api/health`
- [ ] Test login endpoint: `POST /api/auth/login`
- [ ] Test protected routes
- [ ] Test static file serving
- [ ] Check browser console for errors
- [ ] Test on mobile devices
- [ ] Verify HTTPS is working
- [ ] Check cookies are being set correctly

### Step 6: Monitoring Setup
- [ ] Enable Vercel Analytics
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure deployment notifications
- [ ] Set up database monitoring
- [ ] Configure log aggregation

## Common Issues & Solutions

### Issue: "Cannot find module" errors
**Solution**: 
```bash
npm install
npm list
vercel logs --prod
```

### Issue: Database connection fails
**Solution**:
- Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel dashboard
- Check Turso dashboard for database status
- Verify network connectivity

### Issue: Static files return 404
**Solution**:
- Verify files exist in `/client/public`
- Check `vercel.json` routes configuration
- Verify `express.static` path is correct

### Issue: CORS errors
**Solution**:
- Check security middleware configuration
- Verify allowed origins
- Test with curl to isolate frontend vs backend issue

### Issue: Cookies not persisting
**Solution**:
- Verify `secure: true` for HTTPS
- Check `sameSite` setting
- Verify domain configuration
- Test in incognito mode

### Issue: 502 Bad Gateway
**Solution**:
- Check server logs: `vercel logs --prod`
- Verify database connection
- Check for unhandled errors
- Increase function timeout in `vercel.json`

## Rollback Procedure

If deployment has critical issues:

```bash
# View deployment history
vercel list --prod

# Rollback to previous deployment
vercel rollback --prod

# Or promote specific deployment
vercel promote <deployment-url>
```

## Post-Deployment Maintenance

### Daily
- [ ] Monitor error logs
- [ ] Check database performance
- [ ] Verify backups are running

### Weekly
- [ ] Review analytics
- [ ] Check for security updates
- [ ] Test critical workflows

### Monthly
- [ ] Rotate secrets
- [ ] Review and optimize database queries
- [ ] Update dependencies
- [ ] Test disaster recovery

## Performance Targets

- [ ] API response time: < 200ms
- [ ] Page load time: < 3s
- [ ] Database query time: < 100ms
- [ ] Error rate: < 0.1%
- [ ] Uptime: > 99.9%

## Security Checklist

- [ ] All secrets are strong and unique
- [ ] HTTPS is enforced
- [ ] CORS is properly configured
- [ ] CSP headers are set
- [ ] XSS protection is enabled
- [ ] CSRF protection is enabled
- [ ] Rate limiting is configured
- [ ] Input validation is implemented
- [ ] SQL injection is prevented (using prepared statements)
- [ ] Authentication is secure (JWT with refresh tokens)
- [ ] Authorization is properly enforced
- [ ] Sensitive data is not logged
- [ ] Error messages don't leak information

## Sign-Off

- [ ] All checklist items completed
- [ ] Testing passed
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Monitoring configured
- [ ] Team notified
- [ ] Documentation updated

**Deployment Date**: _______________
**Deployed By**: _______________
**Verified By**: _______________
