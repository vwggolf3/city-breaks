-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  preferred_currency TEXT DEFAULT 'EUR',
  preferred_language TEXT DEFAULT 'en',
  home_airport_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create saved searches table
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origin_airport TEXT NOT NULL,
  destination_airport TEXT,
  budget DECIMAL(10, 2),
  weekend_date DATE,
  departure_time_preference TEXT,
  max_stops INTEGER DEFAULT 1,
  search_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on saved searches
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- Saved searches policies
CREATE POLICY "Users can view their own searches"
  ON public.saved_searches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own searches"
  ON public.saved_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own searches"
  ON public.saved_searches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own searches"
  ON public.saved_searches FOR DELETE
  USING (auth.uid() = user_id);

-- Create favorite destinations table
CREATE TABLE public.favorite_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('city', 'country')),
  destination_name TEXT NOT NULL,
  destination_code TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, destination_name, destination_type)
);

-- Enable RLS on favorite destinations
ALTER TABLE public.favorite_destinations ENABLE ROW LEVEL SECURITY;

-- Favorite destinations policies
CREATE POLICY "Users can view their own favorites"
  ON public.favorite_destinations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own favorites"
  ON public.favorite_destinations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorites"
  ON public.favorite_destinations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON public.favorite_destinations FOR DELETE
  USING (auth.uid() = user_id);

-- Create time constraints table (for specific time windows like school pickup)
CREATE TABLE public.user_time_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'any')),
  earliest_time TIME,
  latest_time TIME,
  constraint_type TEXT NOT NULL CHECK (constraint_type IN ('departure', 'arrival', 'both')),
  reason TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on time constraints
ALTER TABLE public.user_time_constraints ENABLE ROW LEVEL SECURITY;

-- Time constraints policies
CREATE POLICY "Users can view their own time constraints"
  ON public.user_time_constraints FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own time constraints"
  ON public.user_time_constraints FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time constraints"
  ON public.user_time_constraints FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time constraints"
  ON public.user_time_constraints FOR DELETE
  USING (auth.uid() = user_id);

-- Create general trip preferences table
CREATE TABLE public.trip_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  max_budget DECIMAL(10, 2),
  preferred_airlines TEXT[],
  max_stops INTEGER DEFAULT 1,
  preferred_seat_class TEXT CHECK (preferred_seat_class IN ('economy', 'premium_economy', 'business', 'first')),
  baggage_preference TEXT,
  accessibility_needs TEXT,
  dietary_requirements TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on trip preferences
ALTER TABLE public.trip_preferences ENABLE ROW LEVEL SECURITY;

-- Trip preferences policies
CREATE POLICY "Users can view their own trip preferences"
  ON public.trip_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trip preferences"
  ON public.trip_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trip preferences"
  ON public.trip_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trip preferences"
  ON public.trip_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to automatically create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add update triggers to tables with updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_time_constraints_updated_at
  BEFORE UPDATE ON public.user_time_constraints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trip_preferences_updated_at
  BEFORE UPDATE ON public.trip_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();