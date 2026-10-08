import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profile';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.get('/', requireAuth, getProfile);
router.put('/', requireAuth, updateProfile);

export default router;
