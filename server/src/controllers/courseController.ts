import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { courseService } from '../services/courseService';

export const courseController = {
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courses = await courseService.list(req.user!.userId);
      res.json({ courses });
    } catch {
      res.status(500).json({ error: 'Failed to list courses' });
    }
  },

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
};
