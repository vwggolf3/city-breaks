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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, destination, departureDate, returnDate, maxPrice, adults = 1, departureTimePreference, arrivalTimePreference } = await req.json();

    console.log('Flight search request:', { origin, destination, departureDate, returnDate, maxPrice, adults, departureTimePreference, arrivalTimePreference });

    // Get Amadeus credentials from environment
    const apiKey = Deno.env.get('AMADEUS_TEST_API_KEY');
    const apiSecret = Deno.env.get('AMADEUS_TEST_API_SECRET');
    const apiUrl = Deno.env.get('AMADEUS_TEST_API_URL') || 'test.api.amadeus.com';

    if (!apiKey || !apiSecret) {
      throw new Error('Amadeus API credentials not configured');
    }

    if (!origin || !destination) {
      throw new Error('Origin and destination are required');
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

    // Search for specific destination
    const searchParams = new URLSearchParams({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate,
      returnDate,
      adults: adults.toString(),
      currencyCode: 'EUR',
      max: '50',
    });

    if (maxPrice) {
      searchParams.append('maxPrice', maxPrice.toString());
    }

    console.log('Searching flights with params:', searchParams.toString());

    const flightResponse = await fetch(
      `https://${apiUrl}/v2/shopping/flight-offers?${searchParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!flightResponse.ok) {
      const errorText = await flightResponse.text();
      console.error('Flight search error:', errorText);
      throw new Error(`Flight search failed: ${flightResponse.status}`);
    }

    const flightData = await flightResponse.json();
    console.log(`Found ${flightData.data?.length || 0} flight offers`);

    // Filter flights by departure time preference if specified
    let filteredFlights = flightData.data || [];
    if (departureTimePreference && departureTimePreference !== 'any' && filteredFlights.length > 0) {
      filteredFlights = filteredFlights.filter((flight: any) => {
        const departureTime = flight.itineraries[0].segments[0].departure.at;
        const hour = parseInt(departureTime.split('T')[1].split(':')[0]);
        
        switch (departureTimePreference) {
          case 'morning':
            return hour >= 6 && hour < 12;
          case 'afternoon':
            return hour >= 12 && hour < 18;
          case 'evening':
            return hour >= 18 && hour < 24;
          default:
            return true;
        }
      });
      console.log(`Filtered to ${filteredFlights.length} flights matching ${departureTimePreference} departure preference`);
    }

    // Filter flights by arrival time preference if specified
    if (arrivalTimePreference && arrivalTimePreference !== 'any' && filteredFlights.length > 0) {
      filteredFlights = filteredFlights.filter((flight: any) => {
        const arrivalTime = flight.itineraries[0].segments[flight.itineraries[0].segments.length - 1].arrival.at;
        const hour = parseInt(arrivalTime.split('T')[1].split(':')[0]);
        
        switch (arrivalTimePreference) {
          case 'morning':
            return hour >= 6 && hour < 12;
          case 'afternoon':
            return hour >= 12 && hour < 18;
          case 'evening':
            return hour >= 18 && hour < 24;
          default:
            return true;
        }
      });
      console.log(`Filtered to ${filteredFlights.length} flights matching ${arrivalTimePreference} arrival preference`);
    }

    return new Response(JSON.stringify({ ...flightData, data: filteredFlights }), {
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
