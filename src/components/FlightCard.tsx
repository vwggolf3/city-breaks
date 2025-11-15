import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane, MapPin, Clock, Heart } from "lucide-react";

interface FlightCardProps {
  destination: string;
  country: string;
  price: number;
  departureTime: string;
  returnTime: string;
  duration: string;
  airline: string;
  stops: number;
  image: string;
}

export const FlightCard = ({
  destination,
  country,
  price,
  departureTime,
  returnTime,
  duration,
  airline,
  stops,
  image,
}: FlightCardProps) => {
  return (
    <Card className="overflow-hidden hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 bg-card border-border/50">
      <div className="relative h-48 overflow-hidden">
        <img
          src={image}
          alt={destination}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/20 backdrop-blur-sm hover:bg-background/40 text-foreground"
        >
          <Heart className="h-5 w-5" />
        </Button>
        <div className="absolute bottom-3 left-3">
          <h3 className="text-2xl font-bold text-background mb-1">{destination}</h3>
          <p className="text-sm text-background/90 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {country}
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-primary">€{price}</div>
            <div className="text-xs text-muted-foreground">per person</div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {stops === 0 ? "Direct" : `${stops} stop${stops > 1 ? "s" : ""}`}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Plane className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">{airline}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            <span>
              Fri {departureTime} → Sun {returnTime}
            </span>
          </div>
          <div className="text-muted-foreground">
            Total flight time: {duration}
          </div>
        </div>

        <Button variant="default" className="w-full" size="lg">
          View Details
        </Button>
      </div>
    </Card>
  );
};
