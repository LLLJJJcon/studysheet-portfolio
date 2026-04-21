import mongoose, { Schema, Document } from 'mongoose';

export interface IChunk extends Document {
  courseId: string;
  nodeId: string;
  content: string;
  wordCount: number;
  importance: string;
  sourceStart?: string;
  sourceEnd?: string;
  sourceFiles?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const chunkSchema = new Schema<IChunk>(
  {
    courseId: {
      type: String,
      required: true,
      index: true,
    },
    nodeId: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      default: '',
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    importance: {
      type: String,
      enum: ['High-Frequency', 'Important', 'Awareness'],
      required: true,
    },
    sourceStart: {
      type: String,
      default: '',
    },
    sourceEnd: {
      type: String,
      default: '',
    },
    sourceFiles: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

chunkSchema.index({ courseId: 1, nodeId: 1 }, { unique: true });

export const Chunk = mongoose.model<IChunk>('Chunk', chunkSchema);
