import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Popular European destinations with city names
const EUROPEAN_DESTINATIONS = [
  { code: 'PAR', city: 'Paris', country: 'France' },
  { code: 'LON', city: 'London', country: 'United Kingdom' },
  { code: 'BCN', city: 'Barcelona', country: 'Spain' },
  { code: 'ROM', city: 'Rome', country: 'Italy' },
  { code: 'AMS', city: 'Amsterdam', country: 'Netherlands' },
  { code: 'BER', city: 'Berlin', country: 'Germany' },
  { code: 'MAD', city: 'Madrid', country: 'Spain' },
  { code: 'VIE', city: 'Vienna', country: 'Austria' },
  { code: 'PRG', city: 'Prague', country: 'Czech Republic' },
  { code: 'DUB', city: 'Dublin', country: 'Ireland' },
  { code: 'LIS', city: 'Lisbon', country: 'Portugal' },
  { code: 'ATH', city: 'Athens', country: 'Greece' },
  { code: 'IST', city: 'Istanbul', country: 'Turkey' },
  { code: 'CPH', city: 'Copenhagen', country: 'Denmark' },
  { code: 'STO', city: 'Stockholm', country: 'Sweden' },
  { code: 'BRU', city: 'Brussels', country: 'Belgium' },
  { code: 'MIL', city: 'Milan', country: 'Italy' },
  { code: 'VCE', city: 'Venice', country: 'Italy' },
  { code: 'MUC', city: 'Munich', country: 'Germany' },
  { code: 'ZRH', city: 'Zurich', country: 'Switzerland' },
  { code: 'OSL', city: 'Oslo', country: 'Norway' },
  { code: 'HEL', city: 'Helsinki', country: 'Finland' },
  { code: 'WAW', city: 'Warsaw', country: 'Poland' },
  { code: 'BUD', city: 'Budapest', country: 'Hungary' },
  { code: 'EDI', city: 'Edinburgh', country: 'United Kingdom' },
  { code: 'DUS', city: 'Dusseldorf', country: 'Germany' },
  { code: 'OPO', city: 'Porto', country: 'Portugal' },
  { code: 'NCE', city: 'Nice', country: 'France' },
  { code: 'AGP', city: 'Malaga', country: 'Spain' },
  { code: 'SVQ', city: 'Seville', country: 'Spain' },
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    // If no query, return all European destinations
    if (!query || query.length < 1) {
      return new Response(JSON.stringify({ data: EUROPEAN_DESTINATIONS }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter destinations by query
    const searchTerm = query.toLowerCase();
    const filtered = EUROPEAN_DESTINATIONS.filter(dest => 
      dest.city.toLowerCase().includes(searchTerm) ||
      dest.country.toLowerCase().includes(searchTerm) ||
      dest.code.toLowerCase().includes(searchTerm)
    );

    console.log(`Found ${filtered.length} destinations matching "${query}"`);

    return new Response(JSON.stringify({ data: filtered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-destinations function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to get destinations'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
