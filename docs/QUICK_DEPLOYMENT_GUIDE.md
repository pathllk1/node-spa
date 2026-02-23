# Quick Deployment Guide - Vercel

## 5-Minute Setup

### Prerequisites
- Vercel account (free at vercel.com)
- Git repository (GitHub, GitLab, or Bitbucket)
- Node.js v18+

### Step 1: Install Vercel CLI (2 min)
```bash
npm install -g vercel
```

### Step 2: Login to Vercel (1 min)
```bash
vercel login
```

### Step 3: Deploy (1 min)
```bash
vercel --prod
```

### Step 4: Add Environment Variables (1 min)

In Vercel Dashboard → Project Settings → Environment Variables, add:

```
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
ACCESS_TOKEN_SECRET=your-strong-secret-key
REFRESH_TOKEN_SECRET=your-strong-secret-key
JWT_SECRET=your-strong-secret-key
JWT_REFRESH_SECRET=your-strong-secret-key
RAPIDAPI_KEY=your-api-key
NODE_ENV=production
```

### Step 5: Redeploy (1 min)
```bash
vercel --prod
```

---

## Verify Deployment

```bash
# Check deployment status
vercel list --prod

# View logs
vercel logs --prod

# Test health endpoint
curl https://your-app.vercel.app/api/health
```

---

## Common Issues

### "Cannot find module" error
```bash
npm install
git add package-lock.json
git commit -m "Update dependencies"
git push
vercel --prod
```

### Database connection fails
- Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel dashboard
- Check Turso dashboard for database status

### Static files return 404
- Verify files exist in `/client/public`
- Check `vercel.json` routes configuration

### Cookies not working
- Ensure `secure: true` for HTTPS
- Check `sameSite` setting in auth middleware

---

## Rollback

```bash
# View deployment history
vercel list --prod

# Rollback to previous
vercel rollback --prod
```

---

## Next Steps

1. Read `VERCEL_DEPLOYMENT_GUIDE.md` for detailed instructions
2. Complete `DEPLOYMENT_CHECKLIST.md` before deployment
3. Review `VERCEL_READINESS_ANALYSIS.md` for recommendations
4. Monitor application after deployment

---

## Support

- Vercel Logs: `vercel logs --prod`
- Vercel Dashboard: https://vercel.com/dashboard
- Documentation: https://vercel.com/docs
