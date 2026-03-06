/**
 * Rate Limiting & Brute Force Protection Middleware
 * Tracks login attempts per IP and per user
 */

const loginAttempts = new Map(); // { key: { count, firstAttempt, lockedUntil } }

const RATE_LIMIT_ATTEMPTS = parseInt(process.env.RATE_LIMIT_ATTEMPTS || '5', 10);
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15', 10) * 60 * 1000;
const ACCOUNT_LOCK_DURATION = parseInt(process.env.ACCOUNT_LOCK_DURATION_MINUTES || '15', 10) * 60 * 1000;

/**
 * Get client IP address (handles proxies)
 * @param {Object} req - Express request
 * @returns {string} IP address
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Create rate limit key (IP-based)
 * @param {string} ip - Client IP
 * @returns {string}
 */
function getRateLimitKey(ip) {
  return `login:ip:${ip}`;
}

/**
 * Rate limiting middleware for login endpoint
 * Prevents brute force by limiting attempts per IP
 */
export const loginRateLimit = (req, res, next) => {
  const ip = getClientIP(req);
  const key = getRateLimitKey(ip);
  const now = Date.now();

  let attempt = loginAttempts.get(key);

  if (!attempt) {
    // First attempt from this IP
    loginAttempts.set(key, {
      count: 1,
      firstAttempt: now,
      lockedUntil: null,
    });
    return next();
  }

  // Check if IP is currently locked
  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    const remainingMs = attempt.lockedUntil - now;
    const remainingMins = Math.ceil(remainingMs / 1000 / 60);
    console.warn(`🚫 IP ${ip} is rate-limited. Remaining: ${remainingMins} minutes`);
    return res.status(429).json({
      success: false,
      error: `Too many login attempts. Please try again in ${remainingMins} minute(s).`,
      retryAfter: remainingMs,
    });
  }

  // Check if rate limit window has expired
  if (now - attempt.firstAttempt > RATE_LIMIT_WINDOW) {
    // Reset counter
    loginAttempts.set(key, {
      count: 1,
      firstAttempt: now,
      lockedUntil: null,
    });
    return next();
  }

  // Increment attempt counter
  attempt.count++;

  if (attempt.count >= RATE_LIMIT_ATTEMPTS) {
    // Lock the IP
    attempt.lockedUntil = now + ACCOUNT_LOCK_DURATION;
    console.warn(`⚠️ IP ${ip} locked after ${attempt.count} failed attempts. Lock duration: ${ACCOUNT_LOCK_DURATION / 1000 / 60} minutes`);
    return res.status(429).json({
      success: false,
      error: `Too many login attempts. Please try again in ${ACCOUNT_LOCK_DURATION / 1000 / 60} minute(s).`,
      retryAfter: ACCOUNT_LOCK_DURATION,
    });
  }

  // Still within limit
  const remainingAttempts = RATE_LIMIT_ATTEMPTS - attempt.count;
  console.log(`⚠️ Login attempt from ${ip}. Remaining attempts before lock: ${remainingAttempts}`);
  next();
};

/**
 * Per-user account lockout tracking
 * Locks account after N failed attempts, requires timer to unlock
 */
export const checkAccountLockout = async (User, user) => {
  if (!user) return null;

  const now = new Date();

  // Check if account is locked
  if (user.account_locked_until && user.account_locked_until > now) {
    const remainingMs = user.account_locked_until - now;
    const remainingMins = Math.ceil(remainingMs / 1000 / 60);
    console.warn(`🔒 Account ${user.username} is locked. Remaining: ${remainingMins} minutes`);
    throw new Error(`Account is temporarily locked. Please try again in ${remainingMins} minute(s).`);
  }

  // Account lock has expired, reset counter
  if (user.account_locked_until && user.account_locked_until <= now) {
    user.failed_login_attempts = 0;
    user.account_locked_until = null;
    await user.save();
  }

  return user;
};

/**
 * Record a failed login attempt
 * Locks account after N failures
 */
export const recordFailedAttempt = async (User, user) => {
  if (!user) return;

  user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;

  const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_ATTEMPTS || '3', 10);

  if (user.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
    user.account_locked_until = new Date(Date.now() + ACCOUNT_LOCK_DURATION);
    console.warn(
      `🔒 Account ${user.username} locked after ${user.failed_login_attempts} failed attempts. ` +
      `Lock duration: ${ACCOUNT_LOCK_DURATION / 1000 / 60} minutes`
    );
  }

  await user.save();
};

/**
 * Reset failed attempt counter on successful login
 */
export const resetFailedAttempts = async (user) => {
  if (user.failed_login_attempts > 0 || user.account_locked_until) {
    user.failed_login_attempts = 0;
    user.account_locked_until = null;
    await user.save();
  }
};

/**
 * Cleanup old rate limit entries (runs periodically)
 */
export const cleanupRateLimitEntries = () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, attempt] of loginAttempts.entries()) {
    // Remove entries older than 2x the rate limit window
    if (now - attempt.firstAttempt > RATE_LIMIT_WINDOW * 2) {
      loginAttempts.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} old rate limit entries`);
  }
};

/**
 * Get rate limit status for an IP (for monitoring/debugging)
 */
export const getRateLimitStatus = (ip) => {
  const key = getRateLimitKey(ip);
  const attempt = loginAttempts.get(key);

  if (!attempt) {
    return { limited: false, attempts: 0 };
  }

  const now = Date.now();
  const isLocked = attempt.lockedUntil && now < attempt.lockedUntil;

  return {
    limited: isLocked,
    attempts: attempt.count,
    lockedUntil: attempt.lockedUntil,
    remainingLockMs: isLocked ? attempt.lockedUntil - now : 0,
  };
};
