import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { courseService } from '../services/courseService';
import { fileParserService } from '../services/fileParserService';

// Controller for course CRUD operations and file upload management
export const courseController = {
  // List all courses belonging to the authenticated user
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courses = await courseService.list(req.user!.userId);
      res.json({ courses });
    } catch {
      res.status(500).json({ error: 'Failed to list courses' });
    }
  },

  // Create a new course with name and page configuration
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, pageConfig } = req.body;
      if (!name || !pageConfig) {
        res.status(400).json({ error: 'Name and page config are required' });
        return;
      }
      const course = await courseService.create(req.user!.userId, name, pageConfig);
      res.status(201).json({ course });
    } catch {
      res.status(500).json({ error: 'Failed to create course' });
    }
  },

  // Retrieve a single course by ID for the authenticated user
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const course = await courseService.getById(req.params.id, req.user!.userId);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      res.json({ course });
    } catch {
      res.status(500).json({ error: 'Failed to get course' });
    }
  },

  // Update course details such as name
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name } = req.body;
      const course = await courseService.update(req.params.id, req.user!.userId, { name });
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      res.json({ course });
    } catch {
      res.status(500).json({ error: 'Failed to update course' });
    }
  },

  // Delete a course and its associated data
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const deleted = await courseService.delete(req.params.id, req.user!.userId);
      if (!deleted) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete course' });
    }
  },

  // Remove a specific file from a course
  async removeFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const course = await courseService.removeFile(
        req.params.id,
        req.user!.userId,
        req.params.fileId
      );
      if (!course) {
        res.status(404).json({ error: 'Course or file not found' });
        return;
      }
      res.json({ course });
    } catch {
      res.status(500).json({ error: 'Failed to remove file' });
    }
  },

  // Upload and parse files, attaching extracted text to the course
  async uploadFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      const course = await courseService.getById(req.params.id, req.user!.userId);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }

      await courseService.updateStatus(req.params.id, 'uploading');

      const results = [];
      for (const file of files) {
        const extractedText = await fileParserService.parseFile(file.path, file.mimetype);
        const updated = await courseService.addFile(req.params.id, req.user!.userId, {
          fileId: file.filename.split('.')[0],
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          extractedText,
        });
        results.push({ originalName: file.originalname, success: !!updated });
      }

      await courseService.updateStatus(req.params.id, 'created');

      const updatedCourse = await courseService.getById(req.params.id, req.user!.userId);
      res.json({ course: updatedCourse, results });
    } catch {
      res.status(500).json({ error: 'Failed to upload files' });
    }
  },
};
