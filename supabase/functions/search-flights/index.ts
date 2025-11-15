import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
}

interface FlightSearchParams {
  originLocationCode: string;
  destinationLocationCode: string;
  departureDate: string;
  returnDate: string;
  adults: number;
  maxPrice?: number;
  currencyCode?: string;
}

// Popular European weekend destinations
const POPULAR_DESTINATIONS = [
  'PAR', 'BCN', 'ROM', 'LON', 'AMS', 'BER', 'MAD', 'VIE', 
  'PRG', 'DUB', 'LIS', 'ATH', 'IST', 'CPH', 'STO'
];

async function searchFlightsToDestination(
  accessToken: string,
  apiUrl: string,
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  maxPrice: number | undefined,
  adults: number
) {
  const searchParams = new URLSearchParams({
    originLocationCode: origin,
    destinationLocationCode: destination,
    departureDate,
    returnDate,
    adults: adults.toString(),
    currencyCode: 'EUR',
    max: '5', // Limit results per destination
  });

  if (maxPrice) {
    searchParams.append('maxPrice', maxPrice.toString());
  }

  const response = await fetch(
    `https://${apiUrl}/v2/shopping/flight-offers?${searchParams.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.ok) {
    return await response.json();
  }
  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, departureDate, returnDate, maxPrice, adults = 1 } = await req.json();

    console.log('Flight search request:', { origin, departureDate, returnDate, maxPrice, adults });

    // Get Amadeus credentials from environment
    const apiKey = Deno.env.get('AMADEUS_TEST_API_KEY');
    const apiSecret = Deno.env.get('AMADEUS_TEST_API_SECRET');
    const apiUrl = Deno.env.get('AMADEUS_TEST_API_URL') || 'test.api.amadeus.com';

    if (!apiKey || !apiSecret) {
      throw new Error('Amadeus API credentials not configured');
    }

    // Step 1: Get OAuth token
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

    // Filter out the origin from destinations
    const destinations = POPULAR_DESTINATIONS.filter(dest => dest !== origin);
    
    // Search flights to multiple destinations in parallel
    console.log(`Searching flights from ${origin} to ${destinations.length} destinations`);
    
    const searchPromises = destinations.slice(0, 10).map(destination =>
      searchFlightsToDestination(
        tokenData.access_token,
        apiUrl,
        origin,
        destination,
        departureDate,
        returnDate,
        maxPrice,
        adults
      ).catch(err => {
        console.error(`Failed to search ${origin}->${destination}:`, err.message);
        return null;
      })
    );

    const results = await Promise.all(searchPromises);
    
    // Combine all flight offers
    const allFlights = results
      .filter(result => result && result.data)
      .flatMap(result => result.data);

    console.log(`Found ${allFlights.length} total flight offers across destinations`);

    // Sort by price
    allFlights.sort((a, b) => 
      parseFloat(a.price.total) - parseFloat(b.price.total)
    );

    // Return top 50 cheapest flights
    const topFlights = allFlights.slice(0, 50);

    return new Response(JSON.stringify({ 
      data: topFlights,
      meta: {
        count: topFlights.length,
        destinationsSearched: destinations.slice(0, 10).length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-flights function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to search flights'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
