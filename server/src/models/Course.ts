import mongoose, { Schema, Document } from 'mongoose';

export interface IFileInfo {
  fileId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  extractedText: string;
  uploadedAt: Date;
}

export interface IPageConfig {
  size: 'A4' | '16:9' | 'custom';
  width: number;
  height: number;
  pages: number;
  wordLimit: number;
}

export interface ICourse extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  pageConfig: IPageConfig;
  files: IFileInfo[];
  currentFontSize: number;
  status: 'created' | 'uploading' | 'generating' | 'editing';
  createdAt: Date;
  updatedAt: Date;
}

const fileInfoSchema = new Schema<IFileInfo>({
  fileId: { type: String, required: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  extractedText: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now },
});

const pageConfigSchema = new Schema<IPageConfig>({
  size: { type: String, enum: ['A4', '16:9', 'custom'], default: 'A4' },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  pages: { type: Number, required: true, min: 1 },
  wordLimit: { type: Number, required: true },
});

const courseSchema = new Schema<ICourse>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    pageConfig: { type: pageConfigSchema, required: true },
    files: [fileInfoSchema],
    currentFontSize: { type: Number, default: 12 },
    status: {
      type: String,
      enum: ['created', 'uploading', 'generating', 'editing'],
      default: 'created',
    },
  },
  { timestamps: true }
);

export const Course = mongoose.model<ICourse>('Course', courseSchema);
