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

    // Use a second client with the user's JWT to preserve auth.uid() in RPC calls
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
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

    // Build the request payload
    const orderPayload = {
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
    };

    // Log the full payload for debugging
    console.log('Flight order payload:', JSON.stringify(orderPayload, null, 2));

    // Create flight order with retry logic
    let orderResponse: Response | null = null;
    let lastError: string | null = null;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
        console.log(`Retry attempt ${attempt} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      try {
        orderResponse = await fetch(`${apiUrl}/v1/booking/flight-orders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderPayload),
        });

        // If successful, break out of retry loop
        if (orderResponse.ok) {
          console.log(`Order created successfully on attempt ${attempt + 1}`);
          break;
        }

        // Store error for potential retry
        lastError = await orderResponse.text();
        console.log(`Attempt ${attempt + 1} failed with status ${orderResponse.status}`);

        // Check if this is a retryable error (5xx or network issues)
        const isRetryable = orderResponse.status >= 500 && orderResponse.status < 600;
        
        // If not retryable or last attempt, exit loop
        if (!isRetryable || attempt === maxRetries - 1) {
          break;
        }
      } catch (networkError: any) {
        console.error(`Network error on attempt ${attempt + 1}:`, networkError.message);
        lastError = networkError.message;
        
        // On last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw new Error(`Network error after ${maxRetries} attempts: ${networkError.message}`);
        }
      }
    }

    if (!orderResponse || !orderResponse.ok) {
      // Get error details, with fallback for null response
      let errorText = lastError || 'Unknown error';
      if (orderResponse) {
        try {
          errorText = await orderResponse.text();
        } catch (e) {
          console.error('Failed to read error response:', e);
        }
      }
      console.error('Order creation failed after retries:', errorText);

      // Attempt graceful fallback in Amadeus Sandbox when inventory is unavailable (e.g., 38189)
      try {
        const parsed = (() => { try { return JSON.parse(errorText); } catch { return null; } })();
        const amadeusError = parsed?.errors?.[0];
        const isSandboxInternalError = amadeusError?.code === 38189 || amadeusError?.status === 500 || /Internal error/i.test(errorText);

        if (isSandboxInternalError) {
          console.log('Sandbox internal error detected. Creating simulated booking fallback...');

          const simulatedOrderId = `DEMO-${(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`)}`;
          const simulatedReference = `ZZ${Math.floor(100000 + Math.random() * 900000)}`;

          // Save a simulated booking using secure RPC (encrypts contact data at rest)
          const travelerName = `${(travelers?.[0]?.name?.firstName ?? '').toString()} ${(travelers?.[0]?.name?.lastName ?? '').toString()}`.trim() || 'Traveler';
          const contactEmail = (travelers?.[0]?.contact?.emailAddress ?? '').toString();
          const firstPhone = travelers?.[0]?.contact?.phones?.[0];
          const contactPhone = firstPhone ? `${firstPhone.countryCallingCode ? `+${firstPhone.countryCallingCode}` : ''}${firstPhone.number}` : '';

          const { data: simId, error: rpcSimError } = await authed.rpc('create_encrypted_booking', {
            p_user_id: user.id,
            p_order_id: simulatedOrderId,
            p_booking_reference: simulatedReference,
            p_flight_offer_id: flightOffer.id,
            p_flight_data: flightOffer,
            p_traveler_name: travelerName,
            p_contact_email: contactEmail,
            p_contact_phone: contactPhone,
            p_total_price: parseFloat(flightOffer.price.total),
            p_currency: flightOffer.price.currency,
            p_status: 'pending_sandbox',
            p_booked_at: new Date().toISOString(),
          });

          if (rpcSimError) {
            console.error('Failed to save simulated booking via RPC:', rpcSimError);
          }

          const simulatedResponse = {
            data: {
              type: 'flight-order',
              id: simulatedOrderId,
              associatedRecords: [
                { reference: simulatedReference, originSystemCode: 'GDS' }
              ],
            },
            meta: {
              simulated: true,
              reason: 'sandbox_unavailable',
              originalError: amadeusError ?? errorText,
            }
          };

          return new Response(JSON.stringify(simulatedResponse), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (fallbackErr) {
        console.error('Fallback booking creation failed:', fallbackErr);
      }

      return new Response(errorText, {
        status: orderResponse?.status || 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orderData = await orderResponse.json();
    console.log('Successfully created flight order:', orderData.data?.id);

    // Save booking to database using secure RPC (encrypts sensitive contact data)
    const travelerName = `${(travelers?.[0]?.name?.firstName ?? '').toString()} ${(travelers?.[0]?.name?.lastName ?? '').toString()}`.trim() || 'Traveler';
    const contactEmail = (travelers?.[0]?.contact?.emailAddress ?? '').toString();
    const firstPhone = travelers?.[0]?.contact?.phones?.[0];
    const contactPhone = firstPhone ? `${firstPhone.countryCallingCode ? `+${firstPhone.countryCallingCode}` : ''}${firstPhone.number}` : '';

    const { data: bookingId, error: rpcError } = await authed.rpc('create_encrypted_booking', {
      p_user_id: user.id,
      p_order_id: orderData.data?.id ?? null,
      p_booking_reference: orderData.data?.associatedRecords?.[0]?.reference ?? null,
      p_flight_offer_id: flightOffer.id,
      p_flight_data: flightOffer,
      p_traveler_name: travelerName,
      p_contact_email: contactEmail,
      p_contact_phone: contactPhone,
      p_total_price: parseFloat(flightOffer.price.total),
      p_currency: flightOffer.price.currency,
      p_status: 'confirmed',
      p_booked_at: new Date().toISOString(),
    });

    if (rpcError) {
      console.error('Failed to save booking via RPC:', rpcError);
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
