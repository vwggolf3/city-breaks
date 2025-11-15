import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let queryBuilder = supabase
      .from('airports')
      .select('iata_code, name, city, country')
      .order('name');

    if (query && query.trim().length > 0) {
      const searchQuery = query.trim();
      console.log(`Searching for airports matching "${searchQuery}"`);
      
      // Search across multiple fields using OR condition
      queryBuilder = queryBuilder.or(
        `name.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,country.ilike.%${searchQuery}%,iata_code.ilike.%${searchQuery}%`
      );
    } else {
      console.log('No query provided, returning limited airports');
      queryBuilder = queryBuilder.limit(100);
    }

    const { data: airports, error } = await queryBuilder;

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log(`Found ${airports?.length || 0} airports`);

    // Transform to match expected format
    const formattedAirports = (airports || []).map(airport => ({
      name: airport.name,
      iataCode: airport.iata_code,
      city: airport.city,
      country: airport.country,
    }));

    return new Response(JSON.stringify({ data: formattedAirports }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-airports function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to get airports'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
