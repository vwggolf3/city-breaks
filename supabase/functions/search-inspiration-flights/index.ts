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

    // Step 2: Get cached Amsterdam destinations from database
    const { data: amsDestinations, error: dbError } = await supabase
      .from('ams_destinations')
      .select('destination_code, city, country')
      .order('city', { ascending: true });

    if (dbError) {
      console.error('Error fetching Amsterdam destinations:', dbError);
      throw new Error('Failed to fetch destinations from database');
    }

    if (!amsDestinations || amsDestinations.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No destinations available',
          details: 'Please run sync-ams-destinations function first to populate destinations'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${amsDestinations.length} Thu/Fri destinations in database`);

    // Step 3: Search Amadeus for prices to these specific destinations
    const flightResults = [];

    for (const dest of amsDestinations.slice(0, 20)) { // Limit to 20 destinations to avoid timeout
      try {
        const searchParams = new URLSearchParams({
          originLocationCode: origin,
          destinationLocationCode: dest.destination_code,
          departureDate,
          returnDate,
          adults: '1',
          currencyCode: 'EUR',
          max: '1', // Just get cheapest flight for each destination
          nonStop: 'true',
        });

        if (maxPrice) {
          searchParams.append('maxPrice', maxPrice.toString());
        }

        console.log(`Searching flights to ${dest.city} (${dest.destination_code})...`);

        const flightResponse = await fetch(
          `https://${apiUrl}/v2/shopping/flight-offers?${searchParams.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (flightResponse.ok) {
          const flightData = await flightResponse.json();
          if (flightData.data && flightData.data.length > 0) {
            // Add destination info to the flight offer
            const enrichedOffer = {
              ...flightData.data[0],
              destinationCity: dest.city,
              destinationCountry: dest.country,
            };
            flightResults.push(enrichedOffer);
            console.log(`  ✓ Found flight to ${dest.city} at €${flightData.data[0].price.total}`);
          }
        }
      } catch (error) {
        console.error(`Error searching ${dest.destination_code}:`, error);
        // Continue with other destinations
      }
    }

    console.log(`Found ${flightResults.length} total flight options`);

    return new Response(
      JSON.stringify({ 
        data: flightResults,
        message: `Found ${flightResults.length} weekend destinations from ${origin}`
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
