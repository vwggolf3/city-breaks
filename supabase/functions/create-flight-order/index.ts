import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
}

// Validation schema for flight order creation
const FlightOrderSchema = z.object({
  flightOffer: z.object({
    id: z.string(),
    price: z.object({
      total: z.string(),
      currency: z.string().length(3),
    }),
  }).passthrough(), // Allow additional Amadeus API fields
  travelers: z.array(z.object({
    id: z.string(),
    name: z.object({
      firstName: z.string().max(100),
      lastName: z.string().max(100),
    }),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    contact: z.object({
      emailAddress: z.string().email().max(255),
      phones: z.array(z.object({
        deviceType: z.enum(['MOBILE', 'LANDLINE', 'FAX']),
        countryCallingCode: z.string().max(5),
        number: z.string().max(20),
      })),
    }),
  }).passthrough()).min(1).max(9),
  contacts: z.array(z.object({
    addresseeName: z.object({
      firstName: z.string().max(100),
      lastName: z.string().max(100),
    }),
    address: z.object({
      lines: z.array(z.string().max(200)),
      postalCode: z.string().max(20),
      cityName: z.string().max(100),
      countryCode: z.string().length(2),
    }),
    purpose: z.string(),
  }).passthrough()).min(1),
});

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

    const rawInput = await req.json();
    
    // Validate input with Zod
    const validationResult = FlightOrderSchema.safeParse(rawInput);
    
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

    const { flightOffer, travelers, contacts } = validationResult.data;
    console.log('Creating flight order for user:', user.id);

    // Normalize inputs for Amadeus API
    // CRITICAL: Travelers array should NOT contain contact info (email/phones)
    // Contact info goes in the separate contacts array only!
    const normalizedTravelers = (travelers as any[]).map((t: any) => {
      // Sanitize documents: keep only non-expired ones; remove if invalid
      let docs = Array.isArray((t as any).documents)
        ? (t as any).documents.filter((d: any) => {
            if (!d?.expiryDate) return false;
            const ts = Date.parse(d.expiryDate);
            return !Number.isNaN(ts) && ts > Date.now();
          })
        : undefined;

      // Build traveler object with ONLY: id, dateOfBirth, name, gender, documents
      // Remove any contact info (email, phones) from travelers array
      const { contact, ...travelerWithoutContact } = t;

      const base: any = {
        id: travelerWithoutContact.id,
        dateOfBirth: travelerWithoutContact.dateOfBirth,
        name: travelerWithoutContact.name,
        gender: travelerWithoutContact.gender,
      };

      if (docs && docs.length > 0) {
        return { ...base, documents: docs };
      } else {
        return base;
      }
    });

    const normalizedContacts = (contacts as any[]).map((c: any) => {
      const copy: any = { ...c };
      if (typeof copy.companyName === 'string') {
        const sanitized = copy.companyName.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 20);
        if (sanitized && sanitized.length >= 2) copy.companyName = sanitized; else delete copy.companyName;
      }
      return copy;
    });

    const apiKey = Deno.env.get('AMADEUS_TEST_API_KEY');
    const apiSecret = Deno.env.get('AMADEUS_TEST_API_SECRET');
    let apiUrl = Deno.env.get('AMADEUS_TEST_API_URL');

    if (!apiKey || !apiSecret || !apiUrl) {
      throw new Error('Missing Amadeus API credentials');
    }

    // Ensure API URL has protocol
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `https://${apiUrl}`;
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
          travelers: normalizedTravelers,
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
          contacts: normalizedContacts
        }
      }),
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error('Order creation failed:', errorText);
      return new Response(errorText, {
        status: orderResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
