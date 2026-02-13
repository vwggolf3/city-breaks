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
      console.error('Missing authorization header');
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: 'Unauthorized', details: 'Missing authorization header' }),
      };
    }

    const supabase = createClient(secrets.SUPABASE_URL, secrets.SUPABASE_ANON_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Authentication failed:', userError?.message);
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: 'Unauthorized', details: 'Invalid authentication token' }),
      };
    }

    console.log('Authenticated user:', user.id);

    const { flightOffer } = JSON.parse(event.body || "{}");
    console.log('Confirming flight price for offer:', flightOffer.id);

    const apiKey = secrets.AMADEUS_TEST_API_KEY;
    const apiSecret = secrets.AMADEUS_TEST_API_SECRET;
    let apiUrl = secrets.AMADEUS_TEST_API_URL;

    if (!apiKey || !apiSecret || !apiUrl) {
      throw new Error('Missing Amadeus API credentials');
    }

    // Ensure API URL has protocol
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `https://${apiUrl}`;
    }

    // Get access token
    const tokenResponse = await fetch(`${apiUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`,
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get access token: ${tokenResponse.status}`);
    }

    const tokenData: AmadeusTokenResponse = await tokenResponse.json();
    console.log('Successfully obtained access token');

    // Confirm flight price
    const priceResponse = await fetch(`${apiUrl}/v1/shopping/flight-offers/pricing`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'flight-offers-pricing',
          flightOffers: [flightOffer]
        }
      }),
    });

    if (!priceResponse.ok) {
      const errorText = await priceResponse.text();
      console.error('Price confirmation failed:', errorText);
      throw new Error(`Price confirmation failed: ${priceResponse.status}`);
    }

    const priceData = await priceResponse.json();
    console.log('Successfully confirmed flight price');

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(priceData),
    };
  } catch (error: unknown) {
    console.error('Error in confirm-flight-price function:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', details: 'Failed to confirm flight price' }),
    };
  }
};
