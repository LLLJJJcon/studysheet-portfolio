import mongoose, { Schema, Document } from 'mongoose';

export interface IChunkPosition {
  nodeId: string;
  x: number;       // mm
  y: number;       // mm
  width: number;   // mm
  height: number;  // mm
}

export interface IContainer {
  id: string;
  parentNodeId: string;
  title: string;
  page: number;
  x: number;       // mm
  y: number;       // mm
  width: number;   // mm
  height: number;  // mm
  chunks: IChunkPosition[];
}

export interface ILayout extends Document {
  courseId: mongoose.Types.ObjectId;
  fontSize: number;
  lineHeight: number;
  containers: IContainer[];
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose schema for a chunk's position and dimensions within a container
const chunkPositionSchema = new Schema<IChunkPosition>({
  nodeId: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
}, { _id: false });

// Mongoose schema for a layout container grouping chunks on a page
const containerSchema = new Schema<IContainer>({
  id: { type: String, required: true },
  parentNodeId: { type: String, required: true },
  title: { type: String, required: true },
  page: { type: Number, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  chunks: [chunkPositionSchema],
}, { _id: false });

// Mongoose schema for the full page layout of a course study sheet
const layoutSchema = new Schema<ILayout>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      unique: true,
    },
    fontSize: { type: Number, required: true },
    lineHeight: { type: Number, required: true },
    containers: [containerSchema],
  },
  {
    timestamps: true,
  }
);

// Mongoose model for study sheet spatial layouts
export const Layout = mongoose.model<ILayout>('Layout', layoutSchema);
