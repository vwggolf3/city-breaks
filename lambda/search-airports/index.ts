import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSecrets } from "../shared/secrets";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
}

const AirportSearchSchema = z.object({
  query: z.string().trim().min(2, { message: "Query must be at least 2 characters" }).max(100, { message: "Query must be less than 100 characters" }),
});

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

    const rawInput = JSON.parse(event.body || "{}");

    const validationResult = AirportSearchSchema.safeParse(rawInput);

    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.errors);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: 'Invalid input parameters',
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        }),
      };
    }

    const { query } = validationResult.data;

    console.log('Airport search request (validated):', query);

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

    const searchParams = new URLSearchParams({
      keyword: query,
      subType: 'AIRPORT,CITY',
    });

    console.log('Searching airports with query:', query);

    const airportResponse = await fetch(
      `https://${apiUrl}/v1/reference-data/locations?${searchParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!airportResponse.ok) {
      const errorText = await airportResponse.text();
      console.error('Airport search error:', errorText);
      throw new Error(`Airport search failed: ${airportResponse.status}`);
    }

    const airportData = await airportResponse.json();
    console.log(`Found ${airportData.data?.length || 0} airports/cities`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(airportData),
    };
  } catch (error) {
    console.error('Error in search-airports function:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to search airports'
      }),
    };
  }
};
