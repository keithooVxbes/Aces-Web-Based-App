import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment
} from '../controllers/assignment.js';

const router = Router();

// Protect all assignment routes to ensure req.user exists
router.use(requireAuth);

router.get('/', getAssignments);
router.post('/', createAssignment);
router.put('/:id', updateAssignment);
router.delete('/:id', deleteAssignment);

export default router;
