/**
 * Token Utility
 * JWT generation and verification.
 * No DB dependency — identical to the SQLite version.
 */

import jwt from 'jsonwebtoken';
import 'dotenv/config';

const ACCESS_TOKEN_SECRET  = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error('❌ ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be set in .env');
}

const ACCESS_TOKEN_EXPIRY  = '15m';  // 15 minutes
const REFRESH_TOKEN_EXPIRY = '30d';  // 30 days

/**
 * Generate a short-lived access token
 * @param {Object} payload
 * @returns {string}
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Generate a long-lived refresh token
 * @param {Object} payload
 * @returns {string}
 */
export function generateRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

/**
 * Verify an access token — throws on invalid/expired
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
}

/**
 * Verify a refresh token — throws on invalid/expired
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
}

/**
 * Generate both tokens at once for a user document
 * @param {{ _id, username, email, role, firm_id }} user - Mongoose user doc (or plain object)
 * @returns {{ accessToken: string, refreshToken: string }}
 */
export function generateTokenPair(user) {
  const payload = {
    id:      user._id ?? user.id,
    username: user.username,
    email:    user.email,
    role:     user.role,
    firm_id:  user.firm_id ?? null,
  };

  return {
    accessToken:  generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}
