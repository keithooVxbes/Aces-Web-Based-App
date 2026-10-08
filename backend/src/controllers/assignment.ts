import { Request, Response, NextFunction } from 'express';
import { assignmentService } from '../services/assignment';

export const getAssignments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    console.log('[DEBUG][Controller] GET /assignments - Authenticated user:', userId);
    const assignments = await assignmentService.getAssignments(userId);
    res.json(assignments);
  } catch (error) {
    next(error);
  }
};

export const createAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    console.log('[DEBUG][Controller] POST /assignments - Authenticated user:', userId);
    console.log('[DEBUG][Controller] Request body:', req.body);
    const newAssignment = await assignmentService.createAssignment(userId, req.body);
    res.status(201).json(newAssignment);
  } catch (error) {
    next(error);
  }
};

export const updateAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    console.log('[DEBUG][Controller] PUT /assignments/' + id + ' - Authenticated user:', userId);
    const updatedAssignment = await assignmentService.updateAssignment(userId, id, req.body);
    res.json(updatedAssignment);
  } catch (error) {
    next(error);
  }
};

export const deleteAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    console.log('[DEBUG][Controller] DELETE /assignments/' + id + ' - Authenticated user:', userId);
    await assignmentService.deleteAssignment(userId, id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
