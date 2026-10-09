import { Router } from 'express';
import { getMe } from '../controllers/auth.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Endpoint: GET /api/auth/me
// Protected by requireAuth middleware
router.get('/me', requireAuth, getMe);

export default router;
