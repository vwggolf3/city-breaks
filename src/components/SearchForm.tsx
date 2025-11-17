import { useState, useMemo, useEffect } from "react";
import { Calendar, DollarSign, Clock, Plane } from "lucide-react";
import { format, addDays, nextFriday, nextSunday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DestinationAutocomplete } from "./DestinationAutocomplete";
import { FlightResults } from "./FlightResults";
import { useCachedFlightPrices } from "@/hooks/useCachedFlightPrices";

export const SearchForm = () => {
  const origin = "AMS"; // Fixed to Amsterdam Schiphol
  const [destination, setDestination] = useState("anywhere");
  const [budget, setBudget] = useState("");
  const [weekend, setWeekend] = useState("");
  const [departureTimePreference, setDepartureTimePreference] = useState("any");
  const [arrivalTimePreference, setArrivalTimePreference] = useState("any");
  const [isLoading, setIsLoading] = useState(false);
  const [flightResults, setFlightResults] = useState<any[]>([]);
  const { toast } = useToast();
  const { queryCachedPrices } = useCachedFlightPrices();
  const upcomingWeekends = useMemo(() => {
    const today = new Date();
    const weekends = [];

    // Find the next Friday
    let currentFriday = nextFriday(today);
    
    // If today is Friday and it's before evening, include this weekend
    if (today.getDay() === 5 && today.getHours() < 18) {
      currentFriday = today;
    }

    // Generate next 10 weekends
    for (let i = 0; i < 10; i++) {
      const friday = i === 0 ? currentFriday : addDays(currentFriday, i * 7);
      const sunday = addDays(friday, 2);
      
      weekends.push({
        value: `weekend-${i}`,
        label: i === 0 
          ? `This Weekend (${format(friday, 'MMM d')}-${format(sunday, 'd')})`
          : i === 1
          ? `Next Weekend (${format(friday, 'MMM d')}-${format(sunday, 'd')})`
          : `In ${i} Weeks (${format(friday, 'MMM d')}-${format(sunday, 'd')})`,
        departureDate: format(friday, 'yyyy-MM-dd'),
        returnDate: format(sunday, 'yyyy-MM-dd')
      });
    }

    return weekends;
  }, []);

  const handleSearch = async () => {
    if (!destination || !weekend) {
      toast({
        title: "Missing information",
        description: "Please select a destination and weekend dates",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setFlightResults([]); // Clear previous results
    
    try {
      // Find the selected weekend dates
      const selectedWeekend = upcomingWeekends.find(w => w.value === weekend);
      if (!selectedWeekend) {
        throw new Error("Invalid weekend selection");
      }
      
      console.log('Querying cached flight prices from database');
      
      // Always query cached prices from database
      const cachedResult = await queryCachedPrices({
        departureDate: selectedWeekend.departureDate,
        returnDate: selectedWeekend.returnDate,
        maxPrice: budget ? parseInt(budget) : undefined,
        destination: destination.toLowerCase() === 'anywhere' ? undefined : destination,
      });

      if (cachedResult.data && cachedResult.data.length > 0) {
        console.log('Found cached prices:', cachedResult.data);
        setFlightResults(cachedResult.data);
        toast({
          title: "Cached flight options found",
          description: `Showing ${cachedResult.data.length} available destinations with stored prices`,
        });
      } else {
        toast({
          title: "No cached prices available",
          description: "No stored prices found for your search criteria. The system is continuously updating prices in the background.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Failed to search flights",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto p-8 shadow-elevated border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="space-y-6">
          {/* Amsterdam Origin Banner */}
          <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <Plane className="h-5 w-5 text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Flying from Amsterdam Schiphol (AMS)</p>
              <p className="text-xs text-muted-foreground">All flights depart from Amsterdam</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-1">
            <DestinationAutocomplete
              value={destination}
              onChange={setDestination}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="weekend" className="flex items-center gap-2 text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                Select Weekend
              </Label>
              <Select value={weekend} onValueChange={setWeekend}>
                <SelectTrigger id="weekend" className="h-12 border-border/50">
                  <SelectValue placeholder="Choose dates" />
                </SelectTrigger>
                <SelectContent>
                  {upcomingWeekends.map((weekend) => (
                    <SelectItem key={weekend.value} value={weekend.value}>
                      {weekend.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget" className="flex items-center gap-2 text-foreground">
                <DollarSign className="h-4 w-4 text-primary" />
                Max Budget (EUR, per person)
              </Label>
              <Input
                id="budget"
                type="number"
                placeholder="e.g., 200"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="h-12 border-border/50"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="departure" className="flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              Preferred Departure Time
            </Label>
            <Select value={departureTimePreference} onValueChange={setDepartureTimePreference}>
              <SelectTrigger id="departure" className="h-12 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Time</SelectItem>
                <SelectItem value="morning">Morning (6am-12pm)</SelectItem>
                <SelectItem value="afternoon">Afternoon (12pm-6pm)</SelectItem>
                <SelectItem value="evening">Evening (6pm-12am)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="arrival" className="flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              Preferred Arrival Time
            </Label>
            <Select value={arrivalTimePreference} onValueChange={setArrivalTimePreference}>
              <SelectTrigger id="arrival" className="h-12 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Time</SelectItem>
                <SelectItem value="morning">Morning (6am-12pm)</SelectItem>
                <SelectItem value="afternoon">Afternoon (12pm-6pm)</SelectItem>
                <SelectItem value="evening">Evening (6pm-12am)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

          <Button
            onClick={handleSearch}
            size="lg"
            variant="cta"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Searching flights..." : "Find Weekend Getaways"}
          </Button>
        </div>
      </Card>

      {flightResults.length > 0 && (
        <FlightResults 
          flights={flightResults} 
          origin={origin} 
          destination={destination} 
        />
      )}
    </>
  );
};
