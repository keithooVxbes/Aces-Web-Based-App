-- Migration: Rename profile columns to match requirements

ALTER TABLE public.users 
RENAME COLUMN name TO username;

ALTER TABLE public.users 
RENAME COLUMN profile_photo TO avatar_url;
