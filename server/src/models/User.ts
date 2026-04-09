import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  apiKeys: {
    openai: string | null;
    anthropic: string | null;
  };
  preferredProvider: 'openai' | 'anthropic';
  createdAt: Date;
}

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
  },
  preferredProvider: {
    type: String,
    enum: ['openai', 'anthropic'],
    default: 'openai',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const User = mongoose.model<IUser>('User', userSchema);
