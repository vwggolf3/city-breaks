import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SchipholFlight {
  prefixIATA: string;
  flightName: string;
  scheduleDateTime: string;
  flightDirection: string;
  route: {
    destinations: string[];
    eu: string;
    visa: boolean;
  };
  aircraftType?: {
    iataMain: string;
    iataSub: string;
  };
  terminal?: number;
}

interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
}

interface AmadeusAirport {
  iataCode: string;
  name: string;
  address: {
    cityName: string;
    countryName: string;
    countryCode: string;
  };
}

// European country codes (ISO 3166-1 alpha-2)
const EUROPEAN_COUNTRIES = new Set([
  'AD', 'AL', 'AT', 'AX', 'BA', 'BE', 'BG', 'BY', 'CH', 'CZ', 'DE', 'DK', 
  'EE', 'ES', 'FI', 'FO', 'FR', 'GB', 'GG', 'GI', 'GR', 'HR', 'HU', 'IE', 
  'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 
  'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SJ', 'SK', 
  'SM', 'UA', 'VA', 'XK'
]);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting Amsterdam Thu/Fri/Sat European destinations sync...');

    // Get Schiphol credentials
    const schipholAppId = Deno.env.get('SCHIPHOL_APP_ID');
    const schipholAppKey = Deno.env.get('SCHIPHOL_APP_KEY');

    if (!schipholAppId || !schipholAppKey) {
      throw new Error('Schiphol API credentials not configured');
    }

    // Calculate next Thursday, Friday, and Saturday
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 4 = Thursday, 5 = Friday, 6 = Saturday
    
    // Days until next Thursday (4)
    const daysUntilThursday = (4 - currentDay + 7) % 7 || 7;
    const nextThursday = new Date(today);
    nextThursday.setDate(today.getDate() + daysUntilThursday);
    
    // Days until next Friday (5)
    const daysUntilFriday = (5 - currentDay + 7) % 7 || 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);

    // Days until next Saturday (6)
    const daysUntilSaturday = (6 - currentDay + 7) % 7 || 7;
    const nextSaturday = new Date(today);
    nextSaturday.setDate(today.getDate() + daysUntilSaturday);

    const thursdayDate = nextThursday.toISOString().split('T')[0];
    const fridayDate = nextFriday.toISOString().split('T')[0];
    const saturdayDate = nextSaturday.toISOString().split('T')[0];

    console.log(`📅 Querying Schiphol for flights on ${thursdayDate} (Thu), ${fridayDate} (Fri), and ${saturdayDate} (Sat)`);

    // Map to store destination -> Set of airlines
    const destinationAirlines = new Map<string, Set<string>>();

    // Query Schiphol for Thursday, Friday, and Saturday with pagination
    for (const scheduleDate of [thursdayDate, fridayDate, saturdayDate]) {
      console.log(`✈️  Fetching ALL flights for ${scheduleDate}...`);
      
      let page = 0;
      let totalFlightsForDay = 0;
      let hasMorePages = true;
      let consecutiveErrors = 0;

      while (hasMorePages) {
        const schipholUrl = new URL('https://api.schiphol.nl/public-flights/flights');
        schipholUrl.searchParams.append('scheduleDate', scheduleDate);
        schipholUrl.searchParams.append('flightDirection', 'D'); // D = Departures
        schipholUrl.searchParams.append('includedelays', 'false');
        schipholUrl.searchParams.append('page', page.toString());
        schipholUrl.searchParams.append('sort', '+scheduleTime');

        try {
          const schipholResponse = await fetch(schipholUrl.toString(), {
            headers: {
              'ResourceVersion': 'v4',
              'app_id': schipholAppId,
              'app_key': schipholAppKey,
              'Accept': 'application/json',
            },
          });

          if (!schipholResponse.ok) {
            if (schipholResponse.status === 429) {
              console.warn(`   ⚠️  Rate limited on page ${page}, stopping this day`);
              hasMorePages = false;
              continue;
            }
            const errorText = await schipholResponse.text();
            console.error(`❌ Schiphol API error for ${scheduleDate} page ${page}: ${errorText}`);
            consecutiveErrors++;
            if (consecutiveErrors >= 3) {
              console.warn(`   ⚠️  Too many errors, stopping this day`);
              hasMorePages = false;
              continue;
            }
          }

          const schipholData = await schipholResponse.json();
          const flights: SchipholFlight[] = schipholData.flights || [];
          
          totalFlightsForDay += flights.length;
          consecutiveErrors = 0;

          // Extract unique destination-airline pairs
          flights.forEach((flight: SchipholFlight) => {
            if (flight.route?.destinations && flight.route.destinations.length > 0) {
              // Get the final destination (last in array)
              const destination = flight.route.destinations[flight.route.destinations.length - 1];
              const airline = flight.prefixIATA; // Airline IATA code
              
              if (destination && destination.length === 3 && airline) {
                if (!destinationAirlines.has(destination)) {
                  destinationAirlines.set(destination, new Set<string>());
                }
                destinationAirlines.get(destination)!.add(airline);
              }
            }
          });

          // Check if there are more pages (Schiphol returns 20 per page)
          if (flights.length < 20) {
            hasMorePages = false;
          } else {
            page++;
            // Safety limit: max 50 pages per day to avoid timeouts and rate limits
            if (page >= 50) {
              console.warn(`   ⚠️  Reached max page limit (50) for ${scheduleDate}`);
              hasMorePages = false;
            }
          }
          
          // Add small delay between pages to be nice to the API
          if (hasMorePages) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`   ❌ Error fetching page ${page}:`, error);
          consecutiveErrors++;
          if (consecutiveErrors >= 3) {
            hasMorePages = false;
          }
        }
      }

      console.log(`   ✅ Total flights for ${scheduleDate}: ${totalFlightsForDay}`);
      
      // Add delay between days
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`🌍 Found ${destinationAirlines.size} unique destinations`);

    // Get Amadeus token to enrich European destinations only
    const amadeus_apiKey = Deno.env.get('AMADEUS_TEST_API_KEY');
    const amadeus_apiSecret = Deno.env.get('AMADEUS_TEST_API_SECRET');
    const amadeus_apiUrl = Deno.env.get('AMADEUS_TEST_API_URL') || 'test.api.amadeus.com';

    if (!amadeus_apiKey || !amadeus_apiSecret) {
      throw new Error('Amadeus API credentials not configured');
    }

    console.log('🔑 Getting Amadeus OAuth token...');
    const tokenResponse = await fetch(`https://${amadeus_apiUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${amadeus_apiKey}&client_secret=${amadeus_apiSecret}`,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Amadeus token error:', errorText);
      throw new Error(`Failed to get Amadeus token: ${tokenResponse.status}`);
    }

    const tokenData: AmadeusTokenResponse = await tokenResponse.json();

    // Enrich destinations with city and country names, filter for Europe only
    console.log(`📝 Enriching ${destinationAirlines.size} destinations with city/country names (European destinations only)...`);
    const enrichedDestinations = [];
    let enrichedCount = 0;
    let skippedCount = 0;

    for (const [destCode, airlines] of destinationAirlines.entries()) {
      try {
        const airportUrl = `https://${amadeus_apiUrl}/v1/reference-data/locations/${destCode}`;
        const airportResponse = await fetch(airportUrl, {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (airportResponse.ok) {
          const airportData = await airportResponse.json();
          const airport: AmadeusAirport = airportData.data;
          
          // Only include European destinations
          const countryCode = airport.address?.countryCode;
          if (countryCode && EUROPEAN_COUNTRIES.has(countryCode)) {
            enrichedDestinations.push({
              destination_code: destCode,
              city: airport.address?.cityName || destCode,
              country: airport.address?.countryName || 'Unknown',
              airlines: Array.from(airlines),
              last_synced_at: new Date().toISOString(),
            });
            enrichedCount++;
            console.log(`   ✓ ${destCode} → ${airport.address?.cityName}, ${airport.address?.countryName} (Airlines: ${Array.from(airlines).join(', ')})`);
          } else {
            skippedCount++;
            console.log(`   ⊗ ${destCode} → ${airport.address?.countryName || 'Unknown'} (Non-Europe, skipped)`);
          }
        } else if (airportResponse.status === 429) {
          console.warn(`   ⚠️  Rate limited for ${destCode}, skipping remaining`);
          break; // Stop enrichment if rate limited
        } else {
          console.warn(`   ⚠️  Could not enrich ${destCode}: ${airportResponse.status}`);
        }
        
        // Add delay between Amadeus API calls to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`   ❌ Error enriching ${destCode}:`, error);
      }
    }

    console.log(`✅ Enriched ${enrichedCount} European destinations, skipped ${skippedCount} non-European destinations`);

    // Store in Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`💾 Upserting ${enrichedDestinations.length} destinations to database...`);

    const { data: upsertData, error: upsertError } = await supabase
      .from('ams_destinations')
      .upsert(enrichedDestinations, {
        onConflict: 'destination_code',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('❌ Error upserting destinations:', upsertError);
      throw upsertError;
    }

    console.log(`✅ Successfully synced ${enrichedDestinations.length} European Thu/Fri/Sat destinations from Amsterdam`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${enrichedDestinations.length} European Thursday/Friday/Saturday destinations from Amsterdam`,
        destinations: enrichedDestinations.length,
        thursdayDate,
        fridayDate,
        saturdayDate,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in sync-ams-destinations function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to sync Amsterdam destinations from Schiphol'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
