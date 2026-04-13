import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { exportService } from '../services/exportService';
import { Course } from '../models/Course';

const router = Router();

router.use(authMiddleware);

// GET /api/courses/:id/export/html
router.get('/:id/export/html', async (req: AuthRequest, res: Response) => {
  const courseId = req.params.id;
  const userId = req.user!.userId;

  const course = await Course.findOne({ _id: courseId, userId });
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }

  try {
    const html = await exportService.generateHTML(courseId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(course.name)}.html"`
    );
    res.send(html);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Export failed';
    res.status(500).json({ error: message });
  }
});

// GET /api/courses/:id/export/pdf
router.get('/:id/export/pdf', async (req: AuthRequest, res: Response) => {
  const courseId = req.params.id;
  const userId = req.user!.userId;

  const course = await Course.findOne({ _id: courseId, userId });
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }

  try {
    const pdfBuffer = await exportService.generatePDF(courseId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(course.name)}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'PDF export failed';
    res.status(500).json({ error: message });
  }
});

export default router;
