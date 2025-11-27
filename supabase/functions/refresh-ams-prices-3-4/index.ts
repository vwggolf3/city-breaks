import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
}

interface FlightOffer {
  price: {
    total: string;
    currency: string;
  };
  itineraries: Array<{
    segments: Array<{
      carrierCode: string;
    }>;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting Amsterdam prices batch refresh (weekends 3-4)...');

    // Get batch parameters from request (for incremental processing)
    const { batchSize = 10 } = await req.json().catch(() => ({}));

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find destinations that need updating (no prices or old prices)
    console.log(`📍 Finding destinations that need price updates...`);
    
    // Get all destination codes
    const { data: allDests, error: destError } = await supabase
      .from('ams_destinations')
      .select('destination_code, city, country, airlines')
      .order('destination_code');

    if (destError) throw destError;
    if (!allDests || allDests.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No destinations found', completed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter to only destinations with at least 2 airlines
    const destsWithMultipleAirlines = allDests.filter(d => d.airlines && d.airlines.length >= 2);
    console.log(`✈️ Filtered to ${destsWithMultipleAirlines.length} destinations with 2+ airlines (from ${allDests.length} total)`);

    if (destsWithMultipleAirlines.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No destinations with multiple airlines found', completed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get destinations that already have recent prices (within last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentPrices } = await supabase
      .from('ams_flight_prices')
      .select('destination_code')
      .gte('last_updated_at', oneDayAgo);

    const processedCodes = new Set(recentPrices?.map(p => p.destination_code) || []);
    
    // Filter to destinations that need updates
    const destinationsToProcess = destsWithMultipleAirlines.filter(d => !processedCodes.has(d.destination_code));
    
    if (destinationsToProcess.length === 0) {
      console.log('✅ All destinations have been updated in the last 24 hours');
      return new Response(
        JSON.stringify({ message: 'All destinations up to date', completed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Take only the batch size
    const destinations = destinationsToProcess.slice(0, batchSize);
    console.log(`📍 Processing ${destinations.length} destinations (${destinationsToProcess.length} remaining)`);

    // Calculate weekends 3-4 with all combinations
    const weekendCombinations = [];
    const today = new Date();
    
    for (let i = 3; i <= 4; i++) {
      const baseDate = new Date(today);
      baseDate.setDate(today.getDate() + (i * 7) + (4 - today.getDay() + 7) % 7); // Next Thursday
      
      const thursday = new Date(baseDate);
      const friday = new Date(baseDate);
      friday.setDate(baseDate.getDate() + 1);
      const sunday = new Date(baseDate);
      sunday.setDate(baseDate.getDate() + 3);
      const monday = new Date(baseDate);
      monday.setDate(baseDate.getDate() + 4);

      // Thu-Sun
      weekendCombinations.push({
        departure: thursday.toISOString().split('T')[0],
        return: sunday.toISOString().split('T')[0],
        type: 'thu-sun'
      });

      // Fri-Sun
      weekendCombinations.push({
        departure: friday.toISOString().split('T')[0],
        return: sunday.toISOString().split('T')[0],
        type: 'fri-sun'
      });

      // Fri-Mon
      weekendCombinations.push({
        departure: friday.toISOString().split('T')[0],
        return: monday.toISOString().split('T')[0],
        type: 'fri-mon'
      });
    }

    console.log(`📅 Generated ${weekendCombinations.length} weekend combinations (weekends 3-4 × 3 types)`);

    // Get Amadeus token
    const amadeus_apiKey = Deno.env.get('AMADEUS_TEST_API_KEY');
    const amadeus_apiSecret = Deno.env.get('AMADEUS_TEST_API_SECRET');
    const amadeus_apiUrl = Deno.env.get('AMADEUS_TEST_API_URL') || 'test.api.amadeus.com';

    if (!amadeus_apiKey || !amadeus_apiSecret) {
      throw new Error('Amadeus API credentials not configured');
    }

    console.log('🔑 Getting Amadeus OAuth token...');
    const tokenResponse = await fetch(`https://${amadeus_apiUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${amadeus_apiKey}&client_secret=${amadeus_apiSecret}`,
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get Amadeus token: ${tokenResponse.status}`);
    }

    const tokenData: AmadeusTokenResponse = await tokenResponse.json();

    // Process each destination × weekend combination
    let successCount = 0;
    let errorCount = 0;

    for (const dest of destinations) {
      console.log(`\n🎯 Processing ${dest.city} (${dest.destination_code})...`);

      for (const weekend of weekendCombinations) {
        try {
          // Search for flights
          const searchUrl = `https://${amadeus_apiUrl}/v2/shopping/flight-offers`;
          const params = new URLSearchParams({
            originLocationCode: 'AMS',
            destinationLocationCode: dest.destination_code,
            departureDate: weekend.departure,
            returnDate: weekend.return,
            adults: '1',
            max: '1', // Only get cheapest option
            currencyCode: 'EUR'
          });

          const flightResponse = await fetch(`${searchUrl}?${params}`, {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (flightResponse.ok) {
            const flightData = await flightResponse.json();
            const offers: FlightOffer[] = flightData.data || [];

            if (offers.length > 0) {
              const cheapest = offers[0];
              const airlines = new Set<string>();
              
              cheapest.itineraries.forEach(itinerary => {
                itinerary.segments.forEach(segment => {
                  airlines.add(segment.carrierCode);
                });
              });

              // Store immediately to avoid data loss on timeout
              const priceRecord = {
                destination_code: dest.destination_code,
                departure_date: weekend.departure,
                return_date: weekend.return,
                weekend_type: weekend.type,
                price: parseFloat(cheapest.price.total),
                currency: cheapest.price.currency,
                airlines: Array.from(airlines),
                flight_data: cheapest,
                last_updated_at: new Date().toISOString(),
              };

              const { error: upsertError } = await supabase
                .from('ams_flight_prices')
                .upsert(priceRecord, {
                  onConflict: 'destination_code,departure_date,return_date',
                  ignoreDuplicates: false,
                });

              if (upsertError) {
                console.error(`   ❌ Error storing ${weekend.type}:`, upsertError);
                errorCount++;
              } else {
                successCount++;
                console.log(`   ✓ ${weekend.type}: €${cheapest.price.total} [saved]`);
              }
            } else {
              console.log(`   ○ ${weekend.type}: No flights found`);
            }
          } else if (flightResponse.status === 429) {
            console.warn(`   ⚠️  Rate limited on ${weekend.type}, stopping batch`);
            // Stop processing to avoid further rate limiting
            break;
          } else {
            errorCount++;
            console.log(`   ✗ ${weekend.type}: Error ${flightResponse.status}`);
          }

          // Delay between API calls (3000ms = 20 requests/minute to avoid rate limits)
          await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error) {
          errorCount++;
          console.error(`   ❌ ${weekend.type}:`, error);
        }
      }

      // Delay between destinations to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const totalProcessed = destinations.length;
    const remainingDestinations = destinationsToProcess.length - batchSize;
    
    console.log(`\n📊 Batch complete: ${successCount} prices saved, ${errorCount} errors`);
    console.log(`📍 Remaining destinations: ${Math.max(0, remainingDestinations)}`);

    return new Response(
      JSON.stringify({
        success: true,
        batch: {
          processed: totalProcessed,
          remaining: Math.max(0, remainingDestinations),
        },
        results: {
          pricesSaved: successCount,
          errors: errorCount,
        },
        message: `Processed ${totalProcessed} destinations with ${weekendCombinations.length} weekend combinations (weekends 3-4). ${Math.max(0, remainingDestinations)} destinations remaining.`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in refresh-ams-prices-3-4 function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to refresh Amsterdam flight prices for weekends 3-4'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
