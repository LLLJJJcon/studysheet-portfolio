import { Router } from 'express';
import authRoutes from './authRoutes';
import courseRoutes from './courseRoutes';
import generationRoutes from './generationRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/courses', generationRoutes);

export default router;