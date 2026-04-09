import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { encrypt, decrypt } from '../utils/encryption';
import { config } from '../config';

const SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = '7d';

export interface AuthPayload {
  userId: string;
  email: string;
}

export const authService = {
  async register(email: string, password: string): Promise<{ user: IUser; token: string }> {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new Error('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
    });

    const token = generateToken(user);
    return { user, token };
  },

  async login(email: string, password: string): Promise<{ user: IUser; token: string }> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid email or password');
    }

    const token = generateToken(user);
    return { user, token };
  },

  async getUser(userId: string): Promise<IUser | null> {
    return User.findById(userId).select('-passwordHash');
  },

  async updateApiKeys(
    userId: string,
    apiKeys: { openai?: string | null; anthropic?: string | null }
  ): Promise<IUser | null> {
    const update: Record<string, string | null> = {};

    if (apiKeys.openai !== undefined) {
      update['apiKeys.openai'] = apiKeys.openai ? encrypt(apiKeys.openai) : null;
    }
    if (apiKeys.anthropic !== undefined) {
      update['apiKeys.anthropic'] = apiKeys.anthropic ? encrypt(apiKeys.anthropic) : null;
    }

    return User.findByIdAndUpdate(userId, { $set: update }, { new: true }).select('-passwordHash');
  },

  async updateSettings(
    userId: string,
    settings: { preferredProvider?: 'openai' | 'anthropic' }
  ): Promise<IUser | null> {
    return User.findByIdAndUpdate(userId, { $set: settings }, { new: true }).select('-passwordHash');
  },

  getDecryptedApiKey(user: IUser, provider?: string): string | null {
    const p = provider || user.preferredProvider;
    const encrypted = user.apiKeys[p as keyof typeof user.apiKeys];
    if (!encrypted) return null;
    try {
      return decrypt(encrypted);
    } catch {
      return null;
    }
  },
};

function generateToken(user: IUser): string {
  const payload: AuthPayload = {
    userId: user._id.toString(),
    email: user.email,
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: JWT_EXPIRES_IN });
}
