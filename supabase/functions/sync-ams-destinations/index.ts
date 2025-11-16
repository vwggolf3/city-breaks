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

interface AmadeusDestination {
  type: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  price: {
    total: string;
  };
}

// Map IATA codes to cities (will expand based on actual API responses)
const CITY_NAMES: Record<string, { city: string; country: string }> = {
  'PAR': { city: 'Paris', country: 'France' },
  'LON': { city: 'London', country: 'United Kingdom' },
  'BCN': { city: 'Barcelona', country: 'Spain' },
  'ROM': { city: 'Rome', country: 'Italy' },
  'BER': { city: 'Berlin', country: 'Germany' },
  'MAD': { city: 'Madrid', country: 'Spain' },
  'VIE': { city: 'Vienna', country: 'Austria' },
  'PRG': { city: 'Prague', country: 'Czech Republic' },
  'DUB': { city: 'Dublin', country: 'Ireland' },
  'LIS': { city: 'Lisbon', country: 'Portugal' },
  'ATH': { city: 'Athens', country: 'Greece' },
  'IST': { city: 'Istanbul', country: 'Turkey' },
  'CPH': { city: 'Copenhagen', country: 'Denmark' },
  'STO': { city: 'Stockholm', country: 'Sweden' },
  'BRU': { city: 'Brussels', country: 'Belgium' },
  'MIL': { city: 'Milan', country: 'Italy' },
  'VCE': { city: 'Venice', country: 'Italy' },
  'MUC': { city: 'Munich', country: 'Germany' },
  'ZRH': { city: 'Zurich', country: 'Switzerland' },
  'OSL': { city: 'Oslo', country: 'Norway' },
  'HEL': { city: 'Helsinki', country: 'Finland' },
  'WAW': { city: 'Warsaw', country: 'Poland' },
  'BUD': { city: 'Budapest', country: 'Hungary' },
  'EDI': { city: 'Edinburgh', country: 'United Kingdom' },
  'FCO': { city: 'Rome', country: 'Italy' },
  'CDG': { city: 'Paris', country: 'France' },
  'ORY': { city: 'Paris', country: 'France' },
  'LGW': { city: 'London', country: 'United Kingdom' },
  'LHR': { city: 'London', country: 'United Kingdom' },
  'STN': { city: 'London', country: 'United Kingdom' },
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Amsterdam destinations sync...');

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

    // Step 2: Get next Friday/Sunday for Flight Inspiration Search
    const today = new Date();
    const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    const nextSunday = new Date(nextFriday);
    nextSunday.setDate(nextFriday.getDate() + 2);

    const departureDate = nextFriday.toISOString().split('T')[0];
    const returnDate = nextSunday.toISOString().split('T')[0];

    // Step 3: Call Flight Inspiration Search API for Amsterdam
    console.log('Calling Amadeus Flight Inspiration Search API...');
    const searchParams = new URLSearchParams({
      origin: 'AMS',
      departureDate,
      oneWay: 'false',
      duration: '2,3',
      nonStop: 'true', // Only direct flights
      maxPrice: '500',
      viewBy: 'DESTINATION',
    });

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
    const destinations = inspirationData.data || [];
    console.log(`Found ${destinations.length} direct destinations from Amsterdam`);

    // Step 4: Store in Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const destinationsToUpsert = destinations.map((dest: AmadeusDestination) => {
      const destCode = dest.destination;
      const cityInfo = CITY_NAMES[destCode] || { city: destCode, country: 'Unknown' };
      
      return {
        destination_code: destCode,
        city: cityInfo.city,
        country: cityInfo.country,
        last_price: parseFloat(dest.price.total),
        currency: 'EUR',
        last_synced_at: new Date().toISOString(),
      };
    });

    // Upsert destinations
    const { data: upsertData, error: upsertError } = await supabase
      .from('ams_destinations')
      .upsert(destinationsToUpsert, {
        onConflict: 'destination_code',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('Error upserting destinations:', upsertError);
      throw upsertError;
    }

    console.log(`Successfully synced ${destinationsToUpsert.length} destinations`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${destinationsToUpsert.length} destinations from Amsterdam`,
        destinations: destinationsToUpsert.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in sync-ams-destinations function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to sync Amsterdam destinations'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
