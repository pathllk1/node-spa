import mongoose from 'mongoose';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('❌ MONGODB_URI is not defined in environment variables');
}

// Connection options
const options = {
  autoIndex: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

let isConnected = false;

/**
 * Connect to MongoDB.
 * Safe to call multiple times — will reuse the existing connection.
 */
async function connectDB() {
  if (isConnected) {
    console.log('✅ Reusing existing MongoDB connection');
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(MONGODB_URI, options);
    isConnected = true;
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

/**
 * Disconnect from MongoDB.
 * Useful in seed scripts and tests.
 */
async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('🔌 MongoDB disconnected');
}

// Lifecycle event logging
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('🔄 MongoDB reconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

export { connectDB, disconnectDB };
export default mongoose;
