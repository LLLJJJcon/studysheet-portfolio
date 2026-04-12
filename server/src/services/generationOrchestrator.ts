import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { User, IUser } from '../models/User';
import { Course } from '../models/Course';
import { ContentTree, ITreeNode } from '../models/ContentTree';
import { createProvider } from '../llm/ProviderFactory';
import { LLMProvider } from '../llm/LLMProvider';
import { buildL1Prompt } from '../llm/prompts/L1_treeGeneration';
import { buildL2Prompt } from '../llm/prompts/L2_chunkGeneration';
import { initSSE, sendSSE, endSSE, sendSSEError } from '../utils/sseHelper';
import { courseService } from './courseService';
import { chunkService } from './chunkService';
import { compressionService } from './compressionService';
import { layoutService } from './layoutService';
import { fileParserService } from './fileParserService';
import { calculateFontSize, getLineHeight } from '../utils/fontSizeCalc';
import { withRetry } from '../middleware/errorHandler';
import path from 'path';

/**
 * Collect the full text from a streaming LLM call with retry on transient errors.
 * Retries up to `retries` times on rate-limit (429), premature close, etc.
 */
async function streamCollect(
  provider: LLMProvider,
  params: { messages: any[]; responseFormat?: string; temperature?: number },
  retries = 2,
  onChunk?: (text: string) => void
): Promise<string> {
  return withRetry(
    async () => {
      let result = '';
      for await (const chunk of provider.chatStream(params as any)) {
        if (chunk.content) {
          result += chunk.content;
          onChunk?.(chunk.content);
        }
      }
      return result;
    },
    {
      maxRetries: retries,
      baseDelay: 2000,
      onRetry: (attempt, error) => {
        console.log(`LLM stream retry #${attempt}: ${error.message}`);
      },
    }
  );
}

/**
 * Extract JSON from LLM output that may contain markdown code blocks,
 * leading/trailing text, or other non-JSON content.
 */
export function extractJSON(raw: string): unknown {
  // 1. Try direct parse first
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch { /* continue */ }

  // 2. Try to extract from markdown code block: ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch { /* continue */ }
  }

  // 3. Try to find the outermost { ... } or [ ... ]
  let start = trimmed.indexOf('{');
  const startArr = trimmed.indexOf('[');
  if (startArr !== -1 && (start === -1 || startArr < start)) start = startArr;
  if (start !== -1) {
    const isArray = trimmed[start] === '[';
    const closeChar = isArray ? ']' : '}';
    let depth = 0;
    let end = -1;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end !== -1) {
      try {
        return JSON.parse(trimmed.substring(start, end + 1));
      } catch { /* continue */ }
    }
  }

  throw new Error('No valid JSON found in response');
}

function collectNodeNames(node: ITreeNode, map: Map<string, string>): void {
  map.set(node.nodeId, node.name);
  for (const ch of node.children || []) collectNodeNames(ch, map);
}

function assignNodeIds(node: Record<string, unknown>): ITreeNode {
  const result: ITreeNode = {
    nodeId: uuidv4(),
    name: (node.name as string) || '',
    children: [],
  };

  if (node.sourceFile) {
    result.sourceFile = node.sourceFile as string;
  }
  if (node.importance) {
    result.importance = node.importance as ITreeNode['importance'];
  }
  if (Array.isArray(node.children)) {
    result.children = node.children.map((child: Record<string, unknown>) =>
      assignNodeIds(child)
    );
  }

  return result;
}

function findNodeById(node: ITreeNode, nodeId: string): ITreeNode | null {
  if (node.nodeId === nodeId) return node;
  for (const child of node.children || []) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

export const generationOrchestrator = {
  async startGeneration(courseId: string, userId: string, res: Response): Promise<void> {
    initSSE(res);

    try {
      // Get user and course
      const user = await User.findById(userId);
      if (!user) {
        sendSSEError(res, 'User not found', false);
        return;
      }

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) {
        sendSSEError(res, 'Course not found', false);
        return;
      }

      if (course.files.length === 0) {
        sendSSEError(res, 'No files uploaded. Please upload course materials first.', false);
        return;
      }

      // Update course status
      await courseService.updateStatus(courseId, 'generating');

      // Re-extract text for files with empty/very short extracted text
      const uploadsDir = path.resolve(__dirname, '../../uploads');
      for (const f of course.files) {
        if ((f.extractedText || '').trim().length <= 10) {
          console.log(`Re-extracting text for ${f.originalName} (current length: ${(f.extractedText||'').length})`);
          const filePath = path.join(uploadsDir, f.filename);
          const newText = await fileParserService.parseFile(filePath, f.mimeType);
          if (newText.trim().length > 10) {
            f.extractedText = newText;
            await Course.updateOne(
              { _id: courseId, 'files.fileId': f.fileId },
              { $set: { 'files.$.extractedText': newText } }
            );
            console.log(`Re-extracted ${newText.length} chars for ${f.originalName}`);
          }
        }
      }

      // Create LLM provider
      const provider = createProvider(user);

      // ----- L1: Generate global exam-point tree -----
      sendSSE(res, 'l1:start', {});

      const files = course.files.map((f) => ({
        filename: f.originalName,
        content: f.extractedText,
      }));

      const l1Messages = buildL1Prompt(course.name, files);

      let fullResponse = '';
      try {
        fullResponse = await streamCollect(
          provider,
          { messages: l1Messages, responseFormat: 'json', temperature: 0.3 },
          2,
          (text) => sendSSE(res, 'l1:chunk', { partialJson: text })
        );
      } catch (streamErr) {
        console.error('L1 stream failed:', streamErr instanceof Error ? streamErr.message : streamErr);
        sendSSEError(res, 'LLM stream failed during tree generation. Please try again.', true);
        await courseService.updateStatus(courseId, 'created');
        return;
      }

      // Parse L1 output with retry on failure
      let parsedTree: Record<string, unknown>;
      try {
        const parsed = extractJSON(fullResponse) as Record<string, unknown>;
        parsedTree = (parsed.tree as Record<string, unknown>) || parsed;
      } catch {
        // Retry once with lower temperature
        sendSSE(res, 'l1:retry', { reason: 'JSON parse failed, retrying...' });
        try {
          fullResponse = await streamCollect(
            provider,
            { messages: l1Messages, responseFormat: 'json', temperature: 0.1 },
            1,
            (text) => sendSSE(res, 'l1:chunk', { partialJson: text })
          );
          const parsed = extractJSON(fullResponse) as Record<string, unknown>;
          parsedTree = (parsed.tree as Record<string, unknown>) || parsed;
        } catch (retryErr) {
          console.error('L1 parse failed. Raw response:', fullResponse.substring(0, 500));
          sendSSEError(res, 'Failed to parse L1 output after retry. Please try again.', true);
          await courseService.updateStatus(courseId, 'created');
          return;
        }
      }

      // Assign UUIDs to all nodes
      const treeWithIds = assignNodeIds(parsedTree);

      // Save to MongoDB
      await ContentTree.findOneAndUpdate(
        { courseId },
        { tree: treeWithIds },
        { upsert: true, new: true }
      );

      sendSSE(res, 'l1:complete', { tree: treeWithIds });

      // ----- L2: Generate chunks per second-level subtree -----
      sendSSE(res, 'l2:start', {});

      // Clear old chunks from any previous generation
      await chunkService.deleteChunksByCourse(courseId);

      // Collect course file content map
      const fileContentMap = new Map<string, string>();
      for (const f of course.files) {
        fileContentMap.set(f.originalName, f.extractedText);
      }
      const allContent = course.files.map((f) => f.extractedText).join('\n\n');

      // Get second-level nodes (children of root) for parallel processing
      const secondLevelNodes = treeWithIds.children || [];
      let completedSubtrees = 0;
      const totalSubtrees = secondLevelNodes.length;

      // Process subtrees in parallel (up to 3 concurrent)
      const CONCURRENCY = 3;
      for (let i = 0; i < secondLevelNodes.length; i += CONCURRENCY) {
        const batch = secondLevelNodes.slice(i, i + CONCURRENCY);
        const promises = batch.map(async (subtree) => {
          try {
            // Determine source content for this subtree
            const sourceContent = subtree.sourceFile
              ? fileContentMap.get(subtree.sourceFile) || allContent
              : allContent;

            const l2Messages = buildL2Prompt(course.name, sourceContent, subtree);

            const l2Response = await streamCollect(
              provider,
              { messages: l2Messages, responseFormat: 'json', temperature: 0.3 },
              2,
              (text) => { sendSSE(res, 'l2:chunk', { text }); }
            );

            // Parse L2 output
            const parsed = extractJSON(l2Response) as Record<string, unknown>;
            const chunks = (parsed.chunks || []) as Array<{ node_id: string; content: string; word_count?: number; source_start?: string; source_end?: string }>;

            // Save each chunk to DB
            for (const c of chunks) {
              const leafNode = findNodeById(subtree, c.node_id);
              const importance = leafNode?.importance || 'Important';

              await chunkService.upsertChunk(
                courseId,
                c.node_id,
                c.content,
                c.word_count || 0,
                importance,
                c.source_start || '',
                c.source_end || ''
              );
            }

            completedSubtrees++;
            sendSSE(res, 'l2:subtree-complete', {
              subtreeName: subtree.name,
              chunkCount: chunks.length,
              progress: completedSubtrees / totalSubtrees,
            });
          } catch (err) {
            console.error(`L2 failed for subtree "${subtree.name}":`, err instanceof Error ? err.message : err);
            completedSubtrees++;
            sendSSE(res, 'l2:subtree-error', {
              subtreeName: subtree.name,
              progress: completedSubtrees / totalSubtrees,
            });
          }
        });

        await Promise.allSettled(promises);
      }

      // ── L2 reconciliation: retry missing leaf chunks ──
      const allLeafIds: Array<{ nodeId: string; subtree: ITreeNode }> = [];
      function collectLeaves(node: ITreeNode, root: ITreeNode) {
        if (!node.children || node.children.length === 0) {
          allLeafIds.push({ nodeId: node.nodeId, subtree: root });
        }
        for (const ch of node.children || []) collectLeaves(ch, root);
      }
      for (const sub of secondLevelNodes) collectLeaves(sub, sub);

      const existingChunks = await chunkService.getChunksByCourse(courseId);
      const existingIds = new Set(existingChunks.map(c => c.nodeId));
      const missing = allLeafIds.filter(l => !existingIds.has(l.nodeId));

      if (missing.length > 0) {
        console.log(`L2 reconciliation: ${missing.length} missing chunks, retrying...`);
        // Group missing by subtree and retry each subtree
        const missingBySubtree = new Map<string, { subtree: ITreeNode; nodeIds: string[] }>();
        for (const m of missing) {
          const key = m.subtree.nodeId;
          if (!missingBySubtree.has(key)) missingBySubtree.set(key, { subtree: m.subtree, nodeIds: [] });
          missingBySubtree.get(key)!.nodeIds.push(m.nodeId);
        }

        for (const { subtree, nodeIds } of missingBySubtree.values()) {
          try {
            const sourceContent = subtree.sourceFile
              ? fileContentMap.get(subtree.sourceFile) || allContent
              : allContent;
            const l2Messages = buildL2Prompt(course.name, sourceContent, subtree);
            const l2Retry = await streamCollect(
              provider,
              { messages: l2Messages, responseFormat: 'json', temperature: 0.1 },
              1
            );
            const parsed = extractJSON(l2Retry) as Record<string, unknown>;
            const chunks = (parsed.chunks || []) as Array<{ node_id: string; content: string; word_count?: number; source_start?: string; source_end?: string }>;
            for (const c of chunks) {
              if (nodeIds.includes(c.node_id)) {
                const leafNode = findNodeById(subtree, c.node_id);
                const importance = leafNode?.importance || 'Important';
                await chunkService.upsertChunk(courseId, c.node_id, c.content, c.word_count || 0, importance, c.source_start || '', c.source_end || '');
              }
            }
          } catch (e) {
            console.error(`L2 retry failed for subtree ${subtree.name}:`, e);
          }
        }
      }

      const totalWords = await chunkService.getTotalWordCount(courseId);
      sendSSE(res, 'l2:complete', { totalWordCount: totalWords });

      // ----- L3: Compression (serial: Awareness → Important → High-Frequency) -----
      const wordLimit = course.pageConfig.wordLimit;
      const threshold = wordLimit * 1.1;

      if (totalWords > threshold) {
        const { totalWords: compressedTotal, compressed } =
          await compressionService.compressChunks(
            courseId,
            wordLimit,
            provider,
            (result, level) => {
              sendSSE(res, 'l3:compressed', {
                nodeId: result.nodeId,
                content: result.content,
                wordCount: result.compressedWords,
                originalWords: result.originalWords,
              });
            },
            (level) => {
              sendSSE(res, 'l3:start', { level });
            },
            (level) => {
              sendSSE(res, 'l3:level-complete', { level });
            }
          );

        sendSSE(res, 'l3:complete', {
          totalWordCount: compressedTotal,
          wasCompressed: compressed,
        });
      } else {
        sendSSE(res, 'l3:complete', {
          totalWordCount: totalWords,
          wasCompressed: false,
        });
      }

      // L3 complete - determine final word count
      const finalWordCount = await chunkService.getTotalWordCount(courseId);

      // ----- Font Size Calculation -----
      const fontSize = course.pageConfig.fontSize
        ? course.pageConfig.fontSize
        : calculateFontSize(finalWordCount, wordLimit);
      const lineHeight = getLineHeight(fontSize);

      // ----- L4: Initial Layout Generation -----
      sendSSE(res, 'l4:start', { fontSize, lineHeight });

      const allChunks = await chunkService.getChunksByCourse(courseId);
      const layout = await layoutService.generateLayout(
        courseId,
        allChunks,
        treeWithIds,
        {
          size: course.pageConfig.size,
          width: course.pageConfig.width,
          height: course.pageConfig.height,
          pages: course.pageConfig.pages,
          columns: (course.pageConfig as any).columns,
        },
        fontSize,
        lineHeight,
        provider
      );

      // Enrich containers with chunk content for client rendering
      const chunkMap = new Map(allChunks.map((c) => [c.nodeId, c]));
      const nodeNames = new Map<string, string>();
      collectNodeNames(treeWithIds, nodeNames);
      const enrichedContainers = layout.containers.map((container) => ({
        id: container.id,
        parentNodeId: container.parentNodeId,
        title: container.title,
        page: container.page,
        x: container.x,
        y: container.y,
        width: container.width,
        height: container.height,
        chunks: container.chunks.map((chunk) => {
          const chunkData = chunkMap.get(chunk.nodeId);
          return {
            nodeId: chunk.nodeId,
            x: chunk.x,
            y: chunk.y,
            width: chunk.width,
            height: chunk.height,
            content: chunkData?.content || '',
            importance: chunkData?.importance || 'Important',
            name: nodeNames.get(chunk.nodeId) || '',
          };
        }),
      }));

      sendSSE(res, 'l4:complete', {
        layout: {
          fontSize: layout.fontSize,
          lineHeight: layout.lineHeight,
          containers: enrichedContainers,
        },
      });

      await courseService.updateStatus(courseId, 'editing');

      endSSE(res);
    } catch (error) {
      console.error('Generation error:', error);
      const message = error instanceof Error ? error.message : 'Generation failed';

      // Check for common LLM errors
      if (message.includes('API key') || message.includes('authentication')) {
        sendSSEError(res, 'Invalid API key. Please check your settings.', false);
      } else if (message.includes('rate limit') || message.includes('429')) {
        sendSSEError(res, 'Rate limit exceeded. Please wait and retry.', true);
      } else {
        sendSSEError(res, message, true);
      }

      await courseService.updateStatus(courseId, 'created').catch(() => {});
    }
  },
};
