import { Chunk } from '../models/Chunk';

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
};
