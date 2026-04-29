import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  apiKeys: {
    openai: string | null;
    anthropic: string | null;
    gemini: string | null;
  };
  openaiBaseUrl: string | null;
  preferredProvider: 'openai' | 'anthropic' | 'gemini';
  preferredModel: string | null;
  createdAt: Date;
}

// Mongoose schema for user accounts with credentials and LLM provider settings
const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  apiKeys: {
    openai: { type: String, default: null },
    anthropic: { type: String, default: null },
    gemini: { type: String, default: null },
  },
  openaiBaseUrl: { type: String, default: null },
  preferredModel: { type: String, default: null },
  preferredProvider: {
    type: String,
    enum: ['openai', 'anthropic', 'gemini'],
    default: 'openai',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Mongoose model for application users
export const User = mongoose.model<IUser>('User', userSchema);
