import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSecrets } from "../shared/secrets";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "crypto";

interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
}

const FlightOrderSchema = z.object({
  flightOffer: z.object({
    id: z.string(),
    price: z.object({
      total: z.string(),
      currency: z.string().length(3),
    }),
  }).passthrough(),
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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: "" };
  }

  try {
    const secrets = await getSecrets();

    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(secrets.SUPABASE_URL, secrets.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Use a second client with the user's JWT to preserve auth.uid() in RPC calls
    const authed = createClient(secrets.SUPABASE_URL, secrets.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const rawInput = JSON.parse(event.body || "{}");

    const validationResult = FlightOrderSchema.safeParse(rawInput);

    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.errors);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: 'Invalid input parameters',
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        }),
      };
    }

    const { flightOffer, travelers, contacts } = validationResult.data;
    console.log('Creating flight order for user:', user.id);

    // Normalize inputs for Amadeus API
    const normalizedTravelers = travelers.map((t) => {
      const tRecord = t as Record<string, unknown>;
      const docs = Array.isArray(tRecord.documents)
        ? (tRecord.documents as Array<Record<string, unknown>>).filter((d) => {
            if (!d?.expiryDate) return false;
            const ts = Date.parse(d.expiryDate as string);
            return !Number.isNaN(ts) && ts > Date.now();
          })
        : undefined;

      const { contact: _contact, ...travelerWithoutContact } = t;

      const base: Record<string, unknown> = {
        id: travelerWithoutContact.id,
        dateOfBirth: travelerWithoutContact.dateOfBirth,
        name: travelerWithoutContact.name,
        gender: (tRecord as Record<string, unknown>).gender,
      };

      if (docs && docs.length > 0) {
        return { ...base, documents: docs };
      } else {
        return base;
      }
    });

    const normalizedContacts = contacts.map((c) => {
      const copy: Record<string, unknown> = { ...c };
      if (typeof copy.companyName === 'string') {
        const sanitized = copy.companyName.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 20);
        if (sanitized && sanitized.length >= 2) copy.companyName = sanitized; else delete copy.companyName;
      }
      return copy;
    });

    const apiKey = secrets.AMADEUS_TEST_API_KEY;
    const apiSecret = secrets.AMADEUS_TEST_API_SECRET;
    let apiUrl = secrets.AMADEUS_TEST_API_URL;

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

    console.log('Flight order payload:', JSON.stringify(orderPayload, null, 2));

    // Create flight order with retry logic
    let orderResponse: Response | null = null;
    let lastError: string | null = null;
    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
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

        if (orderResponse.ok) {
          console.log(`Order created successfully on attempt ${attempt + 1}`);
          break;
        }

        lastError = await orderResponse.text();
        console.log(`Attempt ${attempt + 1} failed with status ${orderResponse.status}`);

        const isRetryable = orderResponse.status >= 500 && orderResponse.status < 600;

        if (!isRetryable || attempt === maxRetries - 1) {
          break;
        }
      } catch (networkError: unknown) {
        const errMsg = networkError instanceof Error ? networkError.message : 'Unknown network error';
        console.error(`Network error on attempt ${attempt + 1}:`, errMsg);
        lastError = errMsg;

        if (attempt === maxRetries - 1) {
          throw new Error(`Network error after ${maxRetries} attempts: ${errMsg}`);
        }
      }
    }

    if (!orderResponse || !orderResponse.ok) {
      let errorText = lastError || 'Unknown error';
      if (orderResponse) {
        try {
          errorText = await orderResponse.text();
        } catch (e) {
          console.error('Failed to read error response:', e);
        }
      }
      console.error('Order creation failed after retries:', errorText);

      // Attempt graceful fallback in Amadeus Sandbox when inventory is unavailable
      try {
        const parsed = (() => { try { return JSON.parse(errorText); } catch { return null; } })();
        const amadeusError = parsed?.errors?.[0];
        const isSandboxInternalError = amadeusError?.code === 38189 || amadeusError?.status === 500 || /Internal error/i.test(errorText);

        if (isSandboxInternalError) {
          console.log('Sandbox internal error detected. Creating simulated booking fallback...');

          const simulatedOrderId = `DEMO-${randomUUID()}`;
          const simulatedReference = `ZZ${Math.floor(100000 + Math.random() * 900000)}`;

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

          return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(simulatedResponse),
          };
        }
      } catch (fallbackErr) {
        console.error('Fallback booking creation failed:', fallbackErr);
      }

      return {
        statusCode: orderResponse?.status || 500,
        headers: { "Content-Type": "application/json" },
        body: errorText,
      };
    }

    const orderData = await orderResponse.json();
    console.log('Successfully created flight order:', orderData.data?.id);

    // Save booking to database using secure RPC
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

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    };
  } catch (error: unknown) {
    console.error('Error in create-flight-order function:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', details: 'Failed to create flight order' }),
    };
  }
};
