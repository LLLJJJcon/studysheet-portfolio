import { abortableSleep } from '../services/cancellationRegistry';

/**
 * Global, process-wide LLM rate limiter.
 *
 * Behaviour:
 * - Starts DISABLED. All LLM calls pass through instantly — no throttling.
 * - The first time any LLM call throws a 429 / quota / rate-limit error,
 *   `trigger()` flips the limiter to ENABLED for the rest of the process.
 * - Once enabled, every LLM call must `acquire()` a slot. Slots use a
 *   sliding-window: at most `limit` acquires per 60s. If the window is
 *   full the call awaits until the oldest slot ages out.
 * - The wait is `abortableSleep` so a user-triggered cancel will bail
 *   out immediately instead of sitting in the queue.
 *
 * Configuration (env):
 * - LLM_RATE_LIMIT_PER_MIN : integer (default 5, matches Gemini free tier)
 *
 * Why lazy activation: in normal operation (paid tier / small jobs) we
 * don't want to slow things down. Only once the provider has told us
 * "you're hitting the wall" do we start spacing calls out.
 */

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = (() => {
  const parsed = Number(process.env.LLM_RATE_LIMIT_PER_MIN);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 5;
})();

class LLMRateLimiter {
  private enabled = false;
  private readonly limit = DEFAULT_LIMIT;
  private timestamps: number[] = [];
  private triggeredAt: number | null = null;

  isEnabled(): boolean {
    return this.enabled;
  }

  getLimit(): number {
    return this.limit;
  }

  /**
   * Called from the provider wrapper as soon as a 429 surfaces. Idempotent —
   * further 429s after activation are no-ops. We seed the sliding window
   * with `limit` timestamps at `now` so the very next acquire has to wait
   * out the full 60s quota window (otherwise we'd immediately fire another
   * 4-5 calls that are guaranteed to 429 again).
   */
  trigger(reason?: string): void {
    if (this.enabled) return;
    this.enabled = true;
    this.triggeredAt = Date.now();
    this.timestamps = Array(this.limit).fill(this.triggeredAt);
    console.warn(
      `[llmRateLimiter] ACTIVATED due to 429. Cap=${this.limit}/min from now on. Reason: ${
        reason?.slice(0, 200) || 'rate limit hit'
      }`
    );
  }

  /**
   * If disabled: no-op. If enabled: returns once there is room in the
   * 60s sliding window, otherwise awaits (abortable) until there is.
   */
  async acquire(signal?: AbortSignal): Promise<void> {
    if (!this.enabled) return;

    while (true) {
      const now = Date.now();
      while (this.timestamps.length > 0 && now - this.timestamps[0] >= WINDOW_MS) {
        this.timestamps.shift();
      }
      if (this.timestamps.length < this.limit) {
        this.timestamps.push(now);
        return;
      }
      const waitMs = WINDOW_MS - (now - this.timestamps[0]) + 50;
      console.log(
        `[llmRateLimiter] throttling: ${this.limit}/min cap reached, waiting ${waitMs}ms (queue=${this.timestamps.length})`
      );
      await abortableSleep(waitMs, signal);
    }
  }

  /**
   * For tests / admin endpoints only. Not currently exposed.
   */
  reset(): void {
    this.enabled = false;
    this.timestamps = [];
    this.triggeredAt = null;
  }
}

export const llmRateLimiter = new LLMRateLimiter();

/**
 * Best-effort detector for "provider says you're rate-limited" errors,
 * across OpenAI / Anthropic / Gemini shapes. We check both the HTTP status
 * and the message text because different SDKs surface them differently.
 */
export function is429Error(err: unknown): boolean {
  if (!err) return false;
  const e = err as {
    status?: number;
    statusCode?: number;
    code?: string | number;
    message?: string;
  };
  if (e.status === 429 || e.statusCode === 429 || e.code === 429 || e.code === '429') {
    return true;
  }
  const msg = (e.message || '').toLowerCase();
  if (msg.includes('429') && msg.includes('too many requests')) return true;
  if (msg.includes('quota exceeded')) return true;
  if (msg.includes('rate limit') || msg.includes('rate-limit') || msg.includes('ratelimit')) {
    return true;
  }
  if (msg.includes('resource_exhausted')) return true;
  return false;
}
