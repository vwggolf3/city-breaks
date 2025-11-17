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
        return {
          type: "flight-offer",
          id: price.id,
          source: "cached",
          price: {
            currency: price.currency || "EUR",
            total: price.price?.toString() || "0",
            base: price.price?.toString() || "0",
          },
          itineraries: price.flight_data,
          validatingAirlineCodes: price.airlines || [],
          destinationCity: dest?.city,
          destinationCountry: dest?.country,
          lastUpdated: price.last_updated_at,
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
