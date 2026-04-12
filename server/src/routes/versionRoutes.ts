import { Router } from 'express';
import { versionController } from '../controllers/versionController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// GET /api/courses/:id/versions — list versions
router.get('/:id/versions', versionController.list);

// POST /api/courses/:id/versions — save a version
router.post('/:id/versions', versionController.save);

// GET /api/courses/:id/versions/:versionId — get a specific version
router.get('/:id/versions/:versionId', versionController.get);

// PUT /api/courses/:id/versions/:versionId/baseline — mark as baseline
router.put('/:id/versions/:versionId/baseline', versionController.markBaseline);

// POST /api/courses/:id/versions/:versionId/restore — restore version
router.post('/:id/versions/:versionId/restore', versionController.restore);

// DELETE /api/courses/:id/versions/:versionId — delete version
router.delete('/:id/versions/:versionId', versionController.delete);

export default router;
