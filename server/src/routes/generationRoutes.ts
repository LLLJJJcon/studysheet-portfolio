import { Router } from 'express';
import { generationController } from '../controllers/generationController';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authMiddleware);

router.post('/:id/generate', generationController.startGeneration);
router.get('/:id/layout', generationController.getLayout);
router.put('/:id/layout', generationController.saveLayout);
router.get('/:id/content-tree', generationController.getContentTree);
router.post('/:id/cmd-k', generationController.cmdK);
router.post('/:id/optimize-layout', generationController.optimizeLayout);
router.post('/:id/relayout', generationController.relayout);
router.patch('/:id/chunks/:nodeId', generationController.updateChunk);
router.post('/:id/chunks/:nodeId/chat', generationController.chunkChat);
router.put('/:id/content-tree', generationController.updateContentTree);
router.get('/:id/source-file/:fileId', generationController.getSourceFile);
router.get('/:id/files/:fileId/raw', generationController.getRawFile);
router.post('/:id/images', upload.single('image'), generationController.uploadImage);

export default router;
