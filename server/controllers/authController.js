import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateTokenPair } from '../utils/tokenUtils.js';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db, User } from "../utils/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const getUserByEmail = db.prepare(`
  SELECT u.*, 
         CASE WHEN u.firm_id IS NOT NULL THEN f.name ELSE NULL END as firm_name,
         CASE WHEN u.firm_id IS NOT NULL THEN f.code ELSE NULL END as firm_code,
         CASE WHEN u.firm_id IS NOT NULL THEN f.status ELSE NULL END as firm_status
  FROM users u
  LEFT JOIN firms f ON f.id = u.firm_id
  WHERE u.email = ?
`);

const getUserById = db.prepare(`
  SELECT u.*, 
         CASE WHEN u.firm_id IS NOT NULL THEN f.name ELSE NULL END as firm_name,
         CASE WHEN u.firm_id IS NOT NULL THEN f.code ELSE NULL END as firm_code,
         CASE WHEN u.firm_id IS NOT NULL THEN f.status ELSE NULL END as firm_status
  FROM users u
  LEFT JOIN firms f ON f.id = u.firm_id
  WHERE u.id = ?
`);

const getUserByUsername = db.prepare(`
  SELECT u.*, 
         CASE WHEN u.firm_id IS NOT NULL THEN f.name ELSE NULL END as firm_name,
         CASE WHEN u.firm_id IS NOT NULL THEN f.code ELSE NULL END as firm_code,
         CASE WHEN u.firm_id IS NOT NULL THEN f.status ELSE NULL END as firm_status
  FROM users u
  LEFT JOIN firms f ON f.id = u.firm_id
  WHERE u.username = ?
`);

const createUser = db.prepare(`
  INSERT INTO users (username, email, fullname, password, role, firm_id, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const createFirm = db.prepare(`
  INSERT INTO firms (name, code, description, status)
  VALUES (?, ?, ?, ?)
`);

const getFirmByCode = db.prepare(`
  SELECT * FROM firms WHERE code = ?
`);

const getAllUsers = db.prepare(`
  SELECT u.id, u.username, u.email, u.fullname, u.role, u.status,
         u.created_at, u.updated_at,
         CASE WHEN u.firm_id IS NOT NULL THEN f.name ELSE 'No Firm' END as firm_name,
         CASE WHEN u.firm_id IS NOT NULL THEN f.code ELSE NULL END as firm_code
  FROM users u
  LEFT JOIN firms f ON f.id = u.firm_id
  WHERE u.role != 'super_admin'
  ORDER BY u.created_at DESC
`);

const getUsersByFirm = db.prepare(`
  SELECT u.id, u.username, u.email, u.fullname, u.role,
         u.created_at, u.updated_at
  FROM users u
  WHERE u.firm_id = ?
  ORDER BY u.created_at DESC
`);

// Initialize refresh_tokens table
db.exec(`
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) STRICT
`);

const saveRefreshToken = db.prepare(`
  INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
  VALUES (?, ?, ?)
`);

const getRefreshToken = db.prepare(`
  SELECT * FROM refresh_tokens
  WHERE user_id = ? AND expires_at > datetime('now')
`);

const deleteRefreshToken = db.prepare(`
  DELETE FROM refresh_tokens WHERE user_id = ? AND token_hash = ?
`);

const deleteAllUserRefreshTokens = db.prepare(`
  DELETE FROM refresh_tokens WHERE user_id = ?
`);


// Load users from JSON file
const usersPath = join(__dirname, '../utils/users.json');
const users = JSON.parse(readFileSync(usersPath, 'utf-8'));

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
        console.log(`🔐 Login attempt: ${username}`);
    
        if (!username || !password) {
          return res.status(400).json({ 
            success: false, 
            error: "Email/username and password are required" 
          });
        }
    
        // Try to find user by email or username
        let user = getUserByEmail.get(username);
        if (!user) {
          user = getUserByUsername.get(username);
        }
    
        if (!user) {
          console.log(`❌ User not found: ${username}`);
          return res.status(401).json({ 
            success: false, 
            error: "Invalid credentials" 
          });
        }
    
        console.log(`✅ User found: ${user.username} (role: ${user.role}, status: ${user.status})`);
    
        // Check if firm is approved
        if (user.firm_id && user.firm_status !== 'approved') {
          console.log(`❌ Firm not approved: ${user.firm_status}`);
          return res.status(403).json({ 
            success: false, 
            error: "Your firm is not approved yet. Please contact support." 
          });
        }
    
        // Check if user is approved
        if (user.status !== 'approved') {
          console.log(`❌ User not approved: ${user.status}`);
          return res.status(403).json({ 
            success: false, 
            error: "Your account is pending approval. Please contact your administrator." 
          });
        }
    
        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          console.log(`❌ Password mismatch`);
          return res.status(401).json({ 
            success: false, 
            error: "Invalid credentials" 
          });
        }
    
        console.log(`✅ Password verified`);
    
        User.updateLastLogin.run(user.id);
        
        // Get the updated user data (so the frontend gets the new time immediately)
        // You can also just manually add it to the object below to save a DB query:
        user.last_login = new Date().toISOString();

      const accessLifeMs = 15 * 60 * 1000;
    // Generate token pair
    const { accessToken, refreshToken } = generateTokenPair(user);

    const expiryTimestamp = Date.now() + accessLifeMs;

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.cookie('tokenExpiry', expiryTimestamp.toString(), { 
    httpOnly: false, 
    sameSite: 'strict', 
    secure: true,
    maxAge: accessLifeMs // Clears itself when the access token expires
  });

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;

    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      firm_id: user.firm_id,
      firm_name: user.firm_name,
      firm_code: user.firm_code,
      last_login: user.last_login
    };
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: userData
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const logout = (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  
  res.json({ 
    success: true, 
    message: 'Logout successful' 
  });
};

export const getCurrentUser = (req, res) => {
  // User is already attached by authMiddleware
  const user = getUserById.get(req.user.id);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      message: 'User not found' 
    });
  }

  const { password: _, ...userWithoutPassword } = user;
  
  res.json({ 
    success: true, 
    user: userWithoutPassword,
    tokenRefreshed: req.tokenRefreshed || false
  });
};

export const refreshToken = (req, res) => {
  // The authMiddleware already handles token refresh
  // This endpoint is just to explicitly trigger it
  res.json({ 
    success: true, 
    message: 'Token refreshed',
    user: req.user
  });
};
