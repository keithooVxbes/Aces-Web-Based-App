import { Router } from 'express';
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule
} from '../controllers/schedule.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireAuth, getSchedules);
router.post('/', requireAuth, createSchedule);
router.put('/:id', requireAuth, updateSchedule);
router.delete('/:id', requireAuth, deleteSchedule);

export default router;
