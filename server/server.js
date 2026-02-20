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



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security middleware - CSP/XSS protection
app.use(securityMiddleware);

// Serve static files from client directory
app.use(express.static(join(__dirname, '../client')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pages', pageRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/master-rolls', masterRollRoutes);
app.use('/api/wages',  wagesRoutes);
app.use('/api/settings',  settingsRoutes);
app.use('/api/inventory/sales', inventorySalesRoutes);

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
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('\nDemo Users:');
  console.log('1. Username: admin, Password: admin123');
  console.log('2. Username: user, Password: user123');
  console.log('3. Username: demo, Password: demo123');
});
