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
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(secrets.SUPABASE_URL, secrets.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { orderId } = JSON.parse(event.body || "{}");
    console.log('Fetching flight order:', orderId);

    const apiKey = secrets.AMADEUS_TEST_API_KEY;
    const apiSecret = secrets.AMADEUS_TEST_API_SECRET;
    const apiUrl = secrets.AMADEUS_TEST_API_URL;

    if (!apiKey || !apiSecret || !apiUrl) {
      throw new Error('Missing Amadeus API credentials');
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

    // Get flight order
    const orderResponse = await fetch(`${apiUrl}/v1/booking/flight-orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error('Failed to fetch order:', errorText);
      throw new Error(`Failed to fetch order: ${orderResponse.status}`);
    }

    const orderData = await orderResponse.json();
    console.log('Successfully fetched flight order');

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    };
  } catch (error: unknown) {
    console.error('Error in get-flight-order function:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', details: 'Failed to fetch flight order' }),
    };
  }
};
