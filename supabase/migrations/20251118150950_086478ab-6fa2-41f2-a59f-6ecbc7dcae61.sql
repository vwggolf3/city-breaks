-- Update ams_destinations with proper city and country names from airports table
UPDATE ams_destinations 
SET 
  city = airports.city,
  country = airports.country
FROM airports
WHERE ams_destinations.destination_code = airports.iata_code;