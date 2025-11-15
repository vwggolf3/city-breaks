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

interface AmadeusLocation {
  type: string;
  subType: string;
  name: string;
  iataCode: string;
  address?: {
    cityName?: string;
    countryName?: string;
    regionCode?: string;
  };
  geoCode?: {
    latitude: number;
    longitude: number;
  };
}

// European country codes
const EUROPEAN_COUNTRIES = [
  'GB', 'FR', 'DE', 'ES', 'IT', 'NL', 'BE', 'CH', 'AT', 'PT', 'SE', 'NO', 
  'DK', 'FI', 'IE', 'PL', 'CZ', 'HU', 'RO', 'GR', 'BG', 'HR', 'SK', 'SI',
  'LT', 'LV', 'EE', 'LU', 'MT', 'CY', 'IS'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting airport sync from Amadeus API...');

    // Get Amadeus credentials
    const amadeusApiKey = Deno.env.get('AMADEUS_TEST_API_KEY');
    const amadeusApiSecret = Deno.env.get('AMADEUS_TEST_API_SECRET');
    let amadeusApiUrl = Deno.env.get('AMADEUS_TEST_API_URL') || 'https://test.api.amadeus.com';
    
    // Ensure the URL has the https:// protocol
    if (!amadeusApiUrl.startsWith('http://') && !amadeusApiUrl.startsWith('https://')) {
      amadeusApiUrl = `https://${amadeusApiUrl}`;
    }

    if (!amadeusApiKey || !amadeusApiSecret) {
      throw new Error('Amadeus API credentials not configured');
    }

    // Get Supabase credentials
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get OAuth token from Amadeus
    console.log('Fetching Amadeus OAuth token...');
    const tokenResponse = await fetch(`${amadeusApiUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: amadeusApiKey,
        client_secret: amadeusApiSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to get Amadeus token: ${error}`);
    }

    const tokenData: AmadeusTokenResponse = await tokenResponse.json();
    console.log('Successfully obtained Amadeus OAuth token');

    const allAirports: Array<{
      iata_code: string;
      name: string;
      city: string;
      country: string;
      region: string | null;
      latitude: number | null;
      longitude: number | null;
    }> = [];

    // Fetch airports for each European country
    for (const countryCode of EUROPEAN_COUNTRIES) {
      console.log(`Fetching airports for country: ${countryCode}`);
      
      try {
        const searchResponse = await fetch(
          `${amadeusApiUrl}/v1/reference-data/locations?subType=AIRPORT&countryCode=${countryCode}&page[limit]=100`,
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
            },
          }
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const locations: AmadeusLocation[] = searchData.data || [];

          console.log(`Found ${locations.length} airports in ${countryCode}`);

          for (const location of locations) {
            if (location.subType === 'AIRPORT' && location.iataCode) {
              allAirports.push({
                iata_code: location.iataCode,
                name: location.name,
                city: location.address?.cityName || 'Unknown',
                country: location.address?.countryName || countryCode,
                region: location.address?.regionCode || null,
                latitude: location.geoCode?.latitude || null,
                longitude: location.geoCode?.longitude || null,
              });
            }
          }
        } else {
          console.error(`Failed to fetch airports for ${countryCode}: ${searchResponse.status}`);
        }
      } catch (error) {
        console.error(`Error fetching airports for ${countryCode}:`, error);
      }
    }

    console.log(`Total airports fetched: ${allAirports.length}`);

    // Upsert airports into database
    if (allAirports.length > 0) {
      console.log('Upserting airports into database...');
      
      // Process in batches of 100
      const batchSize = 100;
      for (let i = 0; i < allAirports.length; i += batchSize) {
        const batch = allAirports.slice(i, i + batchSize);
        const { error } = await supabase
          .from('airports')
          .upsert(
            batch.map(airport => ({
              ...airport,
              last_synced_at: new Date().toISOString(),
            })),
            { onConflict: 'iata_code' }
          );

        if (error) {
          console.error(`Error upserting batch ${i / batchSize + 1}:`, error);
        } else {
          console.log(`Upserted batch ${i / batchSize + 1} (${batch.length} airports)`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${allAirports.length} airports`,
        count: allAirports.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in sync-airports function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
