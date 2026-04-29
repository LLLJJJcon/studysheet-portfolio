import { LLMProvider, ChatParams, ChatResponse, StreamChunk, AgentParams, AgentEvent } from './LLMProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GeminiProvider } from './GeminiProvider';
import { IUser } from '../models/User';
import { decrypt } from '../utils/encryption';
import { llmRateLimiter, is429Error } from './llmRateLimiter';

/**
 * Wraps an LLMProvider to inject a default model into all calls.
 */
// Wrapper that injects a default model name into all LLM provider calls
class ModelBoundProvider implements LLMProvider {
  constructor(private inner: LLMProvider, private model: string) {}

  // Delegate chat call to inner provider with the bound model as default
  chat(params: ChatParams): Promise<ChatResponse> {
    return this.inner.chat({ ...params, model: params.model || this.model });
  }

  // Delegate streaming chat call with the bound model as default
  chatStream(params: ChatParams): AsyncIterable<StreamChunk> {
    return this.inner.chatStream({ ...params, model: params.model || this.model });
  }

  // Delegate tool-use chat call with the bound model as default
  chatWithTools(params: AgentParams): AsyncIterable<AgentEvent> {
    return this.inner.chatWithTools({ ...params, model: params.model || this.model });
  }
}

/**
 * Outermost wrapper that routes every LLM call through `llmRateLimiter`.
 *
 * - Before the call: `acquire(signal)` — no-op until a 429 has been seen
 *   somewhere in the process; afterwards it enforces N/min globally.
 * - After the call: if the error looks like a 429 / quota / rate-limit,
 *   `trigger()` the limiter so subsequent calls start being throttled.
 *
 * Streaming and tool calls are wrapped as `async function*` so the
 * acquire happens at iterator startup and any thrown error flows through
 * the same catch.
 */
// Wrapper that enforces global rate limiting on all LLM calls after a 429 is detected
class RateLimitedProvider implements LLMProvider {
  constructor(private inner: LLMProvider) {}

  // Acquire rate-limit slot, execute chat, and trigger limiter on 429 errors
  async chat(params: ChatParams): Promise<ChatResponse> {
    await llmRateLimiter.acquire(params.signal);
    try {
      return await this.inner.chat(params);
    } catch (err) {
      if (is429Error(err)) {
        llmRateLimiter.trigger(err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }

  // Rate-limited streaming chat that triggers the limiter on 429 errors
  async *chatStream(params: ChatParams): AsyncIterable<StreamChunk> {
    await llmRateLimiter.acquire(params.signal);
    try {
      for await (const chunk of this.inner.chatStream(params)) {
        yield chunk;
      }
    } catch (err) {
      if (is429Error(err)) {
        llmRateLimiter.trigger(err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }

  // Rate-limited tool-use chat that triggers the limiter on 429 errors
  async *chatWithTools(params: AgentParams): AsyncIterable<AgentEvent> {
    await llmRateLimiter.acquire(params.signal);
    try {
      for await (const event of this.inner.chatWithTools(params)) {
        yield event;
      }
    } catch (err) {
      if (is429Error(err)) {
        llmRateLimiter.trigger(err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
}

// Create an LLM provider for a user based on their preferred provider, API key, and model
export function createProvider(user: IUser): LLMProvider {
  const provider = user.preferredProvider || 'openai';
  const encryptedKey = user.apiKeys[provider as keyof typeof user.apiKeys];

  if (!encryptedKey) {
    throw new Error(`No API key configured for provider: ${provider}`);
  }

  const apiKey = decrypt(encryptedKey).trim().replace(/^['\"]|['\"]$/g, '');
  if (!apiKey) {
    throw new Error(`Configured API key for provider ${provider} is empty after normalization`);
  }

  let llm: LLMProvider;
  switch (provider) {
    case 'openai':
      llm = new OpenAIProvider(apiKey, user.openaiBaseUrl || undefined);
      break;
    case 'anthropic':
      llm = new AnthropicProvider(apiKey);
      break;
    case 'gemini':
      llm = new GeminiProvider(apiKey);
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  // If user has a preferred model, wrap with ModelBoundProvider first.
  const modelBound: LLMProvider = user.preferredModel
    ? new ModelBoundProvider(llm, user.preferredModel)
    : llm;

  // Always wrap with the rate-limiter as the outermost layer so every
  // LLM call site (generation / merge / compression / layout / chunk chat)
  // is throttled once we've been hit with a 429 anywhere in the process.
  return new RateLimitedProvider(modelBound);
}
