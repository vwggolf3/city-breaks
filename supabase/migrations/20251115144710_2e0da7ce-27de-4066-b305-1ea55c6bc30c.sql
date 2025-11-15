-- Enable pgsodium extension for encryption
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Add encrypted column for minimal traveler data
ALTER TABLE public.flight_bookings 
ADD COLUMN IF NOT EXISTS encrypted_traveler_name bytea;

-- Create a secure function to insert bookings with encrypted data
-- This function will encrypt minimal traveler info (name only) and NOT store passport data
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
  v_minimal_data jsonb;
BEGIN
  -- Create minimal, non-sensitive traveler data (email and phone for contact purposes only)
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
$$;

-- Grant execute permission to service role only
GRANT EXECUTE ON FUNCTION public.create_encrypted_booking TO service_role;

-- Create a view for users to see their bookings with decrypted names
CREATE OR REPLACE VIEW public.user_bookings AS
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

-- Comment explaining the security model
COMMENT ON COLUMN public.flight_bookings.encrypted_traveler_name IS 'Encrypted traveler name using pgsodium. Passport and DOB data is NOT stored for security.';
COMMENT ON COLUMN public.flight_bookings.traveler_data IS 'Contains only minimal contact information (email, phone) for communication purposes. NO sensitive data like passports or DOB.';
COMMENT ON FUNCTION public.create_encrypted_booking IS 'Securely creates a booking with encrypted traveler name. Does NOT accept or store sensitive data like passports or date of birth.';