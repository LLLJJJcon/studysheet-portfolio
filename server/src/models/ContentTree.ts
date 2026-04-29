import mongoose, { Schema, Document } from 'mongoose';

export interface ITreeNode {
  nodeId: string;
  name: string;
  sourceFile?: string;
  importance?: 'High-Frequency' | 'Important' | 'Awareness';
  children: ITreeNode[];
}

export interface IContentTree extends Document {
  courseId: mongoose.Types.ObjectId;
  tree: ITreeNode;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose schema for a single node in the hierarchical content tree
const treeNodeSchema = new Schema<ITreeNode>({
  nodeId: { type: String, required: true },
  name: { type: String, required: true },
  sourceFile: { type: String },
  importance: { type: String, enum: ['High-Frequency', 'Important', 'Awareness'] },
  children: { type: [Schema.Types.Mixed], default: [] },
});

// Mongoose schema for the full content tree associated with a course
const contentTreeSchema = new Schema<IContentTree>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, unique: true },
    tree: { type: treeNodeSchema, required: true },
  },
  { timestamps: true }
);

// Mongoose model for hierarchical content trees linked to courses
export const ContentTree = mongoose.model<IContentTree>('ContentTree', contentTreeSchema);
