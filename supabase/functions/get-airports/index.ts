import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Comprehensive list of European airports
const EUROPEAN_AIRPORTS = [
  // United Kingdom
  { name: 'London Heathrow Airport', iataCode: 'LHR', city: 'London', country: 'United Kingdom' },
  { name: 'London Gatwick Airport', iataCode: 'LGW', city: 'London', country: 'United Kingdom' },
  { name: 'Manchester Airport', iataCode: 'MAN', city: 'Manchester', country: 'United Kingdom' },
  { name: 'Edinburgh Airport', iataCode: 'EDI', city: 'Edinburgh', country: 'United Kingdom' },
  { name: 'Birmingham Airport', iataCode: 'BHX', city: 'Birmingham', country: 'United Kingdom' },
  { name: 'Glasgow Airport', iataCode: 'GLA', city: 'Glasgow', country: 'United Kingdom' },
  { name: 'Bristol Airport', iataCode: 'BRS', city: 'Bristol', country: 'United Kingdom' },
  
  // France
  { name: 'Charles de Gaulle Airport', iataCode: 'CDG', city: 'Paris', country: 'France' },
  { name: 'Paris Orly Airport', iataCode: 'ORY', city: 'Paris', country: 'France' },
  { name: 'Nice Côte d\'Azur Airport', iataCode: 'NCE', city: 'Nice', country: 'France' },
  { name: 'Lyon-Saint Exupéry Airport', iataCode: 'LYS', city: 'Lyon', country: 'France' },
  { name: 'Marseille Provence Airport', iataCode: 'MRS', city: 'Marseille', country: 'France' },
  { name: 'Toulouse-Blagnac Airport', iataCode: 'TLS', city: 'Toulouse', country: 'France' },
  
  // Germany
  { name: 'Frankfurt Airport', iataCode: 'FRA', city: 'Frankfurt', country: 'Germany' },
  { name: 'Munich Airport', iataCode: 'MUC', city: 'Munich', country: 'Germany' },
  { name: 'Berlin Brandenburg Airport', iataCode: 'BER', city: 'Berlin', country: 'Germany' },
  { name: 'Düsseldorf Airport', iataCode: 'DUS', city: 'Düsseldorf', country: 'Germany' },
  { name: 'Hamburg Airport', iataCode: 'HAM', city: 'Hamburg', country: 'Germany' },
  { name: 'Cologne Bonn Airport', iataCode: 'CGN', city: 'Cologne', country: 'Germany' },
  
  // Spain
  { name: 'Madrid-Barajas Airport', iataCode: 'MAD', city: 'Madrid', country: 'Spain' },
  { name: 'Barcelona-El Prat Airport', iataCode: 'BCN', city: 'Barcelona', country: 'Spain' },
  { name: 'Málaga-Costa del Sol Airport', iataCode: 'AGP', city: 'Málaga', country: 'Spain' },
  { name: 'Palma de Mallorca Airport', iataCode: 'PMI', city: 'Palma de Mallorca', country: 'Spain' },
  { name: 'Alicante-Elche Airport', iataCode: 'ALC', city: 'Alicante', country: 'Spain' },
  { name: 'Seville Airport', iataCode: 'SVQ', city: 'Seville', country: 'Spain' },
  { name: 'Valencia Airport', iataCode: 'VLC', city: 'Valencia', country: 'Spain' },
  { name: 'Bilbao Airport', iataCode: 'BIO', city: 'Bilbao', country: 'Spain' },
  
  // Italy
  { name: 'Leonardo da Vinci-Fiumicino Airport', iataCode: 'FCO', city: 'Rome', country: 'Italy' },
  { name: 'Milan Malpensa Airport', iataCode: 'MXP', city: 'Milan', country: 'Italy' },
  { name: 'Venice Marco Polo Airport', iataCode: 'VCE', city: 'Venice', country: 'Italy' },
  { name: 'Naples International Airport', iataCode: 'NAP', city: 'Naples', country: 'Italy' },
  { name: 'Catania-Fontanarossa Airport', iataCode: 'CTA', city: 'Catania', country: 'Italy' },
  { name: 'Milan Bergamo Airport', iataCode: 'BGY', city: 'Milan', country: 'Italy' },
  { name: 'Bologna Guglielmo Marconi Airport', iataCode: 'BLQ', city: 'Bologna', country: 'Italy' },
  
  // Netherlands
  { name: 'Amsterdam Airport Schiphol', iataCode: 'AMS', city: 'Amsterdam', country: 'Netherlands' },
  { name: 'Eindhoven Airport', iataCode: 'EIN', city: 'Eindhoven', country: 'Netherlands' },
  { name: 'Rotterdam The Hague Airport', iataCode: 'RTM', city: 'Rotterdam', country: 'Netherlands' },
  
  // Belgium
  { name: 'Brussels Airport', iataCode: 'BRU', city: 'Brussels', country: 'Belgium' },
  { name: 'Brussels South Charleroi Airport', iataCode: 'CRL', city: 'Brussels', country: 'Belgium' },
  
  // Switzerland
  { name: 'Zurich Airport', iataCode: 'ZRH', city: 'Zurich', country: 'Switzerland' },
  { name: 'Geneva Airport', iataCode: 'GVA', city: 'Geneva', country: 'Switzerland' },
  { name: 'Basel-Mulhouse-Freiburg Airport', iataCode: 'BSL', city: 'Basel', country: 'Switzerland' },
  
  // Austria
  { name: 'Vienna International Airport', iataCode: 'VIE', city: 'Vienna', country: 'Austria' },
  { name: 'Salzburg Airport', iataCode: 'SZG', city: 'Salzburg', country: 'Austria' },
  { name: 'Innsbruck Airport', iataCode: 'INN', city: 'Innsbruck', country: 'Austria' },
  
  // Portugal
  { name: 'Lisbon Portela Airport', iataCode: 'LIS', city: 'Lisbon', country: 'Portugal' },
  { name: 'Francisco Sá Carneiro Airport', iataCode: 'OPO', city: 'Porto', country: 'Portugal' },
  { name: 'Faro Airport', iataCode: 'FAO', city: 'Faro', country: 'Portugal' },
  
  // Greece
  { name: 'Athens International Airport', iataCode: 'ATH', city: 'Athens', country: 'Greece' },
  { name: 'Thessaloniki Airport', iataCode: 'SKG', city: 'Thessaloniki', country: 'Greece' },
  { name: 'Heraklion International Airport', iataCode: 'HER', city: 'Heraklion', country: 'Greece' },
  
  // Ireland
  { name: 'Dublin Airport', iataCode: 'DUB', city: 'Dublin', country: 'Ireland' },
  { name: 'Cork Airport', iataCode: 'ORK', city: 'Cork', country: 'Ireland' },
  { name: 'Shannon Airport', iataCode: 'SNN', city: 'Shannon', country: 'Ireland' },
  
  // Poland
  { name: 'Warsaw Chopin Airport', iataCode: 'WAW', city: 'Warsaw', country: 'Poland' },
  { name: 'Kraków John Paul II Airport', iataCode: 'KRK', city: 'Kraków', country: 'Poland' },
  { name: 'Gdańsk Lech Wałęsa Airport', iataCode: 'GDN', city: 'Gdańsk', country: 'Poland' },
  
  // Czech Republic
  { name: 'Václav Havel Airport Prague', iataCode: 'PRG', city: 'Prague', country: 'Czech Republic' },
  
  // Hungary
  { name: 'Budapest Ferenc Liszt Airport', iataCode: 'BUD', city: 'Budapest', country: 'Hungary' },
  
  // Denmark
  { name: 'Copenhagen Airport', iataCode: 'CPH', city: 'Copenhagen', country: 'Denmark' },
  { name: 'Billund Airport', iataCode: 'BLL', city: 'Billund', country: 'Denmark' },
  
  // Sweden
  { name: 'Stockholm Arlanda Airport', iataCode: 'ARN', city: 'Stockholm', country: 'Sweden' },
  { name: 'Gothenburg Landvetter Airport', iataCode: 'GOT', city: 'Gothenburg', country: 'Sweden' },
  { name: 'Stockholm Bromma Airport', iataCode: 'BMA', city: 'Stockholm', country: 'Sweden' },
  
  // Norway
  { name: 'Oslo Gardermoen Airport', iataCode: 'OSL', city: 'Oslo', country: 'Norway' },
  { name: 'Bergen Airport', iataCode: 'BGO', city: 'Bergen', country: 'Norway' },
  { name: 'Stavanger Airport', iataCode: 'SVG', city: 'Stavanger', country: 'Norway' },
  
  // Finland
  { name: 'Helsinki-Vantaa Airport', iataCode: 'HEL', city: 'Helsinki', country: 'Finland' },
  
  // Turkey
  { name: 'Istanbul Airport', iataCode: 'IST', city: 'Istanbul', country: 'Turkey' },
  { name: 'Sabiha Gökçen Airport', iataCode: 'SAW', city: 'Istanbul', country: 'Turkey' },
  { name: 'Antalya Airport', iataCode: 'AYT', city: 'Antalya', country: 'Turkey' },
  
  // Croatia
  { name: 'Zagreb Airport', iataCode: 'ZAG', city: 'Zagreb', country: 'Croatia' },
  { name: 'Dubrovnik Airport', iataCode: 'DBV', city: 'Dubrovnik', country: 'Croatia' },
  { name: 'Split Airport', iataCode: 'SPU', city: 'Split', country: 'Croatia' },
  
  // Romania
  { name: 'Henri Coandă Airport', iataCode: 'OTP', city: 'Bucharest', country: 'Romania' },
  
  // Bulgaria
  { name: 'Sofia Airport', iataCode: 'SOF', city: 'Sofia', country: 'Bulgaria' },
  
  // Iceland
  { name: 'Keflavík Airport', iataCode: 'KEF', city: 'Reykjavík', country: 'Iceland' },
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    // If no query, return all airports
    if (!query || query.length < 1) {
      return new Response(JSON.stringify({ data: EUROPEAN_AIRPORTS }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter airports by query (search in name, city, country, and IATA code)
    const searchTerm = query.toLowerCase();
    const filtered = EUROPEAN_AIRPORTS.filter(airport => 
      airport.name.toLowerCase().includes(searchTerm) ||
      airport.city.toLowerCase().includes(searchTerm) ||
      airport.country.toLowerCase().includes(searchTerm) ||
      airport.iataCode.toLowerCase().includes(searchTerm)
    );

    console.log(`Found ${filtered.length} airports matching "${query}"`);

    return new Response(JSON.stringify({ data: filtered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-airports function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to get airports'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
