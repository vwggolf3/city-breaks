import { supabase } from "@/integrations/supabase/client";

interface CachedPriceQuery {
  departureDate: string;
  returnDate: string;
  maxPrice?: number;
  destination?: string;
}

export const useCachedFlightPrices = () => {
  const queryCachedPrices = async ({
    departureDate,
    returnDate,
    maxPrice,
    destination,
  }: CachedPriceQuery) => {
    try {
      let query = supabase
        .from("ams_flight_prices")
        .select("*")
        .eq("departure_date", departureDate)
        .eq("return_date", returnDate)
        .not("price", "is", null)
        .order("price", { ascending: true });

      if (maxPrice) {
        query = query.lte("price", maxPrice);
      }

      if (destination) {
        query = query.eq("destination_code", destination);
      }

      const { data: priceData, error } = await query;

      if (error) throw error;

      // Get destination details
      const destinationCodes = [...new Set(priceData?.map((p) => p.destination_code))];
      const { data: destData } = await supabase
        .from("ams_destinations")
        .select("destination_code, city, country")
        .in("destination_code", destinationCodes);

      const destMap = new Map(destData?.map((d) => [d.destination_code, d]));

      // Transform cached data to match Amadeus flight offer format
      const transformedData = priceData?.map((price) => {
        const dest = destMap.get(price.destination_code);
        const flightData = price.flight_data as any;
        
        // Use the original Amadeus flight offer structure if available
        // This preserves all required fields like travelerPricings, id, source
        if (flightData && typeof flightData === 'object' && flightData.type === 'flight-offer') {
          return {
            ...flightData,
            // Add our custom metadata for display (won't interfere with Amadeus API)
            destinationCity: dest?.city,
            destinationCountry: dest?.country,
            lastUpdatedAt: price.last_updated_at,
            // Override with our cached price if available
            price: price.price ? {
              ...flightData.price,
              currency: price.currency || flightData.price?.currency || "EUR",
              total: price.price.toString(),
              base: flightData.price?.base || price.price.toString(),
              grandTotal: flightData.price?.grandTotal || price.price.toString(),
            } : flightData.price,
          };
        }
        
        // Fallback for legacy data structure (shouldn't happen with new data)
        return {
          type: "flight-offer",
          id: price.id,
          source: "GDS",
          price: {
            currency: price.currency || "EUR",
            total: price.price?.toString() || "0",
            base: price.price?.toString() || "0",
          },
          itineraries: flightData?.itineraries || [],
          validatingAirlineCodes: price.airlines || [],
          destinationCity: dest?.city,
          destinationCountry: dest?.country,
          lastUpdatedAt: price.last_updated_at,
        };
      });

      return { data: transformedData, error: null };
    } catch (error) {
      console.error("Error querying cached prices:", error);
      return { data: null, error };
    }
  };

  return { queryCachedPrices };
};
