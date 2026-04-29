import mongoose, { Schema, Document } from 'mongoose';

export interface IVersion extends Document {
  courseId: mongoose.Types.ObjectId;
  versionNumber: number;
  label?: string;
  description?: string;
  isBaseline: boolean;
  treeSnapshot: Record<string, unknown>;
  layoutSnapshot: Record<string, unknown>;
  chunksSnapshot: Array<Record<string, unknown>>;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose schema for versioned snapshots of tree, layout, and chunks
const versionSchema = new Schema<IVersion>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    label: {
      type: String,
    },
    description: {
      type: String,
    },
    isBaseline: {
      type: Boolean,
      default: false,
    },
    treeSnapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    layoutSnapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    chunksSnapshot: {
      type: [Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

versionSchema.index({ courseId: 1, versionNumber: -1 });

// Mongoose model for course version history
export const Version = mongoose.model<IVersion>('Version', versionSchema);
