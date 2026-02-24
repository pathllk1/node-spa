import express from 'express';
import { login, logout, getCurrentUser, refreshToken } from '../../controllers/mongo/authController.js';
import { authMiddleware } from '../../middleware/mongo/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getCurrentUser);
router.post('/refresh', authMiddleware, refreshToken);

export default router;
