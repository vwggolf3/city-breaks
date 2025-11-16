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

    // Store in Supabase - just the raw destination codes and airlines
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`💾 Storing ${destinationAirlines.size} destinations with airlines to database...`);

    const destinationsToStore = Array.from(destinationAirlines.entries()).map(([code, airlines]) => ({
      destination_code: code,
      city: code, // Placeholder - will enrich later
      country: 'Unknown', // Placeholder - will enrich later
      airlines: Array.from(airlines),
      last_synced_at: new Date().toISOString(),
    }));

    const { data: upsertData, error: upsertError } = await supabase
      .from('ams_destinations')
      .upsert(destinationsToStore, {
        onConflict: 'destination_code',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('❌ Error upserting destinations:', upsertError);
      throw upsertError;
    }

    console.log(`✅ Successfully synced ${destinationsToStore.length} destinations from Amsterdam (Thu/Fri/Sat)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${destinationsToStore.length} destinations from Amsterdam`,
        destinations: destinationsToStore.length,
        thursdayDate,
        fridayDate,
        saturdayDate,
        destinationCodes: Array.from(destinationAirlines.keys()),
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
