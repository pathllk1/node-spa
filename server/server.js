import express from 'express';
import cookieParser from 'cookie-parser';
import 'dotenv/config.js'; // Load environment variables from .env file

// Initialize database with error handling - use dynamic import
(async () => {
  try {
    await import('./utils/db.js'); // Initialize the database and create tables
  } catch (err) {
    console.error('⚠️  Database initialization failed:', err.message);
    console.log('ℹ️  Server will continue running, but database operations may fail');
    console.log('ℹ️  Please check your Turso connection and try again');
  }
})();

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { securityMiddleware } from './middleware/securityMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import pageRoutes from './routes/pageRoutes.js';
import adminRoutes from './routes/admin.js';
import masterRollRoutes from './routes/masterRoll.routes.js';
import wagesRoutes from './routes/wages.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import inventorySalesRoutes from './routes/inventory/sls.js';
import ledgerRoutes from './routes/ledger.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security middleware - CSP/XSS protection
app.use(securityMiddleware);

// Serve static files from client directory
app.use(express.static(join(__dirname, '../client'), {
  maxAge: isProduction ? '1d' : 0,
  etag: false
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pages', pageRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/master-rolls', masterRollRoutes);
app.use('/api/wages',  wagesRoutes);
app.use('/api/settings',  settingsRoutes);
app.use('/api/inventory/sales', inventorySalesRoutes);
app.use('/api/ledger', ledgerRoutes);

// Health check endpoint for Vercel
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development'
  });
});

// Serve index.html for all non-API routes (SPA)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(__dirname, '../client/index.html'));
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR_HANDLER] Error occurred:', err.message);
  console.error('[ERROR_HANDLER] Stack:', err.stack);
  
  // Ensure we always send a response
  if (!res.headersSent) {
    res.status(err.status || 500).json({ 
      success: false, 
      message: err.message || 'Something went wrong!',
      error: isProduction ? undefined : err.message
    });
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED_REJECTION] Promise:', promise);
  console.error('[UNHANDLED_REJECTION] Reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT_EXCEPTION] Error:', error);
  console.error('[UNCAUGHT_EXCEPTION] Stack:', error.stack);
});

// Only listen if not running on Vercel (Vercel handles the server)
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
