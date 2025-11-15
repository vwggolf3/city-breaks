-- Fix 1: Add user validation to create_encrypted_booking function
CREATE OR REPLACE FUNCTION public.create_encrypted_booking(
  p_user_id uuid,
  p_order_id text,
  p_booking_reference text,
  p_flight_offer_id text,
  p_flight_data jsonb,
  p_traveler_name text,
  p_contact_email text,
  p_contact_phone text,
  p_total_price numeric,
  p_currency text,
  p_status text,
  p_booked_at timestamp with time zone
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking_id uuid;
  v_encrypted_name bytea;
  v_minimal_data jsonb;
BEGIN
  -- CRITICAL SECURITY CHECK: Verify authenticated user matches the user_id parameter
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user_id mismatch';
  END IF;

  -- Create minimal, non-sensitive traveler data
  v_minimal_data := jsonb_build_object(
    'contact', jsonb_build_object(
      'email', p_contact_email,
      'phone', p_contact_phone
    )
  );
  
  -- Encrypt only the traveler name
  v_encrypted_name := pgsodium.crypto_aead_det_encrypt(
    convert_to(p_traveler_name, 'utf8'),
    convert_to('traveler_encryption_key_v1', 'utf8'),
    NULL
  );
  
  -- Insert the booking with encrypted name and minimal contact data
  INSERT INTO public.flight_bookings (
    user_id,
    order_id,
    booking_reference,
    flight_offer_id,
    flight_data,
    encrypted_traveler_name,
    traveler_data,
    total_price,
    currency,
    status,
    booked_at
  )
  VALUES (
    p_user_id,
    p_order_id,
    p_booking_reference,
    p_flight_offer_id,
    p_flight_data,
    v_encrypted_name,
    v_minimal_data,
    p_total_price,
    p_currency,
    p_status,
    p_booked_at
  )
  RETURNING id INTO v_booking_id;
  
  RETURN v_booking_id;
END;
$function$;

-- Fix 2: Drop and recreate user_bookings view with security_invoker
DROP VIEW IF EXISTS public.user_bookings;

CREATE VIEW public.user_bookings
WITH (security_invoker = on)
AS
SELECT 
  fb.id,
  fb.user_id,
  fb.order_id,
  fb.booking_reference,
  fb.flight_offer_id,
  fb.flight_data,
  fb.traveler_data,
  -- Decrypt traveler_name only for rows the user can access via RLS
  CASE 
    WHEN fb.encrypted_traveler_name IS NOT NULL THEN
      convert_from(
        pgsodium.crypto_aead_det_decrypt(
          fb.encrypted_traveler_name,
          convert_to('traveler_encryption_key_v1', 'utf8'),
          NULL
        ),
        'utf8'
      )
    ELSE NULL
  END AS traveler_name,
  fb.total_price,
  fb.currency,
  fb.status,
  fb.booked_at,
  fb.created_at,
  fb.updated_at
FROM public.flight_bookings fb;