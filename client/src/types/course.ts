export interface FileInfo {
  fileId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  uploadedAt: string;
}

export interface PageConfig {
  size: 'A4' | '16:9' | 'custom';
  width: number;
  height: number;
  pages: number;
  wordLimit: number;
}

export interface Course {
  _id: string;
  name: string;
  pageConfig: PageConfig;
  files: FileInfo[];
  currentFontSize: number;
  status: 'created' | 'uploading' | 'generating' | 'editing';
  createdAt: string;
  updatedAt: string;
}
