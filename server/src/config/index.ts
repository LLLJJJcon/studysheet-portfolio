import dotenv from 'dotenv';

dotenv.config();

// Application configuration loaded from environment variables with defaults
export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/studysheet',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
