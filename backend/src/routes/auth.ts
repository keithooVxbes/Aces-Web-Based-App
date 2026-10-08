import { Router } from 'express';
import { getMe } from '../controllers/auth';
import { requireAuth } from '../middlewares/auth';

const router = Router();

// Endpoint: GET /api/auth/me
// Protected by requireAuth middleware
router.get('/me', requireAuth, getMe);

export default router;
