import Anthropic from '@anthropic-ai/sdk';
import {
  LLMProvider,
  ChatParams,
  ChatResponse,
  StreamChunk,
  AgentParams,
  AgentEvent,
  ChatMessage,
} from './LLMProvider';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  private formatMessages(messages: ChatMessage[]): {
    system?: string;
    messages: Anthropic.MessageParam[];
  } {
    let system: string | undefined;
    const formatted: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
      } else {
        formatted.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    return { system, messages: formatted };
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const { system, messages } = this.formatMessages(params.messages);

    const response = await this.client.messages.create({
      model: params.model || DEFAULT_MODEL,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature ?? 0.7,
      system,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return {
      content: textBlock ? textBlock.text : '',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async *chatStream(params: ChatParams): AsyncIterable<StreamChunk> {
    const { system, messages } = this.formatMessages(params.messages);

    const stream = this.client.messages.stream({
      model: params.model || DEFAULT_MODEL,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature ?? 0.7,
      system,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { content: event.delta.text, done: false };
      }
    }
    yield { content: '', done: true };
  }

  async *chatWithTools(params: AgentParams): AsyncIterable<AgentEvent> {
    const { system, messages } = this.formatMessages(params.messages);

    const tools: Anthropic.Tool[] = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }));

    const response = await this.client.messages.create({
      model: params.model || DEFAULT_MODEL,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature ?? 0.7,
      system,
      messages,
      tools,
    });

    for (const block of response.content) {
      if (block.type === 'text') {
        yield { type: 'text', content: block.text };
      } else if (block.type === 'tool_use') {
        yield {
          type: 'tool_call',
          toolCall: {
            id: block.id,
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        };
      }
    }

    yield { type: 'done' };
  }
}
