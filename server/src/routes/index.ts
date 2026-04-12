import { Router } from 'express';
import authRoutes from './authRoutes';
import courseRoutes from './courseRoutes';
import generationRoutes from './generationRoutes';
import versionRoutes from './versionRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/courses', generationRoutes);
router.use('/courses', versionRoutes);

export default router;