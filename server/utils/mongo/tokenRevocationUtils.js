import crypto from 'crypto';
import { TokenBlacklist, RefreshToken, LoginAudit, TokenSessionDevice } from '../../models/index.js';

/**
 * Add a token to the blacklist (revoke it immediately)
 * @param {string} user_id - User ObjectId
 * @param {string} token - Raw token string
 * @param {Date} expires_at - Token expiry date
 * @param {string} reason - Revocation reason
 */
export async function addTokenToBlacklist(user_id, token, expires_at, reason = 'logout') {
  try {
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    
    await TokenBlacklist.create({
      user_id,
      token_hash,
      reason,
      expires_at,
    });
    
    console.log(`✅ Token blacklisted for user ${user_id}:${reason}`);
  } catch (error) {
    console.error('❌ Error blacklisting token:', error.message);
    throw error;
  }
}

/**
 * Check if a token is blacklisted
 * @param {string} token - Raw token string
 * @returns {Promise<boolean>}
 */
export async function isTokenBlacklisted(token) {
  try {
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    
    const blacklisted = await TokenBlacklist.findOne({
      token_hash,
    }).lean();
    
    return !!blacklisted;
  } catch (error) {
    console.error('❌ Error checking token blacklist:', error.message);
    return true; // Fail secure: if we can't check, reject
  }
}

/**
 * Revoke all tokens for a user
 * @param {string} user_id - User ObjectId
 * @param {string} reason - Revocation reason
 */
export async function revokeAllUserTokens(user_id, reason = 'manual-revoke') {
  try {
    const result = await RefreshToken.updateMany(
      { user_id, is_revoked: false },
      {
        $set: {
          is_revoked: true,
          revoked_reason: reason,
          revoked_at: new Date(),
        },
      }
    );
    
    console.log(`✅ Revoked ${result.modifiedCount} token(s) for user ${user_id}:${reason}`);
    return result.modifiedCount;
  } catch (error) {
    console.error('❌ Error revoking user tokens:', error.message);
    throw error;
  }
}

/**
 * Revoke all tokens with the same family ID (e.g., refresh chain compromise)
 * @param {string} family_id - Token family ID
 * @param {string} reason - Revocation reason
 */
export async function revokeTokenFamily(family_id, reason = 'security') {
  try {
    const result = await RefreshToken.updateMany(
      { token_family_id: family_id, is_revoked: false },
      {
        $set: {
          is_revoked: true,
          revoked_reason: reason,
          revoked_at: new Date(),
        },
      }
    );
    
    console.log(`✅ Revoked token family ${family_id} (${result.modifiedCount} tokens):${reason}`);
    return result.modifiedCount;
  } catch (error) {
    console.error('❌ Error revoking token family:', error.message);
    throw error;
  }
}

/**
 * Log a login attempt (success or failure)
 * @param {Object} options - { user_id, status, ip_address, user_agent, device_id, failure_reason, location }
 */
export async function logLoginAttempt(options) {
  try {
    const {
      user_id,
      status = 'success',
      ip_address,
      user_agent = null,
      device_id = null,
      failure_reason = null,
      location = null,
    } = options;

    await LoginAudit.create({
      user_id,
      status,
      ip_address,
      user_agent,
      device_id,
      failure_reason,
      location,
    });
  } catch (error) {
    console.error('❌ Error logging login attempt:', error.message);
    // Don't throw - logging should never fail auth flow
  }
}

/**
 * Get login history for a user (recent logins)
 * @param {string} user_id - User ObjectId
 * @param {number} limit - Number of records to return
 */
export async function getLoginHistory(user_id, limit = 10) {
  try {
    const history = await LoginAudit.find({ user_id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    return history;
  } catch (error) {
    console.error('❌ Error fetching login history:', error.message);
    return [];
  }
}

/**
 * Get suspicious login attempts (failed logins, rapid attempts, etc.)
 * @param {string} user_id - User ObjectId
 * @param {number} minutes - Look back N minutes
 */
export async function getSuspiciousAttempts(user_id, minutes = 15) {
  try {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    
    const suspicious = await LoginAudit.find({
      user_id,
      createdAt: { $gte: since },
      status: { $in: ['failed', 'locked', 'suspicious'] },
    }).lean();
    
    return suspicious;
  } catch (error) {
    console.error('❌ Error fetching suspicious attempts:', error.message);
    return [];
  }
}

/**
 * Register or update a device
 * @param {Object} options - { user_id, device_id, device_name, device_type, browser, os, ip_address, is_trusted }
 */
export async function registerDevice(options) {
  try {
    const {
      user_id,
      device_id,
      device_name = null,
      device_type = 'unknown',
      browser = null,
      os = null,
      ip_address,
      is_trusted = false,
      token_family_id = null,
    } = options;

    const existingDevice = await TokenSessionDevice.findOne({
      user_id,
      device_id,
    });

    if (existingDevice) {
      // Update existing device
      existingDevice.last_used_at = new Date();
      existingDevice.ip_address = ip_address;
      existingDevice.token_family_id = token_family_id;
      await existingDevice.save();
      return { created: false, device: existingDevice };
    } else {
      // Create new device
      const newDevice = await TokenSessionDevice.create({
        user_id,
        device_id,
        device_name,
        device_type,
        browser,
        os,
        ip_address,
        is_trusted,
        token_family_id,
      });
      
      console.log(`✅ New device registered: ${device_id} for user ${user_id}`);
      return { created: true, device: newDevice };
    }
  } catch (error) {
    console.error('❌ Error registering device:', error.message);
    throw error;
  }
}

/**
 * Get all devices/sessions for a user
 * @param {string} user_id - User ObjectId
 */
export async function getUserSessions(user_id) {
  try {
    const sessions = await TokenSessionDevice.find({
      user_id,
    })
      .sort({ last_used_at: -1 })
      .lean();
    
    return sessions;
  } catch (error) {
    console.error('❌ Error fetching user sessions:', error.message);
    return [];
  }
}

/**
 * Revoke a specific device/session
 * @param {string} user_id - User ObjectId
 * @param {string} device_id - Device ID to revoke
 */
export async function revokeDevice(user_id, device_id) {
  try {
    // Find all tokens for this device
    const tokensToRevoke = await RefreshToken.find({
      user_id,
      device_id,
      is_revoked: false,
    });

    // Revoke them all
    const result = await RefreshToken.updateMany(
      { user_id, device_id, is_revoked: false },
      {
        $set: {
          is_revoked: true,
          revoked_reason: 'device-revoked',
          revoked_at: new Date(),
        },
      }
    );

    // Delete the device
    await TokenSessionDevice.deleteOne({ user_id, device_id });

    console.log(`✅ Device ${device_id} revoked for user ${user_id} (${result.modifiedCount} tokens)`);
    return result.modifiedCount;
  } catch (error) {
    console.error('❌ Error revoking device:', error.message);
    throw error;
  }
}

/**
 * Mark a device as trusted
 * @param {string} user_id - User ObjectId
 * @param {string} device_id - Device ID to trust
 */
export async function trustDevice(user_id, device_id) {
  try {
    const result = await TokenSessionDevice.updateOne(
      { user_id, device_id },
      { $set: { is_trusted: true } }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ Device ${device_id} marked as trusted for user ${user_id}`);
    }
    return result.modifiedCount;
  } catch (error) {
    console.error('❌ Error trusting device:', error.message);
    throw error;
  }
}

/**
 * Clean up expired/revoked tokens and blacklist entries (runs periodically)
 */
export async function cleanupExpiredTokens() {
  try {
    const now = new Date();

    // Delete expired refresh tokens
    const refreshResult = await RefreshToken.deleteMany({
      expires_at: { $lt: now },
    });

    // Delete expired blacklist entries
    const blacklistResult = await TokenBlacklist.deleteMany({
      expires_at: { $lt: now },
    });

    console.log(
      `🧹 Cleanup: deleted ${refreshResult.deletedCount} expired refresh tokens, ` +
      `${blacklistResult.deletedCount} blacklist entries`
    );

    return {
      deletedRefreshTokens: refreshResult.deletedCount,
      deletedBlacklistEntries: blacklistResult.deletedCount,
    };
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  }
}
