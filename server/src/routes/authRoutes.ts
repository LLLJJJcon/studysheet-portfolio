import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

// Router for authentication endpoints (register, login, profile, API keys)
const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authMiddleware, authController.getMe);
router.put('/api-keys', authMiddleware, authController.updateApiKeys);
router.put('/settings', authMiddleware, authController.updateSettings);

export default router;
