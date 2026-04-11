import { Layout, ILayout, IContainer } from '../models/Layout';
import { LLMProvider } from '../llm/LLMProvider';
import { buildL4Prompt } from '../llm/prompts/L4_initialLayout';
import { buildL6Prompt, classifyChunks } from '../llm/prompts/L6_layoutOptimization';
import { estimateChunkSize } from '../utils/chunkSizeEstimator';
import { computeAlgorithmicLayout } from '../utils/algorithmicLayout';
import { IChunk } from '../models/Chunk';
import { ITreeNode } from '../models/ContentTree';
import { extractJSON } from './generationOrchestrator';

interface PageConfig {
  size: string;
  width: number;
  height: number;
  pages: number;
  columns?: number;
  fontSize?: number;
}

const MARGINS = { top: 5, right: 5, bottom: 5, left: 5 };

function findParentName(tree: ITreeNode, nodeId: string, parentName = ''): string {
  if (tree.nodeId === nodeId) return parentName;
  for (const child of tree.children || []) {
    const found = findParentName(child, nodeId, tree.name);
    if (found) return found;
  }
  return '';
}

function findNodeName(tree: ITreeNode, nodeId: string): string {
  if (tree.nodeId === nodeId) return tree.name;
  for (const child of tree.children || []) {
    const found = findNodeName(child, nodeId);
    if (found) return found;
  }
  return nodeId;
}

function collectNodeInfo(
  node: ITreeNode,
  names: Record<string, string>,
  importances: Record<string, string>
): void {
  names[node.nodeId] = node.name;
  if (node.importance) {
    importances[node.nodeId] = node.importance;
  }
  for (const child of node.children || []) {
    collectNodeInfo(child, names, importances);
  }
}

export const layoutService = {
  async generateLayout(
    courseId: string,
    chunks: IChunk[],
    tree: ITreeNode,
    pageConfig: PageConfig,
    fontSize: number,
    lineHeight: number,
    _provider: LLMProvider
  ): Promise<ILayout> {
    // Pure algorithmic layout — no LLM call
    const { containers } = computeAlgorithmicLayout(
      chunks,
      tree,
      { width: pageConfig.width, height: pageConfig.height, pages: pageConfig.pages, columns: (pageConfig as any).columns },
      fontSize,
      lineHeight
    );

    // Save layout to DB
    const layout = await Layout.findOneAndUpdate(
      { courseId },
      {
        fontSize,
        lineHeight,
        containers,
      },
      { upsert: true, new: true }
    );

    return layout;
  },

  async getLayout(courseId: string): Promise<ILayout | null> {
    return Layout.findOne({ courseId });
  },

  async updateLayout(
    courseId: string,
    containers: IContainer[]
  ): Promise<ILayout | null> {
    return Layout.findOneAndUpdate(
      { courseId },
      { containers },
      { new: true }
    );
  },

  async optimizeLayout(
    courseId: string,
    tree: ITreeNode,
    pageConfig: PageConfig,
    fontSize: number,
    provider: LLMProvider
  ): Promise<ILayout | null> {
    const layout = await Layout.findOne({ courseId });
    if (!layout) return null;

    // Build node name/importance maps
    const nodeNames: Record<string, string> = {};
    const nodeImportances: Record<string, string> = {};
    collectNodeInfo(tree, nodeNames, nodeImportances);

    // Classify chunks for L6
    const chunkBBoxes = classifyChunks(
      layout.containers as unknown as Parameters<typeof classifyChunks>[0],
      nodeNames,
      nodeImportances
    );

    if (chunkBBoxes.length === 0) return layout;

    const messages = buildL6Prompt(chunkBBoxes, {
      width: pageConfig.width,
      height: pageConfig.height,
      pages: pageConfig.pages,
      margins: MARGINS,
    }, fontSize);

    let response = '';
    for await (const chunk of provider.chatStream({
      messages,
      responseFormat: 'json',
      temperature: 0.2,
    })) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    const parsed = extractJSON(response) as any;
    const optimizedChunks: Array<{ nodeId: string; page: number; x: number; y: number }> =
      parsed.optimizedChunks || [];

    // Apply optimized positions to layout
    const updatedContainers = layout.containers.map((container) => ({
      ...container.toObject ? container.toObject() : container,
      chunks: (container.chunks || []).map((chunk) => {
        const opt = optimizedChunks.find((o) => o.nodeId === chunk.nodeId);
        if (opt) {
          return { ...chunk, x: opt.x, y: opt.y };
        }
        return chunk;
      }),
    }));

    return Layout.findOneAndUpdate(
      { courseId },
      { containers: updatedContainers },
      { new: true }
    );
  },
};

// TODO: Add L6 layout optimization post-processing
