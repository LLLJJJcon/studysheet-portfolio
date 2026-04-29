import { Chunk } from '../models/Chunk';
import { ContentTree, ITreeNode } from '../models/ContentTree';

// Service for CRUD operations on content chunks and tree path lookups
export const chunkService = {
  // Create or update a chunk by courseId and nodeId
  async upsertChunk(
    courseId: string,
    nodeId: string,
    content: string,
    wordCount: number,
    importance: string,
    sourceStart?: string,
    sourceEnd?: string,
    sourceFiles?: string[]
  ) {
    const update: Record<string, unknown> = { content, wordCount, importance };
    if (sourceStart !== undefined) update.sourceStart = sourceStart;
    if (sourceEnd !== undefined) update.sourceEnd = sourceEnd;
    if (sourceFiles !== undefined) update.sourceFiles = sourceFiles;
    return Chunk.findOneAndUpdate(
      { courseId, nodeId },
      update,
      { upsert: true, new: true }
    );
  },

  // Retrieve all chunks belonging to a course
  async getChunksByCourse(courseId: string) {
    return Chunk.find({ courseId });
  },

  // Retrieve chunks filtered by importance level
  async getChunksByImportance(courseId: string, importance: string) {
    return Chunk.find({ courseId, importance });
  },

  // Delete all chunks for a given course
  async deleteChunksByCourse(courseId: string) {
    return Chunk.deleteMany({ courseId });
  },

  // Aggregate the total word count across all chunks for a course
  async getTotalWordCount(courseId: string): Promise<number> {
    const result = await Chunk.aggregate([
      { $match: { courseId } },
      { $group: { _id: null, total: { $sum: '$wordCount' } } },
    ]);
    return result[0]?.total || 0;
  },

  // Fetch specific chunks by their nodeIds within a course
  async getChunksByNodeIds(courseId: string, nodeIds: string[]) {
    return Chunk.find({ courseId, nodeId: { $in: nodeIds } });
  },

  // Build the breadcrumb path from root to a node in the content tree
  async getTreePathForNode(courseId: string, nodeId: string): Promise<string> {
    const contentTree = await ContentTree.findOne({ courseId });
    if (!contentTree) return '';

    function dfs(node: ITreeNode, path: string[]): string | null {
      path.push(node.name);
      if (node.nodeId === nodeId) return path.join(' > ');
      for (const child of node.children) {
        const result = dfs(child, path);
        if (result) return result;
      }
      path.pop();
      return null;
    }

    return dfs(contentTree.tree, []) || '';
  },

  // Look up the display name of a node by its ID in the content tree
  async getNodeName(courseId: string, nodeId: string): Promise<string> {
    const contentTree = await ContentTree.findOne({ courseId });
    if (!contentTree) return '';

    function dfs(node: ITreeNode): string | null {
      if (node.nodeId === nodeId) return node.name;
      for (const child of node.children) {
        const result = dfs(child);
        if (result) return result;
      }
      return null;
    }

    return dfs(contentTree.tree) || '';
  },
};
