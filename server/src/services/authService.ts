import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { encrypt, decrypt } from '../utils/encryption';
import { config } from '../config';

// Number of bcrypt salt rounds for password hashing
const SALT_ROUNDS = 12;
// JWT token expiration duration
const JWT_EXPIRES_IN = '7d';

// Trim whitespace and remove surrounding quotes from a user-pasted API key
function normalizeApiKey(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Users often paste keys wrapped in single/double quotes.
  const hasMatchingQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));

  const unquoted = hasMatchingQuotes ? trimmed.slice(1, -1).trim() : trimmed;
  return unquoted || null;
}

export interface AuthPayload {
  userId: string;
  email: string;
}

// Service handling user registration, login, API key management, and settings
export const authService = {
  // Hash password and create a new user, returning the user and JWT token
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

  // Validate credentials and return user with JWT token
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

  // Fetch user by ID, excluding the password hash
  async getUser(userId: string): Promise<IUser | null> {
    return User.findById(userId).select('-passwordHash');
  },

  // Encrypt and store updated LLM provider API keys for a user
  async updateApiKeys(
    userId: string,
    apiKeys: { openai?: string | null; anthropic?: string | null; gemini?: string | null }
  ): Promise<IUser | null> {
    const update: Record<string, string | null> = {};

    const normalizedOpenAI = normalizeApiKey(apiKeys.openai);
    const normalizedAnthropic = normalizeApiKey(apiKeys.anthropic);
    const normalizedGemini = normalizeApiKey(apiKeys.gemini);

    if (apiKeys.openai !== undefined) {
      update['apiKeys.openai'] = normalizedOpenAI ? encrypt(normalizedOpenAI) : null;
    }
    if (apiKeys.anthropic !== undefined) {
      update['apiKeys.anthropic'] = normalizedAnthropic ? encrypt(normalizedAnthropic) : null;
    }
    if (apiKeys.gemini !== undefined) {
      update['apiKeys.gemini'] = normalizedGemini ? encrypt(normalizedGemini) : null;
    }

    return User.findByIdAndUpdate(userId, { $set: update }, { new: true }).select('-passwordHash');
  },

  // Update user preferences like preferred LLM provider, base URL, and model
  async updateSettings(
    userId: string,
    settings: { preferredProvider?: 'openai' | 'anthropic' | 'gemini'; openaiBaseUrl?: string | null; preferredModel?: string | null }
  ): Promise<IUser | null> {
    const update: Record<string, unknown> = {};
    if (settings.preferredProvider !== undefined) {
      update.preferredProvider = settings.preferredProvider;
    }
    if (settings.openaiBaseUrl !== undefined) {
      update.openaiBaseUrl = settings.openaiBaseUrl || null;
    }
    if (settings.preferredModel !== undefined) {
      update.preferredModel = settings.preferredModel || null;
    }
    return User.findByIdAndUpdate(userId, { $set: update }, { new: true }).select('-passwordHash');
  },

  // Decrypt and return the API key for the specified or preferred provider
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

// Sign a JWT token containing userId and email
function generateToken(user: IUser): string {
  const payload: AuthPayload = {
    userId: user._id.toString(),
    email: user.email,
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: JWT_EXPIRES_IN });
}
