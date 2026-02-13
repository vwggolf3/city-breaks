import { createClient } from "@supabase/supabase-js";
import { getSecrets } from "../shared/secrets";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: "" };
  }

  try {
    const secrets = await getSecrets();

    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: 'Authentication required' }),
      };
    }

    const supabase = createClient(secrets.SUPABASE_URL, secrets.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: 'Invalid authentication' }),
      };
    }

    const { origin, departureDate, returnDate, maxPrice, departureTimePreference, arrivalTimePreference } = JSON.parse(event.body || "{}");

    console.log('Inspiration search request:', { origin, departureDate, returnDate, maxPrice });

    const apiKey = secrets.AMADEUS_TEST_API_KEY;
    const apiSecret = secrets.AMADEUS_TEST_API_SECRET;
    const apiUrl = secrets.AMADEUS_TEST_API_URL || 'test.api.amadeus.com';

    if (!apiKey || !apiSecret) {
      throw new Error('Amadeus API credentials not configured');
    }

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

    const { data: amsDestinations, error: dbError } = await supabase
      .from('ams_destinations')
      .select('destination_code, city, country')
      .order('city', { ascending: true });

    if (dbError) {
      console.error('Error fetching Amsterdam destinations:', dbError);
      throw new Error('Failed to fetch destinations from database');
    }

    if (!amsDestinations || amsDestinations.length === 0) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: 'No destinations available',
          details: 'Please run sync-ams-destinations function first to populate destinations'
        }),
      };
    }

    console.log(`Found ${amsDestinations.length} Thu/Fri destinations in database`);

    const flightResults = [];

    for (const dest of amsDestinations.slice(0, 20)) {
      try {
        const searchParams = new URLSearchParams({
          originLocationCode: origin,
          destinationLocationCode: dest.destination_code,
          departureDate,
          returnDate,
          adults: '1',
          currencyCode: 'EUR',
          max: '1',
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
      }
    }

    console.log(`Found ${flightResults.length} total flight options`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: flightResults,
        message: `Found ${flightResults.length} weekend destinations from ${origin}`
      }),
    };
  } catch (error) {
    console.error('Error in search-inspiration-flights function:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to search inspiration flights'
      }),
    };
  }
};
