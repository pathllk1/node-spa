// config/turso.js
// Turso database client configuration

const { createClient } = require('@libsql/client');
require('dotenv').config();

// Initialize Turso client
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://your-database-name.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log('Connected to Turso database');

// Export the client instance
module.exports = turso;