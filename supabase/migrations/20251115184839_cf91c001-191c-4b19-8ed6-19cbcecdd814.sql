-- Add first_name and last_name columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT;

-- Migrate existing display_name data to first_name (if needed)
UPDATE public.profiles
SET first_name = display_name
WHERE display_name IS NOT NULL AND first_name IS NULL;

-- Drop the old display_name column
ALTER TABLE public.profiles
DROP COLUMN display_name;

-- Recreate the handle_new_user function to use first_name and last_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;