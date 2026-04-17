import express from 'express';
import cors from 'cors';
import path from 'path';
import { corsOptions } from './config/cors';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use('/api/uploads', express.static(path.resolve(UPLOAD_DIR)));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Error handler
app.use(errorHandler);

export default app;
