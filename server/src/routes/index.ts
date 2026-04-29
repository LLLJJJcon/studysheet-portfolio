import { Router } from 'express';
import authRoutes from './authRoutes';
import courseRoutes from './courseRoutes';
import generationRoutes from './generationRoutes';
import versionRoutes from './versionRoutes';
import exportRoutes from './exportRoutes';

// Root API router that mounts all sub-routers under their path prefixes
const router = Router();

router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/courses', generationRoutes);
router.use('/courses', versionRoutes);
router.use('/courses', exportRoutes);

export default router;
