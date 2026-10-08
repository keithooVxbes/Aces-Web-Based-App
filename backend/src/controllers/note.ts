import { Request, Response, NextFunction } from 'express';
import { noteService } from '../services/note';

// FOLDERS
export const getFolders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const folders = await noteService.getFolders(req.user!.id);
    res.json(folders);
  } catch (error) { next(error); }
};

export const createFolder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const folder = await noteService.createFolder(req.user!.id, req.body);
    res.status(201).json(folder);
  } catch (error) { next(error); }
};

export const updateFolder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await noteService.updateFolder(req.user!.id, req.params.id, req.body.name);
    res.json({ success: true });
  } catch (error) { next(error); }
};

export const deleteFolder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await noteService.deleteFolder(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
};

export const deleteFolderAndNotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await noteService.deleteFolderAndNotes(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
};

// NOTES
export const getNotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notes = await noteService.getNotes(req.user!.id);
    res.json(notes);
  } catch (error) { next(error); }
};

export const createNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = await noteService.createNote(req.user!.id, req.body);
    res.status(201).json(note);
  } catch (error) { next(error); }
};

export const updateNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await noteService.updateNote(req.user!.id, req.params.id, req.body);
    res.json({ success: true });
  } catch (error) { next(error); }
};

export const deleteNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await noteService.deleteNote(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
};

export const deleteNotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await noteService.deleteNotes(req.user!.id, req.body.ids);
    res.json({ success: true });
  } catch (error) { next(error); }
};

export const reorderNotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await noteService.reorderNotes(req.user!.id, req.body.orderedIds);
    res.json({ success: true });
  } catch (error) { next(error); }
};
