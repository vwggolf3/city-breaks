import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSecrets } from "../shared/secrets";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const AirportQuerySchema = z.object({
  query: z.string()
    .trim()
    .max(100, { message: "Query must be less than 100 characters" })
    .regex(/^[a-zA-Z0-9\s-]*$/, { message: "Query contains invalid characters" })
    .optional()
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: "" };
  }

  try {
    const secrets = await getSecrets();
    const rawInput = JSON.parse(event.body || "{}");

    const validationResult = AirportQuerySchema.safeParse(rawInput);

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

    const supabase = createClient(secrets.SUPABASE_URL, secrets.SUPABASE_ANON_KEY);

    let queryBuilder = supabase
      .from('airports')
      .select('iata_code, name, city, country')
      .order('name');

    if (query && query.trim().length > 0) {
      const searchQuery = query.trim();
      console.log(`Searching for airports matching "${searchQuery}"`);

      queryBuilder = queryBuilder.or(
        `name.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,country.ilike.%${searchQuery}%,iata_code.ilike.%${searchQuery}%`
      );
    } else {
      console.log('No query provided, returning limited airports');
      queryBuilder = queryBuilder.limit(100);
    }

    const { data: airports, error } = await queryBuilder;

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log(`Found ${airports?.length || 0} airports`);

    const formattedAirports = (airports || []).map(airport => ({
      name: airport.name,
      iataCode: airport.iata_code,
      city: airport.city,
      country: airport.country,
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: formattedAirports }),
    };
  } catch (error) {
    console.error('Error in get-airports function:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to get airports'
      }),
    };
  }
};
