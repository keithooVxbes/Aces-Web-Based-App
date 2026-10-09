import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { getExportData } from '../controllers/export';

const router = Router();

router.get('/', requireAuth, getExportData);

export default router;
