import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelay = options.baseDelay ?? 1000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      options.onRetry?.(attempt + 1, lastError);

      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Operation failed after retries');
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err.message);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File too large. Maximum size is 50MB.' });
      return;
    }

    res.status(400).json({ error: err.message });
    return;
  }

  if (err.name === 'MulterFileTypeError' || err.message.startsWith('Unsupported file type:')) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err.message === 'Email already registered') {
    res.status(409).json({ error: err.message });
    return;
  }

  if (err.message === 'Invalid email or password') {
    res.status(401).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
};
