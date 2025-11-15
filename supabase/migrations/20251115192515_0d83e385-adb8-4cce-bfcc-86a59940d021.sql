-- Create airports table to store European airports from Amadeus API
CREATE TABLE IF NOT EXISTS public.airports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iata_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for fast searching
CREATE INDEX idx_airports_iata_code ON public.airports(iata_code);
CREATE INDEX idx_airports_name ON public.airports(name);
CREATE INDEX idx_airports_city ON public.airports(city);
CREATE INDEX idx_airports_country ON public.airports(country);

-- Enable RLS
ALTER TABLE public.airports ENABLE ROW LEVEL SECURITY;

-- Public read access for airports (no auth required)
CREATE POLICY "Anyone can view airports"
  ON public.airports
  FOR SELECT
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_airports_updated_at
  BEFORE UPDATE ON public.airports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();