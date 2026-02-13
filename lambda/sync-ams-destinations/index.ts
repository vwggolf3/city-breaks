import { createClient } from "@supabase/supabase-js";
import { getSecrets } from "../shared/secrets";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: "" };
  }

  try {
    console.log('🔄 Starting Amsterdam Thu/Fri/Sat European destinations sync...');
    const secrets = await getSecrets();

    const schipholAppId = secrets.SCHIPHOL_APP_ID;
    const schipholAppKey = secrets.SCHIPHOL_APP_KEY;

    if (!schipholAppId || !schipholAppKey) {
      throw new Error('Schiphol API credentials not configured');
    }

    const today = new Date();
    const currentDay = today.getDay();

    const daysUntilThursday = (4 - currentDay + 7) % 7 || 7;
    const nextThursday = new Date(today);
    nextThursday.setDate(today.getDate() + daysUntilThursday);

    const daysUntilFriday = (5 - currentDay + 7) % 7 || 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);

    const daysUntilSaturday = (6 - currentDay + 7) % 7 || 7;
    const nextSaturday = new Date(today);
    nextSaturday.setDate(today.getDate() + daysUntilSaturday);

    const thursdayDate = nextThursday.toISOString().split('T')[0];
    const fridayDate = nextFriday.toISOString().split('T')[0];
    const saturdayDate = nextSaturday.toISOString().split('T')[0];

    console.log(`📅 Querying Schiphol for flights on ${thursdayDate} (Thu), ${fridayDate} (Fri), and ${saturdayDate} (Sat)`);

    const destinationAirlines = new Map<string, Set<string>>();

    for (const scheduleDate of [thursdayDate, fridayDate, saturdayDate]) {
      console.log(`✈️  Fetching ALL flights for ${scheduleDate}...`);

      let page = 0;
      let totalFlightsForDay = 0;
      let hasMorePages = true;
      let consecutiveErrors = 0;

      while (hasMorePages) {
        const schipholUrl = new URL('https://api.schiphol.nl/public-flights/flights');
        schipholUrl.searchParams.append('scheduleDate', scheduleDate);
        schipholUrl.searchParams.append('flightDirection', 'D');
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

          flights.forEach((flight: SchipholFlight) => {
            if (flight.route?.destinations && flight.route.destinations.length > 0) {
              const destination = flight.route.destinations[flight.route.destinations.length - 1];
              const airline = flight.prefixIATA;

              if (destination && destination.length === 3 && airline) {
                if (!destinationAirlines.has(destination)) {
                  destinationAirlines.set(destination, new Set<string>());
                }
                destinationAirlines.get(destination)!.add(airline);
              }
            }
          });

          if (flights.length < 20) {
            hasMorePages = false;
          } else {
            page++;
            if (page >= 50) {
              console.warn(`   ⚠️  Reached max page limit (50) for ${scheduleDate}`);
              hasMorePages = false;
            }
          }

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

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`🌍 Found ${destinationAirlines.size} unique destinations`);

    const supabase = createClient(secrets.SUPABASE_URL, secrets.SUPABASE_SERVICE_ROLE_KEY);

    console.log(`💾 Storing ${destinationAirlines.size} destinations with airlines to database...`);

    const destinationsToStore = Array.from(destinationAirlines.entries()).map(([code, airlines]) => ({
      destination_code: code,
      city: code,
      country: 'Unknown',
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

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        message: `Synced ${destinationsToStore.length} destinations from Amsterdam`,
        destinations: destinationsToStore.length,
        thursdayDate,
        fridayDate,
        saturdayDate,
        destinationCodes: Array.from(destinationAirlines.keys()),
      }),
    };
  } catch (error) {
    console.error('❌ Error in sync-ams-destinations function:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to sync Amsterdam destinations from Schiphol'
      }),
    };
  }
};
