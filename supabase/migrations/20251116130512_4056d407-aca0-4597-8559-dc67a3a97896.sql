-- Recreate the user_bookings view with SECURITY INVOKER to enforce RLS properly
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