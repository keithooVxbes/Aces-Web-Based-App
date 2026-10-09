import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { getExportData } from '../controllers/export.js';

const router = Router();

router.get('/', requireAuth, getExportData);

export default router;
