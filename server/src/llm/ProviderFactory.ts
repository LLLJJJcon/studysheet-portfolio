import { LLMProvider, ChatParams, ChatResponse, StreamChunk, AgentParams, AgentEvent } from './LLMProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GeminiProvider } from './GeminiProvider';
import { IUser } from '../models/User';
import { decrypt } from '../utils/encryption';

/**
 * Wraps an LLMProvider to inject a default model into all calls.
 */
class ModelBoundProvider implements LLMProvider {
  constructor(private inner: LLMProvider, private model: string) {}

  chat(params: ChatParams): Promise<ChatResponse> {
    return this.inner.chat({ ...params, model: params.model || this.model });
  }

  chatStream(params: ChatParams): AsyncIterable<StreamChunk> {
    return this.inner.chatStream({ ...params, model: params.model || this.model });
  }

  chatWithTools(params: AgentParams): AsyncIterable<AgentEvent> {
    return this.inner.chatWithTools({ ...params, model: params.model || this.model });
  }
}

export function createProvider(user: IUser): LLMProvider {
  const provider = user.preferredProvider || 'openai';
  const encryptedKey = user.apiKeys[provider as keyof typeof user.apiKeys];

  if (!encryptedKey) {
    throw new Error(`No API key configured for provider: ${provider}`);
  }

  const apiKey = decrypt(encryptedKey);

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

  // If user has a preferred model, wrap with ModelBoundProvider
  if (user.preferredModel) {
    return new ModelBoundProvider(llm, user.preferredModel);
  }

  return llm;
}
