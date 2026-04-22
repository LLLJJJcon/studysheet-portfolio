import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { versionService } from '../services/versionService';
import { Course } from '../models/Course';

export const versionController = {
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const userId = req.user!.userId;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }

      const versions = await versionService.getVersions(courseId);
      res.json(versions);
    } catch (err) {
      console.error('[versions.list]', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'Failed to list versions' });
    }
  },

  async get(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const versionId = req.params.versionId;
      const userId = req.user!.userId;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }

      const version = await versionService.getVersion(courseId, versionId);
      if (!version) {
        res.status(404).json({ error: 'Version not found' });
        return;
      }

      res.json(version);
    } catch (err) {
      console.error('[versions.get]', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'Failed to get version' });
    }
  },

  async save(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const userId = req.user!.userId;
      const { label, description } = req.body || {};

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }

      const version = await versionService.autoSave(courseId, label, description);
      res.status(201).json(version);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('tree or layout not found')) {
        res.status(409).json({ error: 'Nothing to save yet — course has no generated content.' });
        return;
      }
      console.error('[versions.save]', message);
      res.status(500).json({ error: 'Failed to save version' });
    }
  },

  async markBaseline(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const versionId = req.params.versionId;
      const userId = req.user!.userId;
      const { label } = req.body || {};

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }

      const version = await versionService.markBaseline(courseId, versionId, label);
      if (!version) {
        res.status(404).json({ error: 'Version not found' });
        return;
      }

      res.json(version);
    } catch (err) {
      console.error('[versions.markBaseline]', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'Failed to mark baseline' });
    }
  },

  async restore(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const versionId = req.params.versionId;
      const userId = req.user!.userId;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }

      await versionService.restoreVersion(courseId, versionId);
      res.json({ message: 'Version restored successfully' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'Version not found') {
        res.status(404).json({ error: message });
        return;
      }
      console.error('[versions.restore]', message);
      res.status(500).json({ error: 'Failed to restore version' });
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const versionId = req.params.versionId;
      const userId = req.user!.userId;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }

      const deleted = await versionService.deleteVersion(courseId, versionId);
      if (!deleted) {
        res.status(400).json({ error: 'Cannot delete baseline version' });
        return;
      }

      res.json({ message: 'Version deleted' });
    } catch (err) {
      console.error('[versions.delete]', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'Failed to delete version' });
    }
  },
};
