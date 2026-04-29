import { Course, ICourse, IPageConfig } from '../models/Course';
import mongoose from 'mongoose';

// A4 at 7pt Chinese: approx 6600 chars per page
// 16:9 at 7pt: approx 4200 chars per page
const WORD_LIMITS: Record<string, number> = {
  A4: 6600,
  '16:9': 4200,
};

// Calculate the total word limit based on page size, dimensions, and page count
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

// Service for course CRUD operations, file management, and status updates
export const courseService = {
  // Create a new course with calculated word limit from page configuration
  async create(userId: string, name: string, pageConfig: Omit<IPageConfig, 'wordLimit'>): Promise<ICourse> {
    const wordLimit = calculateWordLimit(pageConfig);
    return Course.create({
      userId: new mongoose.Types.ObjectId(userId),
      name,
      pageConfig: { ...pageConfig, wordLimit },
    });
  },

  // List all courses for a user, sorted by most recently updated
  async list(userId: string): Promise<ICourse[]> {
    return Course.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .select('-files.extractedText');
  },

  // Find a specific course by ID and user ownership
  async getById(courseId: string, userId: string): Promise<ICourse | null> {
    return Course.findOne({
      _id: courseId,
      userId: new mongoose.Types.ObjectId(userId),
    });
  },

  // Update course fields for an authorized user
  async update(courseId: string, userId: string, updates: { name?: string }): Promise<ICourse | null> {
    return Course.findOneAndUpdate(
      { _id: courseId, userId: new mongoose.Types.ObjectId(userId) },
      { $set: updates },
      { new: true }
    );
  },

  // Delete a course if owned by the given user
  async delete(courseId: string, userId: string): Promise<boolean> {
    const result = await Course.deleteOne({
      _id: courseId,
      userId: new mongoose.Types.ObjectId(userId),
    });
    return result.deletedCount > 0;
  },

  // Append an uploaded file record to a course's files array
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

  // Remove a file from a course by fileId
  async removeFile(courseId: string, userId: string, fileId: string): Promise<ICourse | null> {
    return Course.findOneAndUpdate(
      { _id: courseId, userId: new mongoose.Types.ObjectId(userId) },
      { $pull: { files: { fileId } } },
      { new: true }
    );
  },

  // Update the generation status of a course
  async updateStatus(courseId: string, status: ICourse['status']): Promise<ICourse | null> {
    return Course.findByIdAndUpdate(courseId, { $set: { status } }, { new: true });
  },
};
