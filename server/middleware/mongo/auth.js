import mongoose from 'mongoose';
import User from '../../models/User.model.js';
import Firm from '../../models/Firm.model.js';
import { RefreshToken } from '../../models/index.js';
import { verifyAccessToken, verifyRefreshToken, generateAccessToken } from '../../utils/mongo/tokenUtils.js';
import bcrypt from "bcrypt";

/**
 * Middleware to authenticate JWT tokens
 * Validates access token and automatically refreshes if needed
 */
export async function authenticateJWT(req, res, next) {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  console.log('[authenticateJWT DEBUG]', {
    accessTokenExists: !!accessToken,
    refreshTokenExists: !!refreshToken,
    path: req.path,
    method: req.method,
  });

  if (req.cookies.accessToken) {
    try {
      const decoded = verifyAccessToken(accessToken);
      console.log('[authenticateJWT] Access token valid, decoded user:', {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
      });
      
      // If firm_id is missing from token, fetch from database
      if (!decoded.firm_id) {
        console.log('[AUTH] Access token missing firm_id, fetching from database for user:', decoded.id);
        const user = await User.findById(decoded.id).populate('firm_id');
        if (user) {
          decoded.firm_id = user.firm_id?._id?.toString();
          decoded.firm_code = user.firm_id?.code;
        }
      }
      
      req.user = decoded;
      console.log('[authenticateJWT] Setting req.user, now req.user is:', { id: req.user.id, role: req.user.role });
      return next();
    } catch (accessErr) {
      console.log('[authenticateJWT] Access token invalid, trying refresh:', accessErr.message);
    }
  }

  // 2️⃣ ACCESS INVALID/MISSING → TRY REFRESH
  if (!req.cookies.refreshToken) {
    console.log('[authenticateJWT] No refresh token, unauthorized');
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 3️⃣ VERIFY REFRESH TOKEN
  try {
    const refreshPayload = verifyRefreshToken(refreshToken);
    const user = await User.findById(refreshPayload.id).populate('firm_id');

    if (!user) {
      console.log('[authenticateJWT] User not found for refresh');
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if firm is still approved
    if (user.firm_id && user.firm_id.status !== 'approved') {
      console.log('Firm not approved for refresh');
      return res.status(403).json({ error: "Firm access revoked" });
    }

    // Check if user is still approved
    if (user.status !== 'approved') {
      console.log('User not approved for refresh');
      return res.status(403).json({ error: "User access revoked" });
    }

    // Verify refresh token exists in database
    const storedTokens = await RefreshToken.find({
      user_id: new mongoose.Types.ObjectId(user._id),
      expires_at: { $gt: new Date() }
    });
    const isValidRefresh = await Promise.any(
      storedTokens.map(rt => bcrypt.compare(refreshToken, rt.token_hash))
    ).catch(() => false);

    if (!isValidRefresh) {
      console.log('[authenticateJWT] Refresh token invalid');
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log('[authenticateJWT] Refresh successful, generating new access token with user role:', user.role);

    // 4️⃣ ACCESS INVALID + REFRESH VALID → ISSUE NEW ACCESS TOKEN
    const payload = { 
      id: user._id.toString(), 
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      firm_id: user.firm_id?._id?.toString(),
      firm_code: user.firm_id?.code
    };
    
    console.log('[authenticateJWT] Refresh token payload created:', { id: payload.id, role: payload.role });
    
    // Sign the new access token
    const newAccessToken = generateAccessToken(payload);
    
    // Attach user to request
    req.user = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 15 * 60 };

    return next();
  } catch (refreshErr) {
    // ❌ Refresh expired or invalid
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/**
 * Middleware to check if user has specific role
 * @param {string|string[]} requiredRoles - Role(s) required to access this endpoint
 */
export function requireRole(requiredRoles) {
  if (!Array.isArray(requiredRoles)) requiredRoles = [requiredRoles];
  return (req, res, next) => {
    console.log('[requireRole DEBUG]', {
      hasReqUser: !!req.user,
      userObj: req.user ? { id: req.user.id, username: req.user.username, role: req.user.role } : null,
      requiredRoles: requiredRoles,
      roleMatch: req.user ? requiredRoles.includes(req.user.role) : false,
    });
    
    if (!req.user) {
      console.warn('⚠️ [requireRole] No req.user found!');
      return res.status(403).json({ error: 'You are not permitted to perform this action' });
    }
    
    if (!requiredRoles.includes(req.user.role)) {
      console.warn(`⚠️ [requireRole] Role mismatch! User role="${req.user.role}" not in required=[${requiredRoles.join(', ')}]`);
      return res.status(403).json({ error: 'You are not permitted to perform this action' });
    }
    
    next();
  };
}

/**
 * Middleware to check if user belongs to specific firm
 * @param {string} firmId - Firm ID to check
 */
export const requireFirm = (firmId) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: "Authentication required" 
      });
    }

    if (req.user.firm_id !== firmId) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied. Wrong firm." 
      });
    }

    next();
  };
};

/**
 * Middleware to check if user can access resource
 * Allows access if:
 * - User is admin (any firm)
 * - User is manager/user from same firm
 */
export const requireSameFirmOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: "Authentication required" 
    });
  }

  // Extract firm_id from request (could be in params, body, or query)
  const targetFirmId = req.params.firm_id || req.body.firm_id || req.query.firm_id;

  // Admin can access any firm
  if (req.user.role === 'admin') {
    return next();
  }

  // Non-admin must belong to same firm
  if (req.user.firm_id !== targetFirmId) {
    return res.status(403).json({ 
      success: false, 
      error: "Access denied. You can only access data from your firm." 
    });
  }

  next();
};