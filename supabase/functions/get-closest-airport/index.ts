import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schema for location coordinates
const LocationSchema = z.object({
  latitude: z.number()
    .min(-90, { message: "Invalid latitude: must be between -90 and 90" })
    .max(90, { message: "Invalid latitude: must be between -90 and 90" })
    .optional(),
  longitude: z.number()
    .min(-180, { message: "Invalid longitude: must be between -180 and 180" })
    .max(180, { message: "Invalid longitude: must be between -180 and 180" })
    .optional()
});

// European airports with coordinates
const EUROPEAN_AIRPORTS = [
  { name: 'London Heathrow Airport', iataCode: 'LHR', city: 'London', country: 'United Kingdom', lat: 51.4700, lon: -0.4543 },
  { name: 'London Gatwick Airport', iataCode: 'LGW', city: 'London', country: 'United Kingdom', lat: 51.1537, lon: -0.1821 },
  { name: 'Manchester Airport', iataCode: 'MAN', city: 'Manchester', country: 'United Kingdom', lat: 53.3537, lon: -2.2750 },
  { name: 'Charles de Gaulle Airport', iataCode: 'CDG', city: 'Paris', country: 'France', lat: 49.0097, lon: 2.5479 },
  { name: 'Amsterdam Airport Schiphol', iataCode: 'AMS', city: 'Amsterdam', country: 'Netherlands', lat: 52.3105, lon: 4.7683 },
  { name: 'Frankfurt Airport', iataCode: 'FRA', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lon: 8.5622 },
  { name: 'Munich Airport', iataCode: 'MUC', city: 'Munich', country: 'Germany', lat: 48.3538, lon: 11.7861 },
  { name: 'Berlin Brandenburg Airport', iataCode: 'BER', city: 'Berlin', country: 'Germany', lat: 52.3667, lon: 13.5033 },
  { name: 'Madrid-Barajas Airport', iataCode: 'MAD', city: 'Madrid', country: 'Spain', lat: 40.4983, lon: -3.5676 },
  { name: 'Barcelona-El Prat Airport', iataCode: 'BCN', city: 'Barcelona', country: 'Spain', lat: 41.2974, lon: 2.0833 },
  { name: 'Leonardo da Vinci-Fiumicino Airport', iataCode: 'FCO', city: 'Rome', country: 'Italy', lat: 41.8003, lon: 12.2389 },
  { name: 'Milan Malpensa Airport', iataCode: 'MXP', city: 'Milan', country: 'Italy', lat: 45.6306, lon: 8.7281 },
  { name: 'Vienna International Airport', iataCode: 'VIE', city: 'Vienna', country: 'Austria', lat: 48.1103, lon: 16.5697 },
  { name: 'Zurich Airport', iataCode: 'ZRH', city: 'Zurich', country: 'Switzerland', lat: 47.4582, lon: 8.5556 },
  { name: 'Lisbon Portela Airport', iataCode: 'LIS', city: 'Lisbon', country: 'Portugal', lat: 38.7756, lon: -9.1354 },
  { name: 'Athens International Airport', iataCode: 'ATH', city: 'Athens', country: 'Greece', lat: 37.9364, lon: 23.9445 },
  { name: 'Dublin Airport', iataCode: 'DUB', city: 'Dublin', country: 'Ireland', lat: 53.4213, lon: -6.2701 },
  { name: 'Copenhagen Airport', iataCode: 'CPH', city: 'Copenhagen', country: 'Denmark', lat: 55.6180, lon: 12.6560 },
  { name: 'Stockholm Arlanda Airport', iataCode: 'ARN', city: 'Stockholm', country: 'Sweden', lat: 59.6519, lon: 17.9186 },
  { name: 'Oslo Gardermoen Airport', iataCode: 'OSL', city: 'Oslo', country: 'Norway', lat: 60.1939, lon: 11.1004 },
  { name: 'Helsinki-Vantaa Airport', iataCode: 'HEL', city: 'Helsinki', country: 'Finland', lat: 60.3172, lon: 24.9633 },
  { name: 'Warsaw Chopin Airport', iataCode: 'WAW', city: 'Warsaw', country: 'Poland', lat: 52.1657, lon: 20.9671 },
  { name: 'Václav Havel Airport Prague', iataCode: 'PRG', city: 'Prague', country: 'Czech Republic', lat: 50.1008, lon: 14.2600 },
  { name: 'Budapest Ferenc Liszt Airport', iataCode: 'BUD', city: 'Budapest', country: 'Hungary', lat: 47.4369, lon: 19.2556 },
  { name: 'Brussels Airport', iataCode: 'BRU', city: 'Brussels', country: 'Belgium', lat: 50.9010, lon: 4.4856 },
  { name: 'Istanbul Airport', iataCode: 'IST', city: 'Istanbul', country: 'Turkey', lat: 41.2753, lon: 28.7519 },
  { name: 'Edinburgh Airport', iataCode: 'EDI', city: 'Edinburgh', country: 'United Kingdom', lat: 55.9500, lon: -3.3725 },
  { name: 'Nice Côte d\'Azur Airport', iataCode: 'NCE', city: 'Nice', country: 'France', lat: 43.6584, lon: 7.2159 },
  { name: 'Venice Marco Polo Airport', iataCode: 'VCE', city: 'Venice', country: 'Italy', lat: 45.5053, lon: 12.3519 },
  { name: 'Geneva Airport', iataCode: 'GVA', city: 'Geneva', country: 'Switzerland', lat: 46.2381, lon: 6.1090 },
];

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate any provided coordinates from request body (if applicable)
    const rawInput = await req.json().catch(() => ({}));
    const validationResult = LocationSchema.safeParse(rawInput);
    
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input parameters',
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get client IP from request headers
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     '8.8.8.8'; // Fallback IP for development

    console.log(`Client IP: ${clientIP}`);

    // Get geolocation from IP using ip-api.com (free, no key needed)
    const geoResponse = await fetch(`http://ip-api.com/json/${clientIP}?fields=status,country,city,lat,lon`);
    
    if (!geoResponse.ok) {
      throw new Error('Failed to get location from IP');
    }

    const geoData = await geoResponse.json();
    
    if (geoData.status !== 'success') {
      throw new Error('IP geolocation failed');
    }

    console.log(`Location: ${geoData.city}, ${geoData.country} (${geoData.lat}, ${geoData.lon})`);

    // Find the closest airport
    let closestAirport = EUROPEAN_AIRPORTS[0];
    let minDistance = calculateDistance(geoData.lat, geoData.lon, closestAirport.lat, closestAirport.lon);

    for (const airport of EUROPEAN_AIRPORTS) {
      const distance = calculateDistance(geoData.lat, geoData.lon, airport.lat, airport.lon);
      if (distance < minDistance) {
        minDistance = distance;
        closestAirport = airport;
      }
    }

    console.log(`Closest airport: ${closestAirport.name} (${closestAirport.iataCode}) - ${minDistance.toFixed(2)}km away`);

    return new Response(
      JSON.stringify({ 
        airport: {
          name: closestAirport.name,
          iataCode: closestAirport.iataCode,
          city: closestAirport.city,
          country: closestAirport.country
        },
        distance: Math.round(minDistance),
        userLocation: {
          city: geoData.city,
          country: geoData.country,
          lat: geoData.lat,
          lon: geoData.lon
        }
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in get-closest-airport function:', error);
    
    // Return a default airport (London Heathrow) on error
    return new Response(
      JSON.stringify({ 
        airport: {
          name: 'London Heathrow Airport',
          iataCode: 'LHR',
          city: 'London',
          country: 'United Kingdom'
        },
        distance: null,
        userLocation: null,
        error: 'Could not detect location, using default airport'
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
