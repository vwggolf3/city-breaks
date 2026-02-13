import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSecrets } from "../shared/secrets";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
}

const FlightSearchSchema = z.object({
  origin: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
  destination: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maxPrice: z.number().positive().max(100000).optional(),
  adults: z.number().int().min(1).max(9).default(1),
  departureTimePreference: z.enum(['any', 'morning', 'afternoon', 'evening', 'night']).optional(),
  arrivalTimePreference: z.enum(['any', 'morning', 'afternoon', 'evening', 'night']).optional(),
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: "" };
  }

  try {
    const secrets = await getSecrets();
    const supabase = createClient(secrets.SUPABASE_URL, secrets.SUPABASE_ANON_KEY);

    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader) {
      return { statusCode: 401, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Authentication required" }) };
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return { statusCode: 401, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Invalid authentication" }) };
    }

    const rawInput = JSON.parse(event.body || "{}");
    const validationResult = FlightSearchSchema.safeParse(rawInput);

    if (!validationResult.success) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid input parameters", details: validationResult.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") }),
      };
    }

    const { origin, destination, departureDate, returnDate, maxPrice, adults, departureTimePreference, arrivalTimePreference } = validationResult.data;

    const apiKey = secrets.AMADEUS_TEST_API_KEY;
    const apiSecret = secrets.AMADEUS_TEST_API_SECRET;
    const apiUrl = secrets.AMADEUS_TEST_API_URL || "test.api.amadeus.com";

    if (!apiKey || !apiSecret) {
      throw new Error("Amadeus API credentials not configured");
    }

    const tokenResponse = await fetch(`https://${apiUrl}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`,
    });

    if (!tokenResponse.ok) throw new Error(`Failed to get Amadeus token: ${tokenResponse.status}`);
    const tokenData: AmadeusTokenResponse = await tokenResponse.json();

    const searchParams = new URLSearchParams({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate,
      returnDate,
      adults: adults.toString(),
      currencyCode: "EUR",
      max: "50",
    });
    if (maxPrice) searchParams.append("maxPrice", maxPrice.toString());

    const flightResponse = await fetch(`https://${apiUrl}/v2/shopping/flight-offers?${searchParams.toString()}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
    });

    if (!flightResponse.ok) throw new Error(`Flight search failed: ${flightResponse.status}`);
    const flightData = await flightResponse.json();

    let filteredFlights = flightData.data || [];
    if (departureTimePreference && departureTimePreference !== "any" && filteredFlights.length > 0) {
      filteredFlights = filteredFlights.filter((flight: any) => {
        const hour = parseInt(flight.itineraries[0].segments[0].departure.at.split("T")[1].split(":")[0]);
        switch (departureTimePreference) {
          case "morning": return hour >= 6 && hour < 12;
          case "afternoon": return hour >= 12 && hour < 18;
          case "evening": return hour >= 18 && hour < 24;
          default: return true;
        }
      });
    }
    if (arrivalTimePreference && arrivalTimePreference !== "any" && filteredFlights.length > 0) {
      filteredFlights = filteredFlights.filter((flight: any) => {
        const segs = flight.itineraries[0].segments;
        const hour = parseInt(segs[segs.length - 1].arrival.at.split("T")[1].split(":")[0]);
        switch (arrivalTimePreference) {
          case "morning": return hour >= 6 && hour < 12;
          case "afternoon": return hour >= 12 && hour < 18;
          case "evening": return hour >= 18 && hour < 24;
          default: return true;
        }
      });
    }

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...flightData, data: filteredFlights }) };
  } catch (error) {
    const err = error as Error;
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: err.message, details: "Failed to search flights" }) };
  }
};
