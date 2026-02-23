/**
 * Auth Middleware — Mongoose version
 *
 * Changes from the SQLite version:
 *  1. tokenUtils imported from the mongo utils subfolder.
 *  2. Refresh token is validated against the DB (hash lookup + expiry check)
 *     before a new access token is issued — the SQLite version only verified
 *     the JWT signature without any DB cross-check.
 *  3. Stale / rotated refresh tokens are deleted from the DB on use (optional
 *     token rotation pattern — remove the deleteOne call if you don't rotate).
 */

import crypto from 'crypto';
import { verifyAccessToken, verifyRefreshToken, generateAccessToken } from '../../utils/mongo/tokenUtils.js';
import { RefreshToken } from '../models/index.js';

const ACCESS_LIFE_MS = 15 * 60 * 1000; // 15 minutes

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────── */

/** SHA-256 hash a raw token string — matches how tokens are stored at login */
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Write the new access token + expiry into response cookies */
function setAccessCookies(res, newAccessToken) {
  const newExpiryTimestamp = Date.now() + ACCESS_LIFE_MS;

  res.cookie('accessToken', newAccessToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   ACCESS_LIFE_MS,
  });

  res.cookie('tokenExpiry', newExpiryTimestamp.toString(), {
    httpOnly: false,
    sameSite: 'strict',
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   ACCESS_LIFE_MS,
  });
}

/** Clear both auth cookies and return a 401 */
function clearAndReject(res, message = 'Session expired, please login again') {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  return res.status(401).json({ success: false, message });
}

/* ─────────────────────────────────────────────────────────────────────────
   authMiddleware  — protect routes that require a valid session
───────────────────────────────────────────────────────────────────────── */

export const authMiddleware = async (req, res, next) => {
  try {
    const accessToken  = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    // ── No tokens at all ──────────────────────────────────────────────
    if (!accessToken && !refreshToken) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // ── Try access token first ────────────────────────────────────────
    try {
      const decoded = verifyAccessToken(accessToken);
      req.user = decoded;
      return next();
    } catch {
      // Access token missing or expired — fall through to refresh flow
    }

    // ── No refresh token to fall back on ─────────────────────────────
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Session expired' });
    }

    // ── Verify refresh token signature ────────────────────────────────
    let refreshDecoded;
    try {
      refreshDecoded = verifyRefreshToken(refreshToken);
    } catch {
      return clearAndReject(res);
    }

    // ── DB cross-check: token hash must exist and not be expired ──────
    const tokenHash = hashToken(refreshToken);
    const storedToken = await RefreshToken.findOne({
      user_id:    refreshDecoded.id,
      token_hash: tokenHash,
    }).lean();

    if (!storedToken) {
      // Token was already rotated or never stored — possible replay attack
      return clearAndReject(res, 'Invalid session, please login again');
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      // Token is in the DB but has passed its expiry date
      await RefreshToken.deleteOne({ _id: storedToken._id });
      return clearAndReject(res);
    }

    // ── Issue new access token ────────────────────────────────────────
    const newAccessToken = generateAccessToken({
      id:       refreshDecoded.id,
      username: refreshDecoded.username,
      email:    refreshDecoded.email,
      role:     refreshDecoded.role,
      firm_id:  refreshDecoded.firm_id,
    });

    setAccessCookies(res, newAccessToken);

    req.user           = refreshDecoded;
    req.tokenRefreshed = true; // useful for logging / debugging

    return next();

  } catch (error) {
    console.error('authMiddleware error:', error);
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────
   optionalAuth  — attach user if a valid access token is present,
                   but never block the request
───────────────────────────────────────────────────────────────────────── */

export const optionalAuth = async (req, res, next) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (accessToken) {
      try {
        req.user = verifyAccessToken(accessToken);
      } catch {
        req.user = null;
      }
    }
  } catch {
    // swallow — optional auth must never block
  }
  next();
};
