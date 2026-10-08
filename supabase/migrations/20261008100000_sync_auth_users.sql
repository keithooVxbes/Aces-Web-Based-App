-- Migration: Sync auth.users → public.users automatically
-- This solves the FK constraint violation when inserting into assignments/notes/etc.

-- 1. Create a function that runs on every new signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a trigger on auth.users that fires after insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill: Insert all existing auth users that are missing from public.users
INSERT INTO public.users (id, name, email)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', SPLIT_PART(au.email, '@', 1)),
  au.email
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;
