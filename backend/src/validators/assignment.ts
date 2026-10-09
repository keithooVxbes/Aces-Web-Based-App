import { z } from 'zod';

export const createAssignmentSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  course: z.string().max(255).optional().default(''), // Maps to subject
  description: z.string().optional().default(''),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).or(z.literal('')).optional(),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['todo', 'in-progress', 'done'])
});

export const updateAssignmentSchema = createAssignmentSchema.partial();
