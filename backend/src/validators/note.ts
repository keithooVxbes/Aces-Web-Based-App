import { z } from 'zod';

export const createNoteFolderSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Folder name is required").max(100),
  createdAt: z.number().int().positive()
});

export const updateNoteFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(100)
});

export const createNoteSchema = z.object({
  id: z.string().uuid().optional(),
  content: z.string().min(1, "Note content is required"), // title is extracted from content
  pinned: z.boolean().default(false),
  folderId: z.string().uuid().nullable().optional(),
  lastModified: z.number().int().positive()
});

export const updateNoteSchema = z.object({
  content: z.string().min(1, "Note content cannot be empty").optional(),
  pinned: z.boolean().optional(),
  folderId: z.string().uuid().nullable().optional(),
  lastModified: z.number().int().positive().optional()
});

export const deleteNotesSchema = z.object({
  ids: z.array(z.string().uuid())
});

export const reorderNotesSchema = z.object({
  orderedIds: z.array(z.string().uuid())
});
