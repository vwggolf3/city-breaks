import { createClient } from "@supabase/supabase-js";
import { getSecrets } from "../shared/secrets";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

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

const EUROPEAN_CITIES = [
  'London', 'Paris', 'Madrid', 'Rome', 'Berlin', 'Barcelona', 'Munich', 'Milan', 'Amsterdam',
  'Vienna', 'Hamburg', 'Warsaw', 'Budapest', 'Bucharest', 'Prague', 'Brussels', 'Copenhagen',
  'Stockholm', 'Helsinki', 'Dublin', 'Lisbon', 'Athens', 'Manchester', 'Birmingham', 'Glasgow',
  'Edinburgh', 'Lyon', 'Marseille', 'Nice', 'Toulouse', 'Frankfurt', 'Cologne', 'Stuttgart',
  'Düsseldorf', 'Dortmund', 'Essen', 'Bremen', 'Dresden', 'Leipzig', 'Hannover', 'Nuremberg',
  'Seville', 'Valencia', 'Bilbao', 'Málaga', 'Alicante', 'Palma', 'Zaragoza', 'Naples', 'Turin',
  'Venice', 'Florence', 'Bologna', 'Genoa', 'Catania', 'Palermo', 'Bari', 'Rotterdam', 'The Hague',
  'Utrecht', 'Eindhoven', 'Geneva', 'Zurich', 'Basel', 'Bern', 'Kraków', 'Gdańsk', 'Porto',
  'Bratislava', 'Cluj', 'Sofia', 'Zagreb', 'Belgrade', 'Thessaloniki', 'Oslo', 'Bergen', 'Gothenburg',
  'Malmö', 'Tampere', 'Turku', 'Tallinn', 'Riga', 'Vilnius', 'Luxembourg', 'Valletta', 'Nicosia',
  'Reykjavik', 'Bristol', 'Liverpool', 'Leeds', 'Newcastle', 'Cardiff', 'Belfast', 'Aberdeen',
  'Cork', 'Galway', 'Salzburg', 'Innsbruck', 'Graz', 'Antwerp', 'Ghent', 'Brno', 'Ostrava',
  'Wrocław', 'Poznań', 'Łódź', 'Timișoara', 'Constanța', 'Iași', 'Varna', 'Plovdiv', 'Split',
  'Dubrovnik', 'Ljubljana', 'Maribor', 'Košice', 'Oulu', 'Jyväskylä', 'Trondheim', 'Stavanger'
];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: "" };
  }

  try {
    console.log('Starting airport sync from Amadeus API...');
    const secrets = await getSecrets();

    const amadeusApiKey = secrets.AMADEUS_TEST_API_KEY;
    const amadeusApiSecret = secrets.AMADEUS_TEST_API_SECRET;
    let amadeusApiUrl = secrets.AMADEUS_TEST_API_URL || 'https://test.api.amadeus.com';

    // Ensure the URL has the https:// protocol
    if (!amadeusApiUrl.startsWith('http://') && !amadeusApiUrl.startsWith('https://')) {
      amadeusApiUrl = `https://${amadeusApiUrl}`;
    }

    if (!amadeusApiKey || !amadeusApiSecret) {
      throw new Error('Amadeus API credentials not configured');
    }

    const supabase = createClient(secrets.SUPABASE_URL, secrets.SUPABASE_SERVICE_ROLE_KEY);

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

    const seenIataCodes = new Set<string>();

    for (let i = 0; i < EUROPEAN_CITIES.length; i++) {
      const city = EUROPEAN_CITIES[i];
      console.log(`Fetching airports for city: ${city} (${i + 1}/${EUROPEAN_CITIES.length})`);

      try {
        const searchResponse = await fetch(
          `${amadeusApiUrl}/v1/reference-data/locations?subType=AIRPORT&keyword=${encodeURIComponent(city)}&page[limit]=20`,
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
            },
          }
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const locations: AmadeusLocation[] = searchData.data || [];

          console.log(`Found ${locations.length} airports near ${city}`);

          for (const location of locations) {
            if (location.subType === 'AIRPORT' && location.iataCode && !seenIataCodes.has(location.iataCode)) {
              seenIataCodes.add(location.iataCode);
              allAirports.push({
                iata_code: location.iataCode,
                name: location.name,
                city: location.address?.cityName || city,
                country: location.address?.countryName || 'Unknown',
                region: location.address?.regionCode || null,
                latitude: location.geoCode?.latitude || null,
                longitude: location.geoCode?.longitude || null,
              });
            }
          }
        } else if (searchResponse.status === 429) {
          console.log('Rate limit reached, waiting 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          i--;
          continue;
        } else {
          console.error(`Failed to fetch airports for ${city}: ${searchResponse.status}`);
        }

        if (i < EUROPEAN_CITIES.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      } catch (error) {
        console.error(`Error fetching airports for ${city}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    console.log(`Total unique airports fetched: ${allAirports.length}`);

    if (allAirports.length > 0) {
      console.log('Upserting airports into database...');

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

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        message: `Successfully synced ${allAirports.length} airports`,
        count: allAirports.length,
      }),
    };
  } catch (error) {
    console.error('Error in sync-airports function:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
    };
  }
};
