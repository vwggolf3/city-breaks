import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
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

    const { flightOffer, travelers, contacts } = await req.json();
    console.log('Creating flight order for user:', user.id);

    const apiKey = Deno.env.get('AMADEUS_TEST_API_KEY');
    const apiSecret = Deno.env.get('AMADEUS_TEST_API_SECRET');
    const apiUrl = Deno.env.get('AMADEUS_TEST_API_URL');

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

    // Create flight order
    const orderResponse = await fetch(`${apiUrl}/v1/booking/flight-orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'flight-order',
          flightOffers: [flightOffer],
          travelers: travelers,
          remarks: {
            general: [
              {
                subType: 'GENERAL_MISCELLANEOUS',
                text: 'BOOKING FROM WEEKEND FLIGHT FINDER'
              }
            ]
          },
          ticketingAgreement: {
            option: 'DELAY_TO_CANCEL',
            delay: '6D'
          },
          contacts: contacts
        }
      }),
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error('Order creation failed:', errorText);
      throw new Error(`Order creation failed: ${orderResponse.status}`);
    }

    const orderData = await orderResponse.json();
    console.log('Successfully created flight order:', orderData.data?.id);

    // Save booking to database
    const { error: insertError } = await supabase
      .from('flight_bookings')
      .insert({
        user_id: user.id,
        order_id: orderData.data?.id,
        booking_reference: orderData.data?.associatedRecords?.[0]?.reference,
        flight_offer_id: flightOffer.id,
        flight_data: flightOffer,
        traveler_data: travelers,
        total_price: parseFloat(flightOffer.price.total),
        currency: flightOffer.price.currency,
        status: 'confirmed',
        booked_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Failed to save booking to database:', insertError);
    }

    return new Response(JSON.stringify(orderData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in create-flight-order function:', error);
    return new Response(
      JSON.stringify({ error: error.message, details: 'Failed to create flight order' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
