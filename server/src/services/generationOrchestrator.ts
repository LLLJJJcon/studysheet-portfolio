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
import {
  cancellationRegistry,
  throwIfCancelled,
  isCancellation,
  GenerationCancelledError,
} from './cancellationRegistry';
import path from 'path';

const MAX_L1_FILE_CHARS = 15000;
const MAX_L1_TOTAL_CHARS = 60000;
const MAX_L2_SOURCE_CHARS = 28000;
const MAX_TREE_DEPTH = 8;
const MAX_CHILDREN_PER_NODE = 40;

/**
 * Collect the full text from a streaming LLM call with retry on transient errors.
 * Retries up to `retries` times on rate-limit (429), premature close, etc.
 */
export async function streamCollect(
  provider: LLMProvider,
  params: { messages: any[]; responseFormat?: string; temperature?: number },
  retries = 2,
  onChunk?: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  return withRetry(
    async () => {
      let result = '';
      // Threading `signal` into the provider lets the rate-limiter's
      // throttle sleep (once 429 activates it) be interrupted by cancel.
      for await (const chunk of provider.chatStream({ ...(params as any), signal })) {
        // Abort mid-stream if the user cancelled: we stop consuming chunks
        // and bubble the cancellation up so the retry loop won't relaunch.
        throwIfCancelled(signal);
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
      signal,
      onRetry: (attempt, error) => {
        console.log(`LLM stream retry #${attempt}: ${error.message}`);
      },
    }
  );
}

/**
 * Strip reasoning-model preambles like <think>…</think>, <reasoning>…</reasoning>,
 * <analysis>…</analysis>. Also drops an unclosed leading <think> block (streaming
 * that never emitted the closing tag) by cutting at the next JSON/code-fence start.
 */
function stripReasoningBlocks(text: string): string {
  let cleaned = text.replace(/<(think|reasoning|analysis|reflection|scratchpad)>[\s\S]*?<\/\1>/gi, '');

  const openMatch = cleaned.match(/<(think|reasoning|analysis|reflection|scratchpad)>/i);
  if (openMatch && openMatch.index !== undefined) {
    const after = cleaned.slice(openMatch.index);
    const fenceIdx = after.search(/```/);
    const braceIdx = after.search(/[{\[]/);
    const candidates = [fenceIdx, braceIdx].filter((i) => i > 0);
    if (candidates.length > 0) {
      cleaned = cleaned.slice(0, openMatch.index) + after.slice(Math.min(...candidates));
    } else {
      cleaned = cleaned.slice(0, openMatch.index);
    }
  }

  return cleaned.trim();
}

/**
 * Extract JSON from LLM output that may contain markdown code blocks,
 * leading/trailing text, reasoning-model preambles, or other non-JSON content.
 */
export function extractJSON(raw: string): unknown {
  const trimmed = stripReasoningBlocks(raw);
  try {
    return JSON.parse(trimmed);
  } catch { /* continue */ }

  // 2. Try to extract from markdown code block: ```json ... ``` or ``` ... ```
  //    Prefer the last code block (LLMs sometimes quote example input above).
  const codeBlocks = [...trimmed.matchAll(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/g)];
  for (const m of codeBlocks.reverse()) {
    try {
      return JSON.parse(m[1].trim());
    } catch { /* continue */ }
  }

  // 3. Scan for the first balanced { ... } or [ ... ] that actually parses.
  //    Uses a string-aware scanner so braces inside strings don't break balancing.
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch !== '{' && ch !== '[') continue;

    const closeChar = ch === '{' ? '}' : ']';
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let j = i; j < trimmed.length; j++) {
      const c = trimmed[j];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') {
        depth--;
        if (depth === 0) {
          if (c !== closeChar) break;
          try {
            return JSON.parse(trimmed.substring(i, j + 1));
          } catch { /* try next candidate */ }
          break;
        }
      }
    }
  }

  throw new Error('No valid JSON found in response');
}

function collectNodeNames(node: ITreeNode, map: Map<string, string>): void {
  map.set(node.nodeId, node.name);
  for (const ch of node.children || []) collectNodeNames(ch, map);
}

export function truncateForLLM(text: string, maxChars: number): string {
  const normalized = (text || '').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}\n\n[Content truncated due to length]`;
}

export function toSafeNode(node: unknown, depth = 0): Record<string, unknown> {
  const asObj = (node && typeof node === 'object') ? (node as Record<string, unknown>) : {};
  const name = typeof asObj.name === 'string' && asObj.name.trim()
    ? asObj.name.trim()
    : `Topic ${depth + 1}`;

  const result: Record<string, unknown> = { name };

  if (typeof asObj.sourceFile === 'string' && asObj.sourceFile.trim()) {
    result.sourceFile = asObj.sourceFile.trim();
  }

  if (
    asObj.importance === 'High-Frequency' ||
    asObj.importance === 'Important' ||
    asObj.importance === 'Awareness'
  ) {
    result.importance = asObj.importance;
  }

  if (depth < MAX_TREE_DEPTH && Array.isArray(asObj.children)) {
    result.children = asObj.children
      .slice(0, MAX_CHILDREN_PER_NODE)
      .map((ch) => toSafeNode(ch, depth + 1));
  } else {
    result.children = [];
  }

  return result;
}

function buildFallbackTree(courseName: string, files: Array<{ filename: string }>): Record<string, unknown> {
  return {
    name: courseName,
    children: files.map((f) => ({
      name: f.filename,
      importance: 'Important',
      sourceFile: f.filename,
      children: [],
    })),
  };
}

export function assignNodeIds(node: Record<string, unknown>): ITreeNode {
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

export function collectSourceFiles(node: ITreeNode): Set<string> {
  const sources = new Set<string>();
  if (node.sourceFile) sources.add(node.sourceFile);
  for (const child of node.children || []) {
    for (const s of collectSourceFiles(child)) sources.add(s);
  }
  return sources;
}

function propagateSourceFile(node: ITreeNode, sourceFile: string): void {
  if (!node.children || node.children.length === 0) {
    if (!node.sourceFile) node.sourceFile = sourceFile;
    return;
  }
  for (const child of node.children) propagateSourceFile(child, sourceFile);
}

export function stripFileNameNodes(tree: ITreeNode, filenames: string[]): ITreeNode {
  const nameSet = new Set(filenames.map(f => f.toLowerCase().trim()));
  const noExtSet = new Set(filenames.map(f => {
    const dot = f.lastIndexOf('.');
    return (dot > 0 ? f.substring(0, dot) : f).toLowerCase().trim();
  }));

  const newChildren: ITreeNode[] = [];

  for (const child of tree.children || []) {
    const lower = child.name.toLowerCase().trim();
    const isFileNode =
      (nameSet.has(lower) || noExtSet.has(lower)) &&
      child.children &&
      child.children.length > 0;

    if (isFileNode) {
      const sourceFile = child.sourceFile || child.name;
      propagateSourceFile(child, sourceFile);
      for (const grandchild of child.children) {
        newChildren.push(grandchild);
      }
    } else {
      newChildren.push(child);
    }
  }

  return { ...tree, children: newChildren };
}

export function mapLLMErrorToUserMessage(error: unknown): { message: string; retryable: boolean } {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes('insufficient') ||
    lower.includes('account balance') ||
    lower.includes('recharge') ||
    lower.includes('quota exceeded') ||
    lower.includes('billing')
  ) {
    return {
      message: 'LLM provider balance is insufficient. Please recharge/top up your API account and try again.',
      retryable: false,
    };
  }

  if (lower.includes('api key') || lower.includes('authentication') || lower.includes('unauthorized')) {
    return {
      message: 'Invalid API key. Please check your settings.',
      retryable: false,
    };
  }

  if (lower.includes('rate limit') || lower.includes('429')) {
    return {
      message: 'Rate limit exceeded. Please wait and retry.',
      retryable: true,
    };
  }

  return {
    message: raw || 'Generation failed',
    retryable: true,
  };
}

export const generationOrchestrator = {
  async startGeneration(courseId: string, userId: string, res: Response): Promise<void> {
    initSSE(res);

    const controller = cancellationRegistry.register(courseId);
    const { signal } = controller;

    // If the client drops the connection (closes the tab, aborts the fetch)
    // before we've finished, treat it as a cancellation so downstream
    // retries/LLM calls stop immediately.
    const onClose = () => {
      if (!res.writableEnded && !signal.aborted) {
        controller.abort();
      }
    };
    res.on('close', onClose);

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
        content: truncateForLLM(f.extractedText, MAX_L1_FILE_CHARS),
      }));

      // Enforce a global cap so very large uploads do not blow up provider requests.
      let usedChars = 0;
      const filesForL1 = files.map((f) => {
        const remaining = Math.max(0, MAX_L1_TOTAL_CHARS - usedChars);
        if (remaining <= 0) {
          return {
            filename: f.filename,
            content: '[Skipped due to total request size limit]'
          };
        }

        const capped = truncateForLLM(f.content, remaining);
        usedChars += capped.length;
        return { filename: f.filename, content: capped };
      });

      const l1Messages = buildL1Prompt(course.name, filesForL1);

      let fullResponse = '';
      try {
        fullResponse = await streamCollect(
          provider,
          { messages: l1Messages, responseFormat: 'json', temperature: 0.3 },
          2,
          (text) => sendSSE(res, 'l1:chunk', { partialJson: text }),
          signal
        );
      } catch (streamErr) {
        if (isCancellation(streamErr)) throw streamErr;
        console.error('L1 stream failed:', streamErr instanceof Error ? streamErr.message : streamErr);
        const mapped = mapLLMErrorToUserMessage(streamErr);
        sendSSEError(res, mapped.message, mapped.retryable);
        await courseService.updateStatus(courseId, 'created');
        return;
      }

      // Parse L1 output with retry on failure
      let parsedTree: Record<string, unknown>;
      try {
        const parsed = extractJSON(fullResponse) as Record<string, unknown>;
        const rawTree = (parsed.tree as Record<string, unknown>) || parsed;
        parsedTree = toSafeNode(rawTree);
      } catch {
        // Retry once with lower temperature
        sendSSE(res, 'l1:retry', { reason: 'JSON parse failed, retrying...' });
        try {
          fullResponse = await streamCollect(
            provider,
            { messages: l1Messages, responseFormat: 'json', temperature: 0.1 },
            1,
            (text) => sendSSE(res, 'l1:chunk', { partialJson: text }),
            signal
          );
          const parsed = extractJSON(fullResponse) as Record<string, unknown>;
          const rawTree = (parsed.tree as Record<string, unknown>) || parsed;
          parsedTree = toSafeNode(rawTree);
        } catch (retryErr) {
          if (isCancellation(retryErr)) throw retryErr;
          console.error('L1 parse failed. Raw response:', fullResponse.substring(0, 500));
          // Fall back to a minimal tree so downstream stages can still proceed.
          parsedTree = buildFallbackTree(course.name, filesForL1);
          sendSSE(res, 'l1:retry', { reason: 'Using fallback tree due to parse failure.' });
        }
      }

      // Assign UUIDs to all nodes
      const treeWithIds = stripFileNameNodes(
        assignNodeIds(parsedTree),
        filesForL1.map(f => f.filename)
      );

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
      const allContent = truncateForLLM(
        course.files.map((f) => f.extractedText).join('\n\n'),
        MAX_L2_SOURCE_CHARS
      );

      // Get second-level nodes (children of root) for parallel processing
      const secondLevelNodes = treeWithIds.children || [];
      let completedSubtrees = 0;
      const totalSubtrees = secondLevelNodes.length;

      // Process subtrees in parallel (up to 3 concurrent)
      const CONCURRENCY = 3;
      for (let i = 0; i < secondLevelNodes.length; i += CONCURRENCY) {
        throwIfCancelled(signal);
        const batch = secondLevelNodes.slice(i, i + CONCURRENCY);
        const promises = batch.map(async (subtree) => {
          let l2Response = '';
          try {
            // Determine source content for this subtree from leaf sourceFile values
            const subtreeSources = collectSourceFiles(subtree);
            let sourceContentRaw = '';
            if (subtreeSources.size > 0) {
              const parts: string[] = [];
              for (const sf of subtreeSources) {
                const fc = fileContentMap.get(sf);
                if (fc) parts.push(fc);
              }
              sourceContentRaw = parts.length > 0 ? parts.join('\n\n') : allContent;
            } else {
              sourceContentRaw = allContent;
            }

            const sourceContent = truncateForLLM(sourceContentRaw, MAX_L2_SOURCE_CHARS);
            if (!sourceContent.trim()) {
              throw new Error('Source content is empty after truncation');
            }

            const l2Messages = buildL2Prompt(course.name, sourceContent, subtree);

            l2Response = await streamCollect(
              provider,
              { messages: l2Messages, responseFormat: 'json', temperature: 0.3 },
              2,
              (text) => { sendSSE(res, 'l2:chunk', { text }); },
              signal
            );

            // Parse L2 output
            const parsed = extractJSON(l2Response) as Record<string, unknown>;
            const chunks = Array.isArray(parsed.chunks)
              ? (parsed.chunks as Array<{ node_id: string; content: string; word_count?: number; source_start?: string; source_end?: string }>)
              : [];

            // Save each chunk to DB
            for (const c of chunks) {
              const leafNode = findNodeById(subtree, c.node_id);
              const importance = leafNode?.importance || 'Important';

              const leafSourceFile = leafNode?.sourceFile;
              await chunkService.upsertChunk(
                courseId,
                c.node_id,
                typeof c.content === 'string' ? c.content : '',
                c.word_count || 0,
                importance,
                c.source_start || '',
                c.source_end || '',
                leafSourceFile ? [leafSourceFile] : undefined
              );
            }

            completedSubtrees++;
            sendSSE(res, 'l2:subtree-complete', {
              subtreeName: subtree.name,
              chunkCount: chunks.length,
              progress: completedSubtrees / Math.max(totalSubtrees, 1),
            });
          } catch (err) {
            console.error(`L2 failed for subtree "${subtree.name}":`, err instanceof Error ? err.message : err);
            console.error(`L2 raw response (first 500 chars):`, l2Response?.substring(0, 500) || '<empty>');
            completedSubtrees++;
            sendSSE(res, 'l2:subtree-error', {
              subtreeName: subtree.name,
              progress: completedSubtrees / Math.max(totalSubtrees, 1),
            });
          }
        });

        await Promise.allSettled(promises);
        // If any worker bailed out because of a cancellation, stop before the
        // next batch (otherwise we'd keep firing LLM calls despite the abort).
        throwIfCancelled(signal);
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
          throwIfCancelled(signal);
          try {
            const retrySources = collectSourceFiles(subtree);
            let retrySourceRaw = '';
            if (retrySources.size > 0) {
              const parts: string[] = [];
              for (const sf of retrySources) {
                const fc = fileContentMap.get(sf);
                if (fc) parts.push(fc);
              }
              retrySourceRaw = parts.length > 0 ? parts.join('\n\n') : allContent;
            } else {
              retrySourceRaw = allContent;
            }
            const sourceContent = truncateForLLM(retrySourceRaw, MAX_L2_SOURCE_CHARS);
            const l2Messages = buildL2Prompt(course.name, sourceContent, subtree);
            const l2Retry = await streamCollect(
              provider,
              { messages: l2Messages, responseFormat: 'json', temperature: 0.1 },
              1,
              undefined,
              signal
            );
            const parsed = extractJSON(l2Retry) as Record<string, unknown>;
            const chunks = Array.isArray(parsed.chunks)
              ? (parsed.chunks as Array<{ node_id: string; content: string; word_count?: number; source_start?: string; source_end?: string }>)
              : [];
            for (const c of chunks) {
              if (nodeIds.includes(c.node_id)) {
                const leafNode = findNodeById(subtree, c.node_id);
                const importance = leafNode?.importance || 'Important';
                const leafSourceFile = leafNode?.sourceFile;
                await chunkService.upsertChunk(
                  courseId,
                  c.node_id,
                  typeof c.content === 'string' ? c.content : '',
                  c.word_count || 0,
                  importance,
                  c.source_start || '',
                  c.source_end || '',
                  leafSourceFile ? [leafSourceFile] : undefined
                );
              }
            }
          } catch (e) {
            if (isCancellation(e)) throw e;
            console.error(`L2 retry failed for subtree ${subtree.name}:`, e);
          }
        }
      }

      const totalWords = await chunkService.getTotalWordCount(courseId);
      const allChunksAfterL2 = await chunkService.getChunksByCourse(courseId);
      console.log(`[L2 complete] Total chunks: ${allChunksAfterL2.length}, total words: ${totalWords}`);

      if (allChunksAfterL2.length === 0) {
        console.error('[L2] No chunks generated after L2 + reconciliation. Aborting pipeline.');
        sendSSE(res, 'l2:complete', { totalWordCount: 0 });
        sendSSEError(res, 'Failed to generate content chunks. The LLM did not return valid JSON. Please check your LLM provider settings or try a different model.', true);
        await courseService.updateStatus(courseId, 'created');
        return;
      }

      sendSSE(res, 'l2:complete', { totalWordCount: totalWords });
      throwIfCancelled(signal);

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
            },
            signal
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
      throwIfCancelled(signal);
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
        provider,
        signal
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
            sourceFiles: (chunkData as any)?.sourceFiles || [],
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
      if (isCancellation(error)) {
        console.log(`[generation] cancelled for course ${courseId}`);
        try {
          sendSSE(res, 'cancelled', { message: 'Generation cancelled by user' });
          endSSE(res);
        } catch { /* client already gone */ }
        await courseService.updateStatus(courseId, 'created').catch(() => {});
      } else {
        console.error('Generation error:', error);
        const mapped = mapLLMErrorToUserMessage(error);
        sendSSEError(res, mapped.message, mapped.retryable);
        await courseService.updateStatus(courseId, 'created').catch(() => {});
      }
    } finally {
      res.off('close', onClose);
      cancellationRegistry.release(courseId);
    }
  },
};
