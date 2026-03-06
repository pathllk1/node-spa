/**
 * Session Management Controller
 * Handles multi-device session management
 */

import {
  getUserSessions,
  revokeDevice,
  trustDevice,
  getLoginHistory,
  getSuspiciousAttempts,
  revokeAllUserTokens,
} from '../../utils/mongo/tokenRevocationUtils.js';
import { User, LoginAudit } from '../../models/index.js';

/**
 * GET /api/auth/sessions
 * List all active sessions for the current user
 */
export const getSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const sessions = await getUserSessions(userId);

    res.json({
      success: true,
      sessions: sessions.map(session => ({
        device_id: session.device_id,
        device_name: session.device_name,
        device_type: session.device_type,
        browser: session.browser,
        os: session.os,
        ip_address: session.ip_address,
        is_trusted: session.is_trusted,
        last_used_at: session.last_used_at,
        created_at: session.createdAt,
      })),
    });
  } catch (error) {
    console.error('❌ Error fetching sessions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * DELETE /api/auth/sessions/:device_id
 * Revoke a specific device/session
 */
export const revokeSession = async (req, res) => {
  try {
    const { device_id } = req.params;
    const userId = req.user.id;

    if (!device_id) {
      return res.status(400).json({ success: false, error: 'device_id is required' });
    }

    const revokedCount = await revokeDevice(userId, device_id);

    res.json({
      success: true,
      message: `Revoked ${revokedCount} token(s) for device ${device_id}`,
      revokedTokenCount: revokedCount,
    });
  } catch (error) {
    console.error('❌ Error revoking session:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/auth/sessions/revoke-others
 * Revoke all sessions except the current one
 */
export const revokeOtherSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentDeviceId = req.user.device_id || 'unknown';

    const sessions = await getUserSessions(userId);
    let revokedCount = 0;

    for (const session of sessions) {
      if (session.device_id !== currentDeviceId) {
        revokedCount += await revokeDevice(userId, session.device_id);
      }
    }

    res.json({
      success: true,
      message: `Revoked ${revokedCount} token(s) from other devices`,
      revokedTokenCount: revokedCount,
    });
  } catch (error) {
    console.error('❌ Error revoking other sessions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/auth/sessions/:device_id/trust
 * Mark a device as trusted
 */
export const markDeviceTrusted = async (req, res) => {
  try {
    const { device_id } = req.params;
    const userId = req.user.id;

    if (!device_id) {
      return res.status(400).json({ success: false, error: 'device_id is required' });
    }

    const updated = await trustDevice(userId, device_id);

    if (updated === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    res.json({
      success: true,
      message: `Device ${device_id} marked as trusted`,
    });
  } catch (error) {
    console.error('❌ Error marking device as trusted:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/auth/login-history
 * Get recent login attempts for the current user
 */
export const getLoginHistoryEndpoint = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit || '10', 10);

    const history = await getLoginHistory(userId, Math.min(limit, 50));

    res.json({
      success: true,
      history: history.map(entry => ({
        status: entry.status,
        ip_address: entry.ip_address,
        device_id: entry.device_id,
        user_agent: entry.user_agent,
        failure_reason: entry.failure_reason,
        timestamp: entry.createdAt,
      })),
    });
  } catch (error) {
    console.error('❌ Error fetching login history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/auth/suspicious-activity
 * Get suspicious login attempts in the last N minutes
 */
export const getSuspiciousActivityEndpoint = async (req, res) => {
  try {
    const userId = req.user.id;
    const minutes = parseInt(req.query.minutes || '60', 10);

    const suspicious = await getSuspiciousAttempts(userId, Math.min(minutes, 1440));

    res.json({
      success: true,
      suspiciousAttempts: suspicious.map(entry => ({
        status: entry.status,
        ip_address: entry.ip_address,
        device_id: entry.device_id,
        user_agent: entry.user_agent,
        failure_reason: entry.failure_reason,
        timestamp: entry.createdAt,
      })),
    });
  } catch (error) {
    console.error('❌ Error fetching suspicious activity:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/auth/logout-all-devices
 * Logout from all devices (revoke all tokens)
 */
export const logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user.id;

    const revokedCount = await revokeAllUserTokens(userId, 'manual-logout-all');

    res.json({
      success: true,
      message: `Revoked ${revokedCount} token(s) from all devices`,
      revokedTokenCount: revokedCount,
    });
  } catch (error) {
    console.error('❌ Error logging out all devices:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
