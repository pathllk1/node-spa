import jwt from "jsonwebtoken";
import { db } from "../utils/db.js";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your_super_refresh_secret";

// Prepared statements
const getUserById = db.prepare(`
  SELECT u.*, f.name as firm_name, f.code as firm_code, f.status as firm_status
  FROM users u
  JOIN firms f ON f.id = u.firm_id
  WHERE u.id = ?
`);

const getRefreshTokens = db.prepare(`
  SELECT * FROM refresh_tokens
  WHERE user_id = ? AND expires_at > datetime('now')
`);

/**
 * Middleware to authenticate JWT tokens
 * Validates access token and automatically refreshes if needed
 */
export async function authenticateJWT(req, res, next) {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  console.log('authenticateJWT called, cookies received:', {
    accessToken: !!req.cookies.accessToken,
    refreshToken: !!req.cookies.refreshToken
  });

  if (req.cookies.accessToken) {
    try {
      const decoded = jwt.verify(req.cookies.accessToken, JWT_SECRET);
      console.log('Access token valid, proceeding');
      
      // If firm_id is missing from token, fetch from database
      if (!decoded.firm_id) {
        console.log('[AUTH] Access token missing firm_id, fetching from database for user:', decoded.id);
        const user = getUserById.get(decoded.id);
        if (user) {
          decoded.firm_id = user.firm_id;
          decoded.firm_code = user.firm_code;
        }
      }
      
      req.user = decoded;
      return next();
    } catch (accessErr) {
      console.log('Access token invalid, trying refresh');
    }
  }

  // 2️⃣ ACCESS INVALID/MISSING → TRY REFRESH
  if (!req.cookies.refreshToken) {
    console.log('No refresh token, unauthorized');
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 3️⃣ VERIFY REFRESH TOKEN
  try {
    const refreshPayload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = getUserById.get(refreshPayload.id);

    if (!user) {
      console.log('User not found for refresh');
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if firm is still approved
    if (user.firm_id && user.firm_status !== 'approved') {
      console.log('Firm not approved for refresh');
      return res.status(403).json({ error: "Firm access revoked" });
    }

    // Check if user is still approved
    if (user.status !== 'approved') {
      console.log('User not approved for refresh');
      return res.status(403).json({ error: "User access revoked" });
    }

    // Verify refresh token exists in database
    const storedTokens = getRefreshTokens.all(user.id);
    const isValidRefresh = await Promise.any(
      storedTokens.map(rt => bcrypt.compare(refreshToken, rt.token_hash))
    ).catch(() => false);


    if (!isValidRefresh) {
      console.log('Refresh token invalid');
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log('Refresh successful, generating new access token');

    // 4️⃣ ACCESS INVALID + REFRESH VALID → ISSUE NEW ACCESS TOKEN
    const payload = { 
      id: user.id, 
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      firm_id: user.firm_id,
      firm_code: user.firm_code
    };
    
    // Sign the new access token
    const newAccessToken = jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: "15m" }
    );
    
    // Decode the new token to get the actual expiration time
    const decodedNewToken = jwt.decode(newAccessToken);
    
    // Attach user to request with the actual expiration from the token
    req.user = decodedNewToken;

    return next();
  } catch (refreshErr) {
    // ❌ Refresh expired or invalid
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/**
 * Middleware to check if user has specific role
 * @param {string[]} roles - Array of allowed roles
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: "Authentication required" 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: `Access denied. Required role: ${roles.join(" or ")}` 
      });
    }

    next();
  };
};

/**
 * Middleware to check if user belongs to specific firm
 * @param {number} firmId - Firm ID to check
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
  const targetFirmId = parseInt(
    req.params.firm_id || 
    req.body.firm_id || 
    req.query.firm_id
  );

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