import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profile.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireAuth, getProfile);
router.put('/', requireAuth, updateProfile);

export default router;
