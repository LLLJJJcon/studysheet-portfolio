import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  abortableSleep,
  GenerationCancelledError,
  isCancellation,
  throwIfCancelled,
} from '../services/cancellationRegistry';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
  /**
   * When provided, the retry loop becomes cancellable:
   * - Checks `signal.aborted` before each attempt and before each backoff sleep
   * - Uses an abortable sleep so a pending 30s+ backoff stops immediately
   * - Never swallows GenerationCancelledError as a retryable error
   */
  signal?: AbortSignal;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelay = options.baseDelay ?? 1000;
  const signal = options.signal;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    throwIfCancelled(signal);
    try {
      return await fn();
    } catch (error) {
      if (isCancellation(error)) {
        throw error instanceof Error ? error : new GenerationCancelledError();
      }
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      options.onRetry?.(attempt + 1, lastError);

      const delay = baseDelay * Math.pow(2, attempt);
      await abortableSleep(delay, signal);
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
