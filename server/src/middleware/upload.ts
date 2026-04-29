import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Resolved absolute path to the file upload directory
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');

// Create the upload directory if it does not already exist
const ensureUploadDir = () => {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
};

ensureUploadDir();

// Multer disk storage that saves files with UUID-based filenames
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      ensureUploadDir();
      cb(null, UPLOAD_DIR);
    } catch (error) {
      cb(error as Error, UPLOAD_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

// Whitelist of accepted MIME types for file uploads
const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/msword',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'text/plain',
];

// Reject files whose MIME type is not in the allowed list
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Unsupported file type: ${file.mimetype}`);
    error.name = 'MulterFileTypeError';
    cb(error);
  }
};

// Configured multer instance with storage, file filter, and 50MB size limit
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});
