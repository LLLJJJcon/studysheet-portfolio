import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { User, IUser } from '../models/User';
import { Course } from '../models/Course';
import { ContentTree, ITreeNode } from '../models/ContentTree';
import { Layout } from '../models/Layout';
import { Chunk } from '../models/Chunk';
import { createProvider } from '../llm/ProviderFactory';
import { LLMProvider } from '../llm/LLMProvider';
import { buildL1Prompt } from '../llm/prompts/L1_treeGeneration';
import { buildL2Prompt } from '../llm/prompts/L2_chunkGeneration';
import { buildMergeTreeDiffPrompt } from '../llm/prompts/MergeTreeDiff';
import { buildMergeChunkContentPrompt } from '../llm/prompts/MergeChunkContent';
import {
  streamCollect,
  extractJSON,
  toSafeNode,
  assignNodeIds,
  truncateForLLM,
  mapLLMErrorToUserMessage,
} from './generationOrchestrator';
import { validateMergeOperations, MergeOperation } from './mergeValidator';
import { initSSE, sendSSE, endSSE, sendSSEError } from '../utils/sseHelper';
import { courseService } from './courseService';
import { chunkService } from './chunkService';
import { layoutService } from './layoutService';
import { versionService } from './versionService';
import { calculateFontSize, getLineHeight } from '../utils/fontSizeCalc';

const MAX_L1_FILE_CHARS = 15000;
const MAX_L1_TOTAL_CHARS = 60000;
const MAX_L2_SOURCE_CHARS = 28000;
const MAX_TREE_SERIALIZATION_CHARS = 30000;
const MAX_STAGE3_RETRIES = 3;
const MAX_STAGE5_RETRIES = 3;
const L2_CONCURRENCY = 3;

interface TempChunk {
  nodeId: string;
  content: string;
  wordCount: number;
  importance: string;
  sourceFile: string;
}

function serializeTreeStructure(node: ITreeNode, depth = 0): string {
  const indent = '  '.repeat(depth);
  let line = `${indent}- ${node.name} (id: ${node.nodeId})`;
  if (node.importance) line += ` [${node.importance}]`;
  line += '\n';
  for (const child of node.children || []) {
    line += serializeTreeStructure(child, depth + 1);
  }
  return line;
}

function findNodeById(node: ITreeNode, nodeId: string): ITreeNode | null {
  if (node.nodeId === nodeId) return node;
  for (const child of node.children || []) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

function collectLeaves(node: ITreeNode, leaves: ITreeNode[]): void {
  if (!node.children || node.children.length === 0) {
    leaves.push(node);
    return;
  }
  for (const child of node.children || []) collectLeaves(child, leaves);
}

function collectNodeNames(node: ITreeNode, map: Map<string, string>): void {
  map.set(node.nodeId, node.name);
  for (const ch of node.children || []) collectNodeNames(ch, map);
}

function deepCloneTree(node: ITreeNode): ITreeNode {
  return {
    nodeId: node.nodeId,
    name: node.name,
    sourceFile: node.sourceFile,
    importance: node.importance,
    children: (node.children || []).map(deepCloneTree),
  };
}

function reassignIds(node: ITreeNode, idMap: Map<string, string>): ITreeNode {
  const newId = uuidv4();
  idMap.set(node.nodeId, newId);
  return {
    ...node,
    nodeId: newId,
    children: (node.children || []).map(child => reassignIds(child, idMap)),
  };
}

function insertNodeUnderParent(
  tree: ITreeNode,
  parentId: string,
  newNode: ITreeNode,
  refSiblingId?: string,
  position: 'before' | 'after' = 'after'
): boolean {
  if (tree.nodeId === parentId) {
    if (!tree.children) tree.children = [];
    if (!refSiblingId) {
      tree.children.push(newNode);
    } else {
      const idx = tree.children.findIndex(c => c.nodeId === refSiblingId);
      if (idx === -1) {
        tree.children.push(newNode);
      } else {
        const insertIdx = position === 'before' ? idx : idx + 1;
        tree.children.splice(insertIdx, 0, newNode);
      }
    }
    return true;
  }
  for (const child of tree.children || []) {
    if (insertNodeUnderParent(child, parentId, newNode, refSiblingId, position)) {
      return true;
    }
  }
  return false;
}

export const incrementalMergeService = {
  async startMerge(
    courseId: string,
    userId: string,
    newFileIds: string[],
    res: Response
  ): Promise<void> {
    initSSE(res);

    try {
      const user = await User.findById(userId);
      if (!user) { sendSSEError(res, 'User not found', false); return; }

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) { sendSSEError(res, 'Course not found', false); return; }

      if (course.status === 'generating') {
        sendSSEError(res, 'A generation or merge is already in progress.', false);
        return;
      }

      const existingTreeDoc = await ContentTree.findOne({ courseId });
      if (!existingTreeDoc) {
        sendSSEError(res, 'No existing content tree. Please run Full Regenerate first.', false);
        return;
      }

      // Incremental merge only makes sense when the previous generation actually
      // produced content chunks (and ideally a layout). Otherwise tell the user
      // to run Full Regenerate first — previous runs may have failed at L2.
      const [existingLayout, chunkCount] = await Promise.all([
        Layout.findOne({ courseId }),
        Chunk.countDocuments({ courseId }),
      ]);

      if (chunkCount === 0 || !existingLayout) {
        sendSSEError(
          res,
          'Initial generation has not finished successfully (no content chunks yet). Please click "Full Regenerate" to complete the first pass before merging new files.',
          false
        );
        return;
      }

      // Self-heal: if status got stuck on e.g. 'created' after a crash but
      // everything is actually in place, bump it back to 'editing'.
      if (course.status !== 'editing') {
        course.status = 'editing';
        await courseService.updateStatus(courseId, 'editing').catch(() => {});
      }

      const newFiles = course.files.filter(f => newFileIds.includes(f.fileId));
      if (newFiles.length === 0) {
        sendSSEError(res, 'No matching new files found.', false);
        return;
      }

      // ── Stage 1.5: Pre-validation ──
      const filesWithContent = newFiles.filter(f => (f.extractedText || '').trim().length > 10);
      if (filesWithContent.length === 0) {
        sendSSEError(res, 'Uploaded files contain no extractable text. Please check the file format and try again.', false);
        return;
      }

      const existingTree = existingTreeDoc.tree;
      const serializedExisting = serializeTreeStructure(existingTree);
      if (serializedExisting.length > MAX_TREE_SERIALIZATION_CHARS) {
        sendSSEError(res, 'Content tree is too large for incremental merge. Please consider regenerating.', false);
        return;
      }

      await courseService.updateStatus(courseId, 'generating');
      sendSSE(res, 'merge:start', {});

      const provider = createProvider(user);

      // ── Stage 2: Independent generation for new files ──
      sendSSE(res, 'merge:new-generation-start', {});

      const l1Files = filesWithContent.map(f => ({
        filename: f.originalName,
        content: truncateForLLM(f.extractedText, MAX_L1_FILE_CHARS),
      }));

      let usedChars = 0;
      const cappedFiles = l1Files.map(f => {
        const remaining = Math.max(0, MAX_L1_TOTAL_CHARS - usedChars);
        if (remaining <= 0) return { filename: f.filename, content: '[Skipped due to total request size limit]' };
        const capped = truncateForLLM(f.content, remaining);
        usedChars += capped.length;
        return { filename: f.filename, content: capped };
      });

      const l1Messages = buildL1Prompt(course.name, cappedFiles);
      let l1Response = '';
      try {
        l1Response = await streamCollect(
          provider,
          { messages: l1Messages, responseFormat: 'json', temperature: 0.3 },
          2
        );
      } catch (err) {
        const mapped = mapLLMErrorToUserMessage(err);
        sendSSEError(res, mapped.message, mapped.retryable);
        await courseService.updateStatus(courseId, 'editing');
        return;
      }

      let tempTreeRaw: Record<string, unknown>;
      try {
        const parsed = extractJSON(l1Response) as Record<string, unknown>;
        const rawTree = (parsed.tree as Record<string, unknown>) || parsed;
        tempTreeRaw = toSafeNode(rawTree);
      } catch {
        sendSSEError(res, 'Failed to parse new file tree structure from LLM.', true);
        await courseService.updateStatus(courseId, 'editing');
        return;
      }

      const tempTree = assignNodeIds(tempTreeRaw);

      // L2: generate chunks for new files (in memory)
      const tempChunks = new Map<string, TempChunk>();
      const fileContentMap = new Map<string, string>();
      for (const f of filesWithContent) {
        fileContentMap.set(f.originalName, f.extractedText);
      }
      const allNewContent = truncateForLLM(
        filesWithContent.map(f => f.extractedText).join('\n\n'),
        MAX_L2_SOURCE_CHARS
      );

      const secondLevelNodes = tempTree.children || [];
      for (let i = 0; i < secondLevelNodes.length; i += L2_CONCURRENCY) {
        const batch = secondLevelNodes.slice(i, i + L2_CONCURRENCY);
        const promises = batch.map(async (subtree) => {
          try {
            const sourceRaw = subtree.sourceFile
              ? fileContentMap.get(subtree.sourceFile) || allNewContent
              : allNewContent;
            const sourceContent = truncateForLLM(sourceRaw, MAX_L2_SOURCE_CHARS);
            if (!sourceContent.trim()) return;

            const l2Messages = buildL2Prompt(course.name, sourceContent, subtree);
            const l2Response = await streamCollect(
              provider,
              { messages: l2Messages, responseFormat: 'json', temperature: 0.3 },
              2
            );

            const parsed = extractJSON(l2Response) as Record<string, unknown>;
            const chunks = Array.isArray(parsed.chunks) ? parsed.chunks as Array<{
              node_id: string; content: string; word_count?: number;
            }> : [];

            for (const c of chunks) {
              const leafNode = findNodeById(subtree, c.node_id);
              const importance = leafNode?.importance || 'Important';
              const sourceFile = subtree.sourceFile || filesWithContent[0]?.originalName || '';
              tempChunks.set(c.node_id, {
                nodeId: c.node_id,
                content: typeof c.content === 'string' ? c.content : '',
                wordCount: typeof c.content === 'string' ? c.content.length : 0,
                importance,
                sourceFile,
              });
            }
          } catch (err) {
            console.error(`Incremental L2 failed for subtree "${subtree.name}":`, err);
          }
        });
        await Promise.allSettled(promises);
      }

      if (tempChunks.size === 0) {
        sendSSEError(res, 'Failed to generate content for new files. Please try again.', true);
        await courseService.updateStatus(courseId, 'editing');
        return;
      }

      sendSSE(res, 'merge:new-generation-complete', {
        nodeCount: secondLevelNodes.length,
        chunkCount: tempChunks.size,
      });

      // ── Stage 3: Tree Diff & Merge Plan ──
      sendSSE(res, 'merge:diff-start', {});

      const diffMessages = buildMergeTreeDiffPrompt(course.name, existingTree, tempTree);
      let operations: MergeOperation[] = [];
      let diffSuccess = false;

      for (let attempt = 0; attempt < MAX_STAGE3_RETRIES; attempt++) {
        try {
          const diffResponse = await streamCollect(
            provider,
            { messages: diffMessages, responseFormat: 'json', temperature: 0.2 },
            1
          );
          const parsed = extractJSON(diffResponse);

          // Stage 4: Validate
          const validation = validateMergeOperations(parsed, existingTree, tempTree);
          if (validation.valid) {
            operations = validation.operations;
            diffSuccess = true;
            break;
          } else {
            console.warn(`Merge validation attempt ${attempt + 1} failed:`, validation.errors);
          }
        } catch (err) {
          console.warn(`Merge diff attempt ${attempt + 1} error:`, err);
        }
      }

      if (!diffSuccess) {
        sendSSEError(res, 'Failed to generate a valid merge plan after 3 attempts. Please try again.', true);
        await courseService.updateStatus(courseId, 'editing');
        return;
      }

      sendSSE(res, 'merge:diff-complete', {
        operations: operations.map(op => ({ op: op.op, new_node_id: op.new_node_id })),
      });

      // ── Stage 5: Content Merge (for merge_chunk operations) ──
      const mergeOps = operations.filter(op => op.op === 'merge_chunk');
      const mergedContents = new Map<string, string>();

      if (mergeOps.length > 0) {
        sendSSE(res, 'merge:content-merge-start', { count: mergeOps.length });

        for (let mi = 0; mi < mergeOps.length; mi++) {
          const mop = mergeOps[mi];
          const existingChunk = await chunkService.getChunksByNodeIds(courseId, [mop.existing_node_id!]);
          const existingContent = existingChunk[0]?.content || '';
          const newChunk = tempChunks.get(mop.new_node_id);
          const newContent = newChunk?.content || '';
          const existingNode = findNodeById(existingTree, mop.existing_node_id!);
          const nodeName = existingNode?.name || '';
          const importance = existingNode?.importance || 'Important';

          let merged: string | null = null;
          const mergeMessages = buildMergeChunkContentPrompt(existingContent, newContent, nodeName, importance);

          for (let attempt = 0; attempt < MAX_STAGE5_RETRIES; attempt++) {
            try {
              const mergeResponse = await streamCollect(
                provider,
                { messages: mergeMessages, temperature: 0.3 },
                1
              );
              if (mergeResponse.trim().length > 0) {
                merged = mergeResponse.trim();
                break;
              }
            } catch (err) {
              console.warn(`Content merge attempt ${attempt + 1} failed for ${mop.existing_node_id}:`, err);
            }
          }

          if (merged) {
            mergedContents.set(mop.existing_node_id!, merged);
          }

          sendSSE(res, 'merge:content-merge-progress', {
            completed: mi + 1,
            total: mergeOps.length,
          });
        }
      }

      // ── Stage 6: Execute Merge ──
      sendSSE(res, 'merge:executing', {});

      const mergedTree = deepCloneTree(existingTree);

      for (const op of operations) {
        if (op.op === 'add_node') {
          const srcNode = findNodeById(tempTree, op.new_node_id);
          if (!srcNode) continue;
          const newId = uuidv4();
          const newNode: ITreeNode = {
            nodeId: newId,
            name: srcNode.name,
            importance: srcNode.importance,
            children: [],
          };
          insertNodeUnderParent(mergedTree, op.target_parent_id!, newNode, op.ref_sibling_id, op.position || 'after');

          const tc = tempChunks.get(op.new_node_id);
          if (tc) {
            await chunkService.upsertChunk(
              courseId, newId, tc.content, tc.content.length,
              tc.importance, '', '', [tc.sourceFile]
            );
          }
        } else if (op.op === 'add_subtree') {
          const srcNode = findNodeById(tempTree, op.new_node_id);
          if (!srcNode) continue;
          const idMap = new Map<string, string>();
          const newSubtree = reassignIds(srcNode, idMap);
          insertNodeUnderParent(mergedTree, op.target_parent_id!, newSubtree, op.ref_sibling_id, op.position || 'after');

          const leaves: ITreeNode[] = [];
          collectLeaves(newSubtree, leaves);
          for (const leaf of leaves) {
            const oldId = [...idMap.entries()].find(([, v]) => v === leaf.nodeId)?.[0];
            const tc = oldId ? tempChunks.get(oldId) : null;
            if (tc) {
              await chunkService.upsertChunk(
                courseId, leaf.nodeId, tc.content, tc.content.length,
                tc.importance, '', '', [tc.sourceFile]
              );
            }
          }
        } else if (op.op === 'merge_chunk') {
          const merged = mergedContents.get(op.existing_node_id!);
          if (merged) {
            const tc = tempChunks.get(op.new_node_id);
            const existingChunks = await chunkService.getChunksByNodeIds(courseId, [op.existing_node_id!]);
            const existingSourceFiles = (existingChunks[0] as any)?.sourceFiles || [];
            const existingNodeInTree = findNodeById(existingTree, op.existing_node_id!);
            const originalSourceFile = existingNodeInTree?.sourceFile || '';

            let sources = [...existingSourceFiles];
            if (sources.length === 0 && originalSourceFile) {
              sources.push(originalSourceFile);
            }
            if (tc?.sourceFile && !sources.includes(tc.sourceFile)) {
              sources.push(tc.sourceFile);
            }

            await chunkService.upsertChunk(
              courseId, op.existing_node_id!, merged, merged.length,
              existingChunks[0]?.importance || 'Important',
              existingChunks[0]?.sourceStart || '',
              existingChunks[0]?.sourceEnd || '',
              sources
            );
          }
        }
        // discard: no action
      }

      // Persist merged tree
      await ContentTree.findOneAndUpdate(
        { courseId },
        { tree: mergedTree },
        { upsert: true }
      );

      // ── Stage 7: Re-layout ──
      sendSSE(res, 'merge:layout-start', {});

      const allChunks = await chunkService.getChunksByCourse(courseId);
      const totalWords = allChunks.reduce((sum, c) => sum + (c.content?.length || 0), 0);
      const fontSize = course.pageConfig.fontSize || calculateFontSize(totalWords, course.pageConfig.wordLimit);
      const lineHeight = getLineHeight(fontSize);

      const layout = await layoutService.generateLayout(
        courseId, allChunks, mergedTree,
        {
          size: course.pageConfig.size,
          width: course.pageConfig.width,
          height: course.pageConfig.height,
          pages: course.pageConfig.pages,
          columns: (course.pageConfig as any).columns,
        },
        fontSize, lineHeight, provider
      );

      // ── Stage 8: Version snapshot ──
      try {
        await versionService.autoSave(courseId, 'Post-merge snapshot');
      } catch (err) {
        console.warn('Failed to create post-merge version snapshot:', err);
      }

      // Enrich layout for frontend
      const chunkMap = new Map(allChunks.map(c => [c.nodeId, c]));
      const nodeNames = new Map<string, string>();
      collectNodeNames(mergedTree, nodeNames);
      const enrichedContainers = layout.containers.map(container => ({
        id: container.id,
        parentNodeId: container.parentNodeId,
        title: container.title,
        page: container.page,
        x: container.x, y: container.y,
        width: container.width, height: container.height,
        chunks: container.chunks.map(chunk => {
          const chunkData = chunkMap.get(chunk.nodeId);
          return {
            nodeId: chunk.nodeId,
            x: chunk.x, y: chunk.y,
            width: chunk.width, height: chunk.height,
            content: chunkData?.content || '',
            importance: chunkData?.importance || 'Important',
            name: nodeNames.get(chunk.nodeId) || '',
            sourceStart: chunkData?.sourceStart || '',
            sourceEnd: chunkData?.sourceEnd || '',
            sourceFiles: (chunkData as any)?.sourceFiles || [],
          };
        }),
      }));

      // Send final result
      sendSSE(res, 'merge:complete', {
        tree: mergedTree,
        layout: {
          fontSize: layout.fontSize,
          lineHeight: layout.lineHeight,
          containers: enrichedContainers,
        },
      });

      await courseService.updateStatus(courseId, 'editing');
      endSSE(res);
    } catch (error) {
      console.error('Incremental merge error:', error);
      const mapped = mapLLMErrorToUserMessage(error);
      sendSSEError(res, mapped.message, mapped.retryable);
      await courseService.updateStatus(courseId, 'editing').catch(() => {});
    }
  },
};
