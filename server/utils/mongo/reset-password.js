/**
 * Reset User Password
 * Usage: node server/utils/mongo/reset-password.js username newPassword
 * 
 * Example:
 *   node server/utils/mongo/reset-password.js anjan newPasswordHere
 */

import 'dotenv/config.js';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { connectDB } from './mongoose.config.js';
import { User } from '../../models/index.js';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

async function resetPassword() {
  const [, , username, newPassword] = process.argv;

  if (!username || !newPassword) {
    console.log('❌ Missing arguments');
    console.log('');
    console.log('Usage: node reset-password.js <username> <newPassword>');
    console.log('');
    console.log('Examples:');
    console.log('  node reset-password.js admin newSecurePassword123');
    console.log('  node reset-password.js anjan myNewPassword456');
    console.log('');
    process.exit(1);
  }

  try {
    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB');

    // Find user
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });

    if (!user) {
      console.log(`❌ User not found: ${username}`);
      process.exit(1);
    }

    console.log(`✓ Found user: ${user.username} (${user.email})`);
    console.log('');

    // Hash new password
    console.log('Hashing password with bcrypt (12 rounds)...');
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password
    user.password = hashedPassword;
    await user.save();

    console.log('');
    console.log('✅ Password Reset Successfully!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Username:     ${user.username}`);
    console.log(`Email:        ${user.email}`);
    console.log(`Full Name:    ${user.fullname}`);
    console.log(`Role:         ${user.role}`);
    console.log(`Status:       ${user.status}`);
    console.log(`New Password: ${newPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('✓ Password has been hashed with bcrypt (12 rounds)');
    console.log('✓ Only the hash is stored in the database');
    console.log('✓ User can now login with new password');
    console.log('');
    console.log('Test login:');
    console.log(`  curl -X POST http://localhost:3000/api/auth/login \\`);
    console.log(`    -H 'Content-Type: application/json' \\`);
    console.log(`    -d '{"username":"${user.username}","password":"${newPassword}"}'`);
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
resetPassword();
