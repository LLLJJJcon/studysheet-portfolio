import { Router } from 'express';
import { courseController } from '../controllers/courseController';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';

// Router for course CRUD operations and file management
const router = Router();

router.use(authMiddleware);

router.get('/', courseController.list);
router.post('/', courseController.create);
router.get('/:id', courseController.getById);
router.put('/:id', courseController.update);
router.delete('/:id', courseController.delete);
router.post('/:id/files', upload.array('files', 20), courseController.uploadFiles);
router.delete('/:id/files/:fileId', courseController.removeFile);

export default router;
