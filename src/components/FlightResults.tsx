import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plane, Clock, MapPin, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { BookingDialog } from "@/components/BookingDialog";
import { useToast } from "@/hooks/use-toast";

interface Segment {
  departure: {
    iataCode: string;
    at: string;
  };
  arrival: {
    iataCode: string;
    at: string;
  };
  carrierCode: string;
  duration: string;
}

interface Itinerary {
  segments: Segment[];
  duration: string;
}

interface FlightOffer {
  id: string;
  price: {
    total: string;
    currency: string;
  };
  itineraries: Itinerary[];
  numberOfBookableSeats?: number;
  validatingAirlineCodes?: string[];
}

interface FlightResultsProps {
  flights: FlightOffer[];
  origin: string;
  destination: string;
}

export const FlightResults = ({ flights, origin, destination }: FlightResultsProps) => {
  const { toast } = useToast();
  const [selectedFlight, setSelectedFlight] = useState<FlightOffer | null>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);

  const handleSelectFlight = (flight: FlightOffer) => {
    setSelectedFlight(flight);
    setBookingDialogOpen(true);
  };

  const handleBookingComplete = (bookingData: any) => {
    toast({
      title: "Booking Confirmed!",
      description: "Check your email for confirmation details.",
    });
  };

  if (flights.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-8">
        <Card className="p-12 text-center bg-card/80 backdrop-blur-sm border-border/50">
          <Plane className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2 text-foreground">No flights found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search criteria or budget to see more options.
          </p>
        </Card>
      </div>
    );
  }

  const formatDuration = (duration: string) => {
    // PT2H30M format to "2h 30m"
    const match = duration.match(/PT(\d+H)?(\d+M)?/);
    if (!match) return duration;
    
    const hours = match[1] ? match[1].replace('H', 'h ') : '';
    const minutes = match[2] ? match[2].replace('M', 'm') : '';
    return `${hours}${minutes}`.trim();
  };

  const formatTime = (isoString: string) => {
    return format(parseISO(isoString), 'HH:mm');
  };

  const formatDate = (isoString: string) => {
    return format(parseISO(isoString), 'MMM d');
  };

  const getStopsCount = (segments: Segment[]) => {
    return segments.length - 1;
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">
          Available Flights
          <span className="text-muted-foreground text-lg ml-2">({flights.length} options)</span>
        </h2>
        <Badge variant="secondary" className="text-sm">
          <TrendingUp className="h-3 w-3 mr-1" />
          Best Deals
        </Badge>
      </div>

      <div className="space-y-4">
        {flights.map((flight) => {
          const outbound = flight.itineraries[0];
          const returnFlight = flight.itineraries[1];
          const outboundStops = getStopsCount(outbound.segments);
          const returnStops = returnFlight ? getStopsCount(returnFlight.segments) : 0;

          return (
            <Card 
              key={flight.id} 
              className="p-6 hover:shadow-elevated transition-all duration-300 bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/50"
            >
              <div className="space-y-4">
                {/* Price and Airline */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-3xl font-bold text-primary">
                      {flight.price.currency} {parseFloat(flight.price.total).toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">per person</div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-2">
                      {flight.validatingAirlineCodes?.[0] || outbound.segments[0].carrierCode}
                    </Badge>
                    {flight.numberOfBookableSeats && flight.numberOfBookableSeats < 5 && (
                      <div className="text-xs text-destructive">
                        Only {flight.numberOfBookableSeats} seats left
                      </div>
                    )}
                  </div>
                </div>

                {/* Outbound Flight */}
                <div className="border-l-2 border-primary pl-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Plane className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Outbound</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(outbound.segments[0].departure.at)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-foreground">
                          {formatTime(outbound.segments[0].departure.at)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {outbound.segments[0].departure.iataCode}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-center">
                        <div className="text-xs text-muted-foreground mb-1">
                          {formatDuration(outbound.duration)}
                        </div>
                        <div className="w-24 h-px bg-border relative">
                          <Plane className="h-3 w-3 absolute -top-1.5 left-1/2 -translate-x-1/2 text-primary" />
                        </div>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {outboundStops === 0 ? "Direct" : `${outboundStops} stop${outboundStops > 1 ? 's' : ''}`}
                        </Badge>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-2xl font-bold text-foreground">
                          {formatTime(outbound.segments[outbound.segments.length - 1].arrival.at)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {outbound.segments[outbound.segments.length - 1].arrival.iataCode}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Return Flight */}
                {returnFlight && (
                  <div className="border-l-2 border-primary pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Plane className="h-4 w-4 text-primary rotate-180" />
                      <span className="text-sm font-semibold text-foreground">Return</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(returnFlight.segments[0].departure.at)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-foreground">
                            {formatTime(returnFlight.segments[0].departure.at)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {returnFlight.segments[0].departure.iataCode}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-center">
                          <div className="text-xs text-muted-foreground mb-1">
                            {formatDuration(returnFlight.duration)}
                          </div>
                          <div className="w-24 h-px bg-border relative">
                            <Plane className="h-3 w-3 absolute -top-1.5 left-1/2 -translate-x-1/2 text-primary rotate-180" />
                          </div>
                          <Badge variant="secondary" className="text-xs mt-1">
                            {returnStops === 0 ? "Direct" : `${returnStops} stop${returnStops > 1 ? 's' : ''}`}
                          </Badge>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-2xl font-bold text-foreground">
                            {formatTime(returnFlight.segments[returnFlight.segments.length - 1].arrival.at)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {returnFlight.segments[returnFlight.segments.length - 1].arrival.iataCode}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => handleSelectFlight(flight)}
                >
                  Select Flight
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {selectedFlight && (
        <BookingDialog
          open={bookingDialogOpen}
          onOpenChange={setBookingDialogOpen}
          flightOffer={selectedFlight}
          onBookingComplete={handleBookingComplete}
        />
      )}
    </div>
  );
};
