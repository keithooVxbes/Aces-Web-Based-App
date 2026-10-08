-- Add position column to notes and note_folders to preserve drag and drop order

ALTER TABLE public.notes
ADD COLUMN position INTEGER DEFAULT 0;

ALTER TABLE public.note_folders
ADD COLUMN position INTEGER DEFAULT 0;
