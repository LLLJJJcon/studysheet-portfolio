import { Router } from 'express';
import { courseController } from '../controllers/courseController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', courseController.list);
router.post('/', courseController.create);
router.get('/:id', courseController.getById);
router.put('/:id', courseController.update);
router.delete('/:id', courseController.delete);
router.delete('/:id/files/:fileId', courseController.removeFile);

export default router;
