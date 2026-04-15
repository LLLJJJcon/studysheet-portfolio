import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { AuthRequest } from '../middleware/auth';

function sanitizeUser(user: Record<string, unknown>) {
  const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete obj.passwordHash;
  // Mask API keys for client display
  if (obj.apiKeys) {
    obj.apiKeys = {
      openai: obj.apiKeys.openai ? '••••••••' : null,
      anthropic: obj.apiKeys.anthropic ? '••••••••' : null,
      gemini: obj.apiKeys.gemini ? '••••••••' : null,
    };
  }
  return obj;
}

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }
      const { user, token } = await authService.register(email, password);
      res.status(201).json({ user: sanitizeUser(user as unknown as Record<string, unknown>), token });
    } catch (error) {
      if (error instanceof Error && error.message === 'Email already registered') {
        res.status(409).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Registration failed' });
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }
      const { user, token } = await authService.login(email, password);
      res.json({ user: sanitizeUser(user as unknown as Record<string, unknown>), token });
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid email or password') {
        res.status(401).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Login failed' });
    }
  },

  async getMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await authService.getUser(req.user!.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ user: sanitizeUser(user as unknown as Record<string, unknown>) });
    } catch {
      res.status(500).json({ error: 'Failed to get user info' });
    }
  },

  async updateApiKeys(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { openai, anthropic, gemini } = req.body;
      const user = await authService.updateApiKeys(req.user!.userId, { openai, anthropic, gemini });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ user: sanitizeUser(user as unknown as Record<string, unknown>) });
    } catch {
      res.status(500).json({ error: 'Failed to update API keys' });
    }
  },

  async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { preferredProvider, openaiBaseUrl, preferredModel } = req.body;
      if (preferredProvider && !['openai', 'anthropic', 'gemini'].includes(preferredProvider)) {
        res.status(400).json({ error: 'Invalid provider' });
        return;
      }
      const user = await authService.updateSettings(req.user!.userId, { preferredProvider, openaiBaseUrl, preferredModel });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ user: sanitizeUser(user as unknown as Record<string, unknown>) });
    } catch {
      res.status(500).json({ error: 'Failed to update settings' });
    }
  },
};
