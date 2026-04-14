import {
  GoogleGenerativeAI,
  Content,
  Part,
  Tool,
} from '@google/generative-ai';
import {
  LLMProvider,
  ChatParams,
  ChatResponse,
  StreamChunk,
  AgentParams,
  AgentEvent,
  ChatMessage,
} from './LLMProvider';

const DEFAULT_MODEL = 'gemini-2.0-flash';

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  private formatMessages(messages: ChatMessage[]): {
    systemInstruction?: string;
    contents: Content[];
  } {
    let systemInstruction: string | undefined;
    const contents: Content[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    return { systemInstruction, contents };
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const { systemInstruction, contents } = this.formatMessages(params.messages);

    const model = this.client.getGenerativeModel({
      model: params.model || DEFAULT_MODEL,
      systemInstruction,
      generationConfig: {
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.maxTokens,
        responseMimeType: params.responseFormat === 'json' ? 'application/json' : 'text/plain',
      },
    });

    const result = await model.generateContent({ contents });
    const response = result.response;
    const text = response.text();
    const usage = response.usageMetadata;

    return {
      content: text,
      usage: usage
        ? {
            promptTokens: usage.promptTokenCount || 0,
            completionTokens: usage.candidatesTokenCount || 0,
            totalTokens: usage.totalTokenCount || 0,
          }
        : undefined,
    };
  }

  async *chatStream(params: ChatParams): AsyncIterable<StreamChunk> {
    const { systemInstruction, contents } = this.formatMessages(params.messages);

    const model = this.client.getGenerativeModel({
      model: params.model || DEFAULT_MODEL,
      systemInstruction,
      generationConfig: {
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.maxTokens,
        responseMimeType: params.responseFormat === 'json' ? 'application/json' : 'text/plain',
      },
    });

    const result = await model.generateContentStream({ contents });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield { content: text, done: false };
      }
    }
    yield { content: '', done: true };
  }

  async *chatWithTools(params: AgentParams): AsyncIterable<AgentEvent> {
    const { systemInstruction, contents } = this.formatMessages(params.messages);

    const tools: Tool[] = [
      {
        functionDeclarations: params.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters as any,
        })),
      },
    ];

    const model = this.client.getGenerativeModel({
      model: params.model || DEFAULT_MODEL,
      systemInstruction,
      tools,
      generationConfig: {
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.maxTokens,
      },
    });

    const result = await model.generateContent({ contents });
    const response = result.response;

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          yield { type: 'text', content: part.text };
        } else if (part.functionCall) {
          yield {
            type: 'tool_call',
            toolCall: {
              id: `gemini_${Date.now()}_${part.functionCall.name}`,
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args),
            },
          };
        }
      }
    }

    yield { type: 'done' };
  }
}
