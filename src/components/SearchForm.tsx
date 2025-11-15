import { useState, useMemo } from "react";
import { Calendar, DollarSign, Clock } from "lucide-react";
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
import { AirportAutocomplete } from "./AirportAutocomplete";
import { DestinationAutocomplete } from "./DestinationAutocomplete";

export const SearchForm = () => {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [budget, setBudget] = useState("");
  const [weekend, setWeekend] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Generate the next 3 upcoming weekends dynamically
  const upcomingWeekends = useMemo(() => {
    const today = new Date();
    const weekends = [];

    // Find the next Friday
    let currentFriday = nextFriday(today);
    
    // If today is Friday and it's before evening, include this weekend
    if (today.getDay() === 5 && today.getHours() < 18) {
      currentFriday = today;
    }

    // Generate next 3 weekends
    for (let i = 0; i < 3; i++) {
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
    if (!origin || !destination || !weekend) {
      toast({
        title: "Missing information",
        description: "Please fill in origin, destination, and select a weekend",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Find the selected weekend dates
      const selectedWeekend = upcomingWeekends.find(w => w.value === weekend);
      if (!selectedWeekend) {
        throw new Error("Invalid weekend selection");
      }
      
      // Extract airport codes (last 3 characters in parentheses if present, otherwise use as-is)
      const originCode = origin.match(/\(([A-Z]{3})\)/)?.[1] || origin.toUpperCase().slice(-3);
      const destCode = destination.match(/\(([A-Z]{3})\)/)?.[1] || destination.toUpperCase();
      
      const { data, error } = await supabase.functions.invoke('search-flights', {
        body: {
          origin: originCode,
          destination: destCode,
          departureDate: selectedWeekend.departureDate,
          returnDate: selectedWeekend.returnDate,
          maxPrice: budget ? parseInt(budget) : undefined,
          adults: 1,
        }
      });

      if (error) throw error;

      console.log('Flight search results:', data);
      
      toast({
        title: "Search completed",
        description: `Found ${data.data?.length || 0} flight options`,
      });

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
    <Card className="w-full max-w-4xl mx-auto p-8 shadow-elevated border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <AirportAutocomplete
            value={origin}
            onChange={setOrigin}
          />

          <DestinationAutocomplete
            value={destination}
            onChange={setDestination}
          />

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
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="budget" className="flex items-center gap-2 text-foreground">
              <DollarSign className="h-4 w-4 text-primary" />
              Max Budget (per person)
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

          <div className="space-y-2">
            <Label htmlFor="departure" className="flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              Preferred Departure Time
            </Label>
            <Select defaultValue="any">
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
  );
};
