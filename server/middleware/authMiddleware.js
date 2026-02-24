import {
  verifyAccessToken,
  verifyRefreshToken,
  generateAccessToken
} from '../utils/tokenUtils.js';
import { generateCSRFToken } from '../utils/csrfUtils.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    // If no tokens, unauthorized
    if (!accessToken && !refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Try to verify access token
    try {
      const decoded = verifyAccessToken(accessToken);
      req.user = decoded;
      return next();
    } catch (accessError) {
      // Access token invalid or expired
      // Check if refresh token is valid
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Session expired'
        });
      }

      try {
        // Verify refresh token
        const refreshDecoded = verifyRefreshToken(refreshToken);

        // Refresh token valid, generate new access token
        const newAccessToken = generateAccessToken({
          id: refreshDecoded.id,
          username: refreshDecoded.username,
          email: refreshDecoded.email,
          role: refreshDecoded.role,
          firm_id: refreshDecoded.firm_id
        });

        const accessLifeMs = 15 * 60 * 1000;
        const newExpiryTimestamp = Date.now() + accessLifeMs;

        // Set new access token in cookie
        res.cookie('accessToken', newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.cookie('tokenExpiry', newExpiryTimestamp.toString(), {
          httpOnly: false, sameSite: 'strict', secure: true, maxAge: accessLifeMs
        });
        // Ensure CSRF token exists (generate if not present)
        if (!req.cookies.csrfToken) {
          const csrfToken = generateCSRFToken();
          res.cookie('csrfToken', csrfToken, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
          });
        }
        // Attach user to request
        req.user = refreshDecoded;
        req.tokenRefreshed = true; // Flag for logging/debugging

        return next();
      } catch (refreshError) {
        // Refresh token also invalid - user must re-login
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.clearCookie('csrfToken'); // Clear CSRF token on logout

        return res.status(401).json({
          success: false,
          message: 'Session expired, please login again'
        });
      }
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const accessToken = req.cookies.accessToken;

    if (accessToken) {
      try {
        const decoded = verifyAccessToken(accessToken);
        req.user = decoded;
      } catch (error) {
        // Token invalid but it's optional, continue
        req.user = null;
      }
    }

    next();
  } catch (error) {
    next();
  }
};
