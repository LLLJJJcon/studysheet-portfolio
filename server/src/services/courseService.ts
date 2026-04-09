import { Course, ICourse, IPageConfig } from '../models/Course';
import mongoose from 'mongoose';

// A4 at 7pt Chinese: approx 6600 chars per page
// 16:9 at 7pt: approx 4200 chars per page
const WORD_LIMITS: Record<string, number> = {
  A4: 6600,
  '16:9': 4200,
};

function calculateWordLimit(config: { size: string; width: number; height: number; pages: number }): number {
  if (config.size === 'custom') {
    // Approximate based on area ratio to A4 (210x297mm)
    const a4Area = 210 * 297;
    const customArea = config.width * config.height;
    const ratio = customArea / a4Area;
    return Math.floor(6600 * ratio * config.pages * 0.95);
  }
  const perPage = WORD_LIMITS[config.size] || 6600;
  return Math.floor(perPage * config.pages * 0.95);
}

export const courseService = {
  async create(userId: string, name: string, pageConfig: Omit<IPageConfig, 'wordLimit'>): Promise<ICourse> {
    const wordLimit = calculateWordLimit(pageConfig);
    return Course.create({
      userId: new mongoose.Types.ObjectId(userId),
      name,
      pageConfig: { ...pageConfig, wordLimit },
    });
  },

  async list(userId: string): Promise<ICourse[]> {
    return Course.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .select('-files.extractedText');
  },

  async getById(courseId: string, userId: string): Promise<ICourse | null> {
    return Course.findOne({
      _id: courseId,
      userId: new mongoose.Types.ObjectId(userId),
    });
  },

  async update(courseId: string, userId: string, updates: { name?: string }): Promise<ICourse | null> {
    return Course.findOneAndUpdate(
      { _id: courseId, userId: new mongoose.Types.ObjectId(userId) },
      { $set: updates },
      { new: true }
    );
  },

  async delete(courseId: string, userId: string): Promise<boolean> {
    const result = await Course.deleteOne({
      _id: courseId,
      userId: new mongoose.Types.ObjectId(userId),
    });
    return result.deletedCount > 0;
  },

  async addFile(
    courseId: string,
    userId: string,
    fileInfo: { fileId: string; filename: string; originalName: string; mimeType: string; extractedText: string }
  ): Promise<ICourse | null> {
    return Course.findOneAndUpdate(
      { _id: courseId, userId: new mongoose.Types.ObjectId(userId) },
      { $push: { files: { ...fileInfo, uploadedAt: new Date() } } },
      { new: true }
    );
  },

  async removeFile(courseId: string, userId: string, fileId: string): Promise<ICourse | null> {
    return Course.findOneAndUpdate(
      { _id: courseId, userId: new mongoose.Types.ObjectId(userId) },
      { $pull: { files: { fileId } } },
      { new: true }
    );
  },

  async updateStatus(courseId: string, status: ICourse['status']): Promise<ICourse | null> {
    return Course.findByIdAndUpdate(courseId, { $set: { status } }, { new: true });
  },
};
