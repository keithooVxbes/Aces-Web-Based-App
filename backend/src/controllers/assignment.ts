import { Request, Response, NextFunction } from 'express';
import { assignmentService } from '../services/assignment.js';
import { createAssignmentSchema, updateAssignmentSchema } from '../validators/assignment.js';

export const getAssignments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const assignments = await assignmentService.getAssignments(userId);
    res.json(assignments);
  } catch (error) {
    next(error);
  }
};

export const createAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const validatedData = createAssignmentSchema.parse(req.body);
    const newAssignment = await assignmentService.createAssignment(userId, {
      ...validatedData,
      dueDate: validatedData.dueDate || ""
    });
    res.status(201).json(newAssignment);
  } catch (error) {
    next(error);
  }
};

export const updateAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const validatedData = updateAssignmentSchema.parse(req.body);
    const updatedAssignment = await assignmentService.updateAssignment(userId, id, validatedData);
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
