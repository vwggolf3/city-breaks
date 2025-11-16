-- Drop the existing view first
DROP VIEW IF EXISTS public.user_bookings;

-- Add encrypted columns for contact information
ALTER TABLE public.flight_bookings 
ADD COLUMN IF NOT EXISTS encrypted_email bytea,
ADD COLUMN IF NOT EXISTS encrypted_phone bytea;

-- Update the create_encrypted_booking function to encrypt contact data
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
  p_booked_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
  v_encrypted_name bytea;
  v_encrypted_email bytea;
  v_encrypted_phone bytea;
BEGIN
  -- CRITICAL SECURITY CHECK: Verify authenticated user matches the user_id parameter
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user_id mismatch';
  END IF;

  -- Encrypt traveler name
  v_encrypted_name := pgsodium.crypto_aead_det_encrypt(
    convert_to(p_traveler_name, 'utf8'),
    convert_to('traveler_encryption_key_v1', 'utf8'),
    NULL
  );
  
  -- Encrypt contact email
  v_encrypted_email := pgsodium.crypto_aead_det_encrypt(
    convert_to(p_contact_email, 'utf8'),
    convert_to('contact_encryption_key_v1', 'utf8'),
    NULL
  );
  
  -- Encrypt contact phone
  v_encrypted_phone := pgsodium.crypto_aead_det_encrypt(
    convert_to(p_contact_phone, 'utf8'),
    convert_to('contact_encryption_key_v1', 'utf8'),
    NULL
  );
  
  -- Insert the booking with all encrypted data
  INSERT INTO public.flight_bookings (
    user_id,
    order_id,
    booking_reference,
    flight_offer_id,
    flight_data,
    encrypted_traveler_name,
    encrypted_email,
    encrypted_phone,
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
    v_encrypted_email,
    v_encrypted_phone,
    '{}'::jsonb,  -- Empty JSONB, no longer storing plaintext contact info
    p_total_price,
    p_currency,
    p_status,
    p_booked_at
  )
  RETURNING id INTO v_booking_id;
  
  RETURN v_booking_id;
END;
$$;

-- Recreate the user_bookings view with decrypted contact information
CREATE VIEW public.user_bookings AS
SELECT 
  fb.id,
  fb.user_id,
  fb.order_id,
  fb.booking_reference,
  fb.flight_offer_id,
  fb.flight_data,
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
  END as traveler_name,
  CASE 
    WHEN fb.encrypted_email IS NOT NULL THEN
      convert_from(
        pgsodium.crypto_aead_det_decrypt(
          fb.encrypted_email,
          convert_to('contact_encryption_key_v1', 'utf8'),
          NULL
        ),
        'utf8'
      )
    ELSE NULL
  END as contact_email,
  CASE 
    WHEN fb.encrypted_phone IS NOT NULL THEN
      convert_from(
        pgsodium.crypto_aead_det_decrypt(
          fb.encrypted_phone,
          convert_to('contact_encryption_key_v1', 'utf8'),
          NULL
        ),
        'utf8'
      )
    ELSE NULL
  END as contact_phone,
  fb.traveler_data,
  fb.total_price,
  fb.currency,
  fb.status,
  fb.booked_at,
  fb.created_at,
  fb.updated_at
FROM public.flight_bookings fb
WHERE fb.user_id = auth.uid();

-- Grant access to the view
GRANT SELECT ON public.user_bookings TO authenticated;

-- Add helpful comments
COMMENT ON COLUMN public.flight_bookings.encrypted_email IS 'Encrypted contact email using pgsodium for data protection at rest.';
COMMENT ON COLUMN public.flight_bookings.encrypted_phone IS 'Encrypted contact phone using pgsodium for data protection at rest.';
COMMENT ON COLUMN public.flight_bookings.traveler_data IS 'Legacy field - now empty. Contact data moved to encrypted columns for better security.';