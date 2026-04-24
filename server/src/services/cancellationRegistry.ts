/**
 * In-memory registry that maps an active generation/merge job (keyed by
 * courseId) to an AbortController. The registry lets an HTTP cancel endpoint
 * signal the long-running job running in another request handler so it can
 * exit its retry loops and LLM awaits.
 *
 * Notes:
 * - A single course can only have one active job at a time. If `register` is
 *   called while an existing controller is present, the old one is aborted
 *   first (defensive — the generation endpoints should already enforce this).
 * - Always `release` in a `finally` block; otherwise stale controllers would
 *   accumulate across runs.
 */
class CancellationRegistry {
  private controllers = new Map<string, AbortController>();

  register(courseId: string): AbortController {
    const existing = this.controllers.get(courseId);
    if (existing && !existing.signal.aborted) {
      existing.abort();
    }
    const controller = new AbortController();
    this.controllers.set(courseId, controller);
    return controller;
  }

  /**
   * Abort the active job for `courseId`. Returns true if a job was found and
   * aborted, false if nothing is running.
   */
  cancel(courseId: string): boolean {
    const ctrl = this.controllers.get(courseId);
    if (!ctrl) return false;
    if (!ctrl.signal.aborted) ctrl.abort();
    return true;
  }

  release(courseId: string): void {
    this.controllers.delete(courseId);
  }

  isActive(courseId: string): boolean {
    const ctrl = this.controllers.get(courseId);
    return !!ctrl && !ctrl.signal.aborted;
  }
}

export const cancellationRegistry = new CancellationRegistry();

export class GenerationCancelledError extends Error {
  constructor(message = 'Generation cancelled by user') {
    super(message);
    this.name = 'GenerationCancelledError';
  }
}

export function isCancellation(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof GenerationCancelledError) return true;
  if (err instanceof Error) {
    if (err.name === 'AbortError') return true;
    if (err.name === 'GenerationCancelledError') return true;
  }
  return false;
}

/**
 * Throw GenerationCancelledError synchronously if the signal has already
 * been aborted. Call this at natural checkpoints (before starting a new
 * stage, between batches, etc.) so the pipeline bails out quickly.
 */
export function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new GenerationCancelledError();
  }
}

/**
 * Promise-based sleep that rejects with GenerationCancelledError as soon as
 * the signal is aborted. Used to replace `new Promise(r => setTimeout(r, ms))`
 * inside retry backoffs so cancellation isn't blocked by a 30+ second sleep.
 */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new GenerationCancelledError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new GenerationCancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
