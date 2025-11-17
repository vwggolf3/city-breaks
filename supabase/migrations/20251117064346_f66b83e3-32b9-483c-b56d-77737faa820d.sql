-- Create table to store flight price data for Amsterdam destinations
CREATE TABLE IF NOT EXISTS public.ams_flight_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination_code TEXT NOT NULL,
  departure_date DATE NOT NULL,
  return_date DATE NOT NULL,
  weekend_type TEXT NOT NULL CHECK (weekend_type IN ('thu-sun', 'fri-sun', 'fri-mon', 'thu-mon')),
  price NUMERIC,
  currency TEXT DEFAULT 'EUR',
  airlines TEXT[],
  flight_data JSONB,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Unique constraint to avoid duplicate price records
  UNIQUE(destination_code, departure_date, return_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ams_flight_prices_destination ON public.ams_flight_prices(destination_code);
CREATE INDEX IF NOT EXISTS idx_ams_flight_prices_dates ON public.ams_flight_prices(departure_date, return_date);
CREATE INDEX IF NOT EXISTS idx_ams_flight_prices_weekend_type ON public.ams_flight_prices(weekend_type);
CREATE INDEX IF NOT EXISTS idx_ams_flight_prices_updated ON public.ams_flight_prices(last_updated_at);

-- Enable RLS
ALTER TABLE public.ams_flight_prices ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view prices (read-only for users)
CREATE POLICY "Anyone can view flight prices"
  ON public.ams_flight_prices
  FOR SELECT
  USING (true);

-- Comment
COMMENT ON TABLE public.ams_flight_prices IS 'Stores flight prices from Amsterdam to European destinations for upcoming weekends';