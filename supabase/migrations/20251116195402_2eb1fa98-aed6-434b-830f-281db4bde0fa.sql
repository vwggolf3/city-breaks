-- Create table to store direct flight destinations from Amsterdam
CREATE TABLE IF NOT EXISTS public.ams_destinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination_code VARCHAR(3) NOT NULL UNIQUE,
  city VARCHAR(255) NOT NULL,
  country VARCHAR(255) NOT NULL,
  last_price NUMERIC(10,2),
  currency VARCHAR(3) DEFAULT 'EUR',
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ams_destinations ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth needed since this is reference data)
CREATE POLICY "Anyone can view Amsterdam destinations"
  ON public.ams_destinations
  FOR SELECT
  USING (true);

-- Create index for faster lookups
CREATE INDEX idx_ams_destinations_code ON public.ams_destinations(destination_code);
CREATE INDEX idx_ams_destinations_last_synced ON public.ams_destinations(last_synced_at);

-- Trigger for updated_at
CREATE TRIGGER update_ams_destinations_updated_at
  BEFORE UPDATE ON public.ams_destinations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();