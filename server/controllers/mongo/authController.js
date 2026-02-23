/**
 * Auth Controller — Mongoose version
 *
 * Key changes from the SQLite version:
 *  - All db.prepare() calls replaced with Mongoose model queries
 *  - Refresh token is now hashed (SHA-256) and stored in the RefreshToken collection
 *    (matches the hash check done in middleware/mongo/authMiddleware.js)
 *  - User.updateLastLogin prepared statement replaced with findByIdAndUpdate()
 *  - users.json demo fallback removed (not needed with seeded MongoDB data)
 *  - Firm status check uses populated firm_id instead of a JOIN
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { generateTokenPair } from '../../utils/mongo/tokenUtils.js';
import { User, RefreshToken } from '../models/index.js';

const ACCESS_LIFE_MS   = 15 * 60 * 1000;       // 15 minutes
const REFRESH_LIFE_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days

/** SHA-256 hash a raw token — must match the hash used in authMiddleware */
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/* ─────────────────────────────────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────────────────────────────────── */

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log(`🔐 Login attempt: ${username}`);

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Email/username and password are required' });
    }

    // Find by email OR username, and populate firm details
    const user = await User.findOne({
      $or: [{ email: username }, { username }],
    }).populate('firm_id', 'name code status');  // only pull the fields we need

    if (!user) {
      console.log(`❌ User not found: ${username}`);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    console.log(`✅ User found: ${user.username} (role: ${user.role}, status: ${user.status})`);

    // Check firm approval (populated as firm_id object)
    const firm = user.firm_id; // populated doc or null
    if (firm && firm.status !== 'approved') {
      console.log(`❌ Firm not approved: ${firm.status}`);
      return res.status(403).json({ success: false, error: 'Your firm is not approved yet. Please contact support.' });
    }

    // Check user approval
    if (user.status !== 'approved') {
      console.log(`❌ User not approved: ${user.status}`);
      return res.status(403).json({ success: false, error: 'Your account is pending approval. Please contact your administrator.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`❌ Password mismatch`);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    console.log(`✅ Password verified`);

    // Update last login
    user.last_login = new Date();
    await user.save();

    // Generate token pair
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Persist hashed refresh token
    const expiresAt = new Date(Date.now() + REFRESH_LIFE_MS);
    await RefreshToken.create({
      user_id:    user._id,
      token_hash: hashToken(refreshToken),
      expires_at: expiresAt,
    });

    // Set cookies
    const cookieBase = {
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    };

    res.cookie('accessToken',  accessToken,  { ...cookieBase, httpOnly: true,  maxAge: ACCESS_LIFE_MS });
    res.cookie('refreshToken', refreshToken, { ...cookieBase, httpOnly: true,  maxAge: REFRESH_LIFE_MS });
    res.cookie('tokenExpiry',  String(Date.now() + ACCESS_LIFE_MS), { ...cookieBase, httpOnly: false, maxAge: ACCESS_LIFE_MS });

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id:         user._id,
        username:   user.username,
        email:      user.email,
        fullname:   user.fullname,
        role:       user.role,
        firm_id:    firm?._id ?? null,
        firm_name:  firm?.name ?? null,
        firm_code:  firm?.code ?? null,
        last_login: user.last_login,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────────────────────────────────── */

export const logout = async (req, res) => {
  try {
    // Delete the specific refresh token from DB (clean rotation)
    const rawRefresh = req.cookies.refreshToken;
    if (rawRefresh && req.user?.id) {
      await RefreshToken.deleteOne({
        user_id:    req.user.id,
        token_hash: hashToken(rawRefresh),
      });
    }
  } catch (_) {
    // Non-fatal — still clear cookies
  }

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('tokenExpiry');

  res.json({ success: true, message: 'Logout successful' });
};

/* ─────────────────────────────────────────────────────────────────────────
   GET CURRENT USER
───────────────────────────────────────────────────────────────────────── */

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('firm_id', 'name code status')
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success:       true,
      user,
      tokenRefreshed: req.tokenRefreshed || false,
    });
  } catch (error) {
    console.error('getCurrentUser error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────
   REFRESH TOKEN  (explicit endpoint — middleware already handles silent refresh)
───────────────────────────────────────────────────────────────────────── */

export const refreshToken = (req, res) => {
  res.json({ success: true, message: 'Token refreshed', user: req.user });
};
