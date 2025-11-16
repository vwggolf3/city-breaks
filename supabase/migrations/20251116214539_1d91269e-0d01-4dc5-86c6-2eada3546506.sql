-- Add airlines array column to ams_destinations table
ALTER TABLE public.ams_destinations 
ADD COLUMN IF NOT EXISTS airlines text[] DEFAULT '{}';

-- Add comment explaining the column
COMMENT ON COLUMN public.ams_destinations.airlines IS 'Array of airline IATA codes that fly to this destination from Amsterdam';