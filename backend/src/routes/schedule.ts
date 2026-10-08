import { Router } from 'express';
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule
} from '../controllers/schedule';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.get('/', requireAuth, getSchedules);
router.post('/', requireAuth, createSchedule);
router.put('/:id', requireAuth, updateSchedule);
router.delete('/:id', requireAuth, deleteSchedule);

export default router;
