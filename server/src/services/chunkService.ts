import { Chunk } from '../models/Chunk';
import { ContentTree, ITreeNode } from '../models/ContentTree';

export const chunkService = {
  async upsertChunk(
    courseId: string,
    nodeId: string,
    content: string,
    wordCount: number,
    importance: string,
    sourceStart?: string,
    sourceEnd?: string
  ) {
    const update: Record<string, unknown> = { content, wordCount, importance };
    if (sourceStart !== undefined) update.sourceStart = sourceStart;
    if (sourceEnd !== undefined) update.sourceEnd = sourceEnd;
    return Chunk.findOneAndUpdate(
      { courseId, nodeId },
      update,
      { upsert: true, new: true }
    );
  },

  async getChunksByCourse(courseId: string) {
    return Chunk.find({ courseId });
  },

  async getChunksByImportance(courseId: string, importance: string) {
    return Chunk.find({ courseId, importance });
  },

  async deleteChunksByCourse(courseId: string) {
    return Chunk.deleteMany({ courseId });
  },

  async getTotalWordCount(courseId: string): Promise<number> {
    const result = await Chunk.aggregate([
      { $match: { courseId } },
      { $group: { _id: null, total: { $sum: '$wordCount' } } },
    ]);
    return result[0]?.total || 0;
  },

  async getChunksByNodeIds(courseId: string, nodeIds: string[]) {
    return Chunk.find({ courseId, nodeId: { $in: nodeIds } });
  },

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
