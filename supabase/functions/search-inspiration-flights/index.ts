import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { origin, departureDate, returnDate, maxPrice, departureTimePreference, arrivalTimePreference } = await req.json();

    console.log('Inspiration search request:', { origin, departureDate, returnDate, maxPrice });

    // Get Amadeus credentials from environment
    const apiKey = Deno.env.get('AMADEUS_TEST_API_KEY');
    const apiSecret = Deno.env.get('AMADEUS_TEST_API_SECRET');
    const apiUrl = Deno.env.get('AMADEUS_TEST_API_URL') || 'test.api.amadeus.com';

    if (!apiKey || !apiSecret) {
      throw new Error('Amadeus API credentials not configured');
    }

    // Step 1: Get OAuth token
    console.log('Getting OAuth token from Amadeus...');
    const tokenResponse = await fetch(`https://${apiUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token error:', errorText);
      throw new Error(`Failed to get Amadeus token: ${tokenResponse.status}`);
    }

    const tokenData: AmadeusTokenResponse = await tokenResponse.json();
    console.log('OAuth token obtained successfully');

    // Step 2: Get cached Amsterdam destinations from database to filter results
    const { data: amsDestinations, error: dbError } = await supabase
      .from('ams_destinations')
      .select('destination_code, city, country')
      .order('last_price', { ascending: true });

    if (dbError) {
      console.error('Error fetching Amsterdam destinations:', dbError);
    }

    const europeanDestCodes = amsDestinations?.map(d => d.destination_code) || [];
    console.log(`Found ${europeanDestCodes.length} European destinations in database`);

    // Step 3: Call Flight Inspiration Search API
    const searchParams = new URLSearchParams({
      origin: origin,
      departureDate,
      oneWay: 'false',
      duration: returnDate ? String(Math.ceil((new Date(returnDate).getTime() - new Date(departureDate).getTime()) / (1000 * 60 * 60 * 24))) : '2,3',
      nonStop: 'true', // Only direct flights from Amsterdam
      viewBy: 'DESTINATION',
    });

    if (maxPrice) {
      searchParams.append('maxPrice', maxPrice.toString());
    }

    console.log('Calling Flight Inspiration Search with params:', searchParams.toString());

    const inspirationResponse = await fetch(
      `https://${apiUrl}/v1/shopping/flight-destinations?${searchParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!inspirationResponse.ok) {
      const errorText = await inspirationResponse.text();
      console.error('Flight Inspiration Search error:', errorText);
      throw new Error(`Flight Inspiration Search failed: ${inspirationResponse.status}`);
    }

    const inspirationData = await inspirationResponse.json();
    let destinations = inspirationData.data || [];
    
    console.log(`Found ${destinations.length} destinations from Amadeus`);

    // Filter to only European destinations if we have the list
    if (europeanDestCodes.length > 0) {
      destinations = destinations.filter((dest: any) => 
        europeanDestCodes.includes(dest.destination)
      );
      console.log(`Filtered to ${destinations.length} European destinations`);
    }

    // Enrich with city/country names from our database
    const enrichedDestinations = destinations.map((dest: any) => {
      const dbDest = amsDestinations?.find(d => d.destination_code === dest.destination);
      return {
        ...dest,
        destinationCity: dbDest?.city || dest.destination,
        destinationCountry: dbDest?.country || 'Europe',
      };
    });

    // Apply time preferences if specified (filter by departure/arrival times)
    let filteredDestinations = enrichedDestinations;
    
    if (departureTimePreference && departureTimePreference !== 'any') {
      // Note: For inspiration search, we don't have specific flight times
      // This would require a follow-up search for each destination
      console.log(`Departure time preference "${departureTimePreference}" noted but not applied to inspiration results`);
    }

    return new Response(
      JSON.stringify({ 
        ...inspirationData, 
        data: filteredDestinations,
        message: `Found ${filteredDestinations.length} weekend destinations from ${origin}`
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in search-inspiration-flights function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to search inspiration flights'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
