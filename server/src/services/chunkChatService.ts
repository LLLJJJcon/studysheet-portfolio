import { Response } from 'express';
import { LLMProvider } from '../llm/LLMProvider';
import { chunkService } from './chunkService';
import { buildRouterSystemPrompt } from '../llm/prompts/L7_router';
import { buildRetrieverSystemPrompt } from '../llm/prompts/L7_retriever';
import {
  buildGeneratorSystemPrompt,
  GeneratorRelevantChunk,
  GeneratorChunkContext,
} from '../llm/prompts/L7_generator';
import { sendSSE } from '../utils/sseHelper';

interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

interface ChunkContextInput {
  content: string;
  name: string;
  importance: string;
  treePath: string;
  wordCount: number;
  pageWordLimit: number;
  chunkIndex: Array<{ nodeId: string; label: string }>;
}

// Map from router-classified intent to pipeline branch (A=retrieval, B=direct generation)
const INTENT_BRANCH: Record<string, 'A' | 'B'> = {
  add: 'A', expand: 'A', compare: 'A', deduplicate: 'A',
  compress: 'B', rewrite: 'B', format: 'B', correct: 'B', translate: 'B',
};

// Build a user prompt from chat message history, including conversation context
export function buildUserPrompt(messages: ChatMessageInput[]): string {
  if (messages.length === 0) return '';

  const currentRequest = messages[messages.length - 1].content;

  if (messages.length === 1) {
    return currentRequest;
  }

  const history = messages.slice(0, -1).map((m) => {
    const label = m.role === 'user' ? 'User' : 'Assistant';
    return `${label}: ${m.content}`;
  });

  return `## Conversation History\n${history.join('\n\n')}\n\n## Current Request\n${currentRequest}`;
}

// Execute the three-stage chunk chat pipeline: route intent, retrieve context, generate response
export async function runChunkChatPipeline(
  res: Response,
  provider: LLMProvider,
  courseId: string,
  nodeId: string,
  messages: ChatMessageInput[],
  chunkContext: ChunkContextInput
): Promise<void> {
  const userPrompt = buildUserPrompt(messages);

  // ===== Step 1: LLM-1 Router =====
  sendSSE(res, 'chat:thinking', { step: 'routing' });

  const routerSystemPrompt = buildRouterSystemPrompt(chunkContext.chunkIndex);

  let intent = 'unknown';
  let referencedChunks: string[] = [];

  try {
    const routerResult = await provider.chat({
      messages: [
        { role: 'system', content: routerSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      maxTokens: 200,
      responseFormat: 'json',
    });
    const parsed = JSON.parse(routerResult.content);
    intent = parsed.intent || 'unknown';
    referencedChunks = parsed.referencedChunks || [];
  } catch {
    // JSON parse failure — fallback to Branch B
  }

  const branch = INTENT_BRANCH[intent] ?? 'B';
  sendSSE(res, 'chat:routed', { intent, referencedChunks });

  // ===== Step 2: LLM-2 Retriever (Branch A + referencedChunks non-empty) =====
  let relevantChunks: GeneratorRelevantChunk[] = [];

  if (branch === 'A' && referencedChunks.length > 0) {
    sendSSE(res, 'chat:thinking', { step: 'checking' });

    try {
      const refChunkDocs = await chunkService.getChunksByNodeIds(courseId, referencedChunks);

      const refChunksWithNames = await Promise.all(
        refChunkDocs.map(async (doc) => ({
          nodeId: doc.nodeId,
          name: await chunkService.getNodeName(courseId, doc.nodeId),
          content: doc.content,
        }))
      );

      const retrieverSystemPrompt = buildRetrieverSystemPrompt(
        chunkContext.name,
        chunkContext.content,
        refChunksWithNames
      );

      const retrieverResult = await provider.chat({
        messages: [
          { role: 'system', content: retrieverSystemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        maxTokens: 500,
        responseFormat: 'json',
      });

      const checked = JSON.parse(retrieverResult.content);
      sendSSE(res, 'chat:checked', checked);

      const filtered = checked.chunks?.filter((c: any) => c.relevantExcerpt) || [];
      relevantChunks = await Promise.all(
        filtered.map(async (c: any) => ({
          name: c.name,
          nodeId: c.nodeId,
          isDuplicate: c.isDuplicate,
          treePath: await chunkService.getTreePathForNode(courseId, c.nodeId),
          relevantExcerpt: c.relevantExcerpt,
        }))
      );
    } catch {
      // LLM-2 failure — skip duplicate checking, proceed with empty relevantChunks
    }
  }

  // ===== Step 3: LLM-3 Generator (always runs) =====
  const generatorContext: GeneratorChunkContext = {
    name: chunkContext.name,
    importance: chunkContext.importance,
    treePath: chunkContext.treePath,
    content: chunkContext.content,
    wordCount: chunkContext.wordCount,
    pageWordLimit: chunkContext.pageWordLimit,
  };

  const generatorSystemPrompt = buildGeneratorSystemPrompt(
    generatorContext,
    relevantChunks.length > 0 ? relevantChunks : undefined
  );

  const stream = provider.chatStream({
    messages: [
      { role: 'system', content: generatorSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    maxTokens: 2000,
  });

  let fullContent = '';
  for await (const chunk of stream) {
    fullContent += chunk.content;
    sendSSE(res, 'chat:token', { content: chunk.content });
  }

  sendSSE(res, 'chat:done', { fullContent });
}
