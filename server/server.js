import express from 'express';
import cookieParser from 'cookie-parser';
import 'dotenv/config.js';

// Initialize database with error handling
(async () => {
  try {
    const { connectDB } = await import('./utils/mongo/mongoose.config.js');
    await connectDB();
  } catch (err) {
    console.error('⚠️  Database initialization failed:', err.message);
    console.log('ℹ️  Server will continue running, but database operations may fail');
  }
})();

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { securityMiddleware } from './middleware/mongo/securityMiddleware.js';
import sanitizer from './middleware/sanitizer.js';
import { csrfGenerateToken, csrfValidateToken } from './middleware/csrfMiddleware.js';
import authRoutes from './routes/mongo/authRoutes.js';
import sessionRoutes from './routes/mongo/sessionRoutes.js';
import pageRoutes from './routes/mongo/pageRoutes.js';

import masterRollRoutes from './routes/mongo/masterRoll.routes.js';
import wagesRoutes from './routes/mongo/wages.routes.js';
import settingsRoutes from './routes/mongo/settings.routes.js';
import inventorySalesRoutes from './routes/mongo/inventory/sls.js';
import ledgerRoutes from './routes/mongo/ledger.routes.js';
import adminRoutes from './routes/mongo/admin.js';

import { cleanupExpiredTokens } from './utils/mongo/tokenRevocationUtils.js';
import { cleanupRateLimitEntries } from './middleware/mongo/rateLimitMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app          = express();
const PORT         = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const isVercel     = process.env.VERCEL === '1';

// ── FIX: Trust first proxy (Nginx, Vercel edge, load balancer) ────────────
// Without this, req.ip returns the proxy's IP instead of the real client IP.
// The rate limiter, audit logs, and IP extraction all depend on req.ip being correct.
// With trust proxy = 1, Express safely reads the first X-Forwarded-For value
// from the trusted upstream proxy — clients cannot spoof this.
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sanitizer);

// Security headers (CSP, XSS, HSTS in prod, etc.)
app.use(securityMiddleware);

// CSRF: generate token on GET, validate on state-changing requests
app.use(csrfGenerateToken);
app.use(csrfValidateToken);

// Static files
app.use(express.static(join(__dirname, '../client'), {
  maxAge: isProduction ? '1d' : 0,
  etag:   false,
}));

// API Routes
app.use('/api/auth',             authRoutes);
app.use('/api/sessions',         sessionRoutes);
app.use('/api/pages',            pageRoutes);
app.use('/api/master-rolls',     masterRollRoutes);
app.use('/api/wages',            wagesRoutes);
app.use('/api/settings',         settingsRoutes);
app.use('/api/inventory/sales',  inventorySalesRoutes);
app.use('/api/ledger',           ledgerRoutes);
app.use('/api/admin',            adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status:      'ok',
    timestamp:   new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
  });
});

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(__dirname, '../client/index.html'));
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('[ERROR_HANDLER]', err.message);
  console.error('[ERROR_HANDLER] Stack:', err.stack);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Something went wrong!',
      error:   isProduction ? undefined : err.message,
    });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED_REJECTION]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT_EXCEPTION]', error);
});

if (!isVercel) {
  // Token and blacklist cleanup every hour
  setInterval(async () => {
    try {
      await cleanupExpiredTokens();
    } catch (error) {
      console.error('❌ Token cleanup job failed:', error.message);
    }
  }, 60 * 60 * 1000);

  // Rate limit cleanup every 30 minutes
  // Note: now a no-op since MongoDB TTL handles it, but kept for compatibility
  setInterval(() => {
    try {
      cleanupRateLimitEntries();
    } catch (error) {
      console.error('❌ Rate limit cleanup job failed:', error.message);
    }
  }, 30 * 60 * 1000);

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('🔐 Security jobs initialized: token cleanup, rate limit maintenance');
    console.log(`🔒 Trust proxy: enabled (req.ip = real client IP)`);
  });
}

export default app;
