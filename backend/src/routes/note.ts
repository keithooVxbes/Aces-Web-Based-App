import { Router } from 'express';
import {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  deleteFolderAndNotes,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  deleteNotes,
  reorderNotes
} from '../controllers/note.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Folders
router.get('/folders', requireAuth, getFolders);
router.post('/folders', requireAuth, createFolder);
router.put('/folders/:id', requireAuth, updateFolder);
router.delete('/folders/:id', requireAuth, deleteFolder);
router.delete('/folders/:id/with-notes', requireAuth, deleteFolderAndNotes);

// Notes
router.get('/', requireAuth, getNotes);
router.post('/', requireAuth, createNote);
router.put('/:id', requireAuth, updateNote);
router.delete('/:id', requireAuth, deleteNote);
router.post('/batch-delete', requireAuth, deleteNotes);
router.post('/reorder', requireAuth, reorderNotes);

export default router;
