import { Response } from 'express';

export function initSSE(res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
}

export function sendSSE(res: Response, event: string, data: unknown): void {
  try {
    if (res.writableEnded || res.destroyed) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Connection already closed, ignore
  }
}

export function endSSE(res: Response): void {
  try {
    if (res.writableEnded || res.destroyed) return;
    sendSSE(res, 'done', { timestamp: new Date().toISOString() });
    res.end();
  } catch {
    // Connection already closed, ignore
  }
}

export function sendSSEError(res: Response, message: string, retryable = true): void {
  try {
    if (res.writableEnded || res.destroyed) return;
    sendSSE(res, 'error', { message, retryable });
    res.end();
  } catch {
    // Connection already closed, ignore
  }
}
