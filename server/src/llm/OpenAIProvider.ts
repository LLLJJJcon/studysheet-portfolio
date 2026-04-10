import OpenAI from 'openai';
import {
  LLMProvider,
  ChatParams,
  ChatResponse,
  StreamChunk,
  AgentParams,
  AgentEvent,
} from './LLMProvider';

const DEFAULT_MODEL = 'gpt-4o';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: params.model || DEFAULT_MODEL,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens,
    });

    const choice = response.choices[0];
    return {
      content: choice.message.content || '',
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *chatStream(params: ChatParams): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: params.model || DEFAULT_MODEL,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield { content: delta.content, done: false };
      }
      // Some models (e.g. GLM reasoning) emit reasoning_content before content.
      // We skip it but acknowledge the stream is alive.
    }
    yield { content: '', done: true };
  }

  async *chatWithTools(params: AgentParams): AsyncIterable<AgentEvent> {
    const tools: OpenAI.ChatCompletionTool[] = params.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as OpenAI.FunctionParameters,
      },
    }));

    const messages: OpenAI.ChatCompletionMessageParam[] = [...params.messages];

    let continueLoop = true;
    while (continueLoop) {
      const response = await this.client.chat.completions.create({
        model: params.model || DEFAULT_MODEL,
        messages,
        tools,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens,
      });

      const choice = response.choices[0];
      const message = choice.message;

      if (message.content) {
        yield { type: 'text', content: message.content };
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push(message);

        for (const toolCall of message.tool_calls) {
          yield {
            type: 'tool_call',
            toolCall: {
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            },
          };
        }
        // Caller must feed tool results back and re-invoke if needed
        continueLoop = false;
      } else {
        continueLoop = false;
      }
    }

    yield { type: 'done' };
  }
}

// TODO: Add retry logic and error handling
