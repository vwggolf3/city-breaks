import { useState } from "react";
import { Calendar, DollarSign, Clock } from "lucide-react";
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

  const getWeekendDates = (weekendValue: string) => {
    const today = new Date();
    let departureDate = new Date();
    
    switch (weekendValue) {
      case "this-weekend":
        departureDate.setDate(today.getDate() + (5 - today.getDay() + 7) % 7);
        break;
      case "next-weekend":
        departureDate.setDate(today.getDate() + (5 - today.getDay() + 7) % 7 + 7);
        break;
      case "2-weeks":
        departureDate.setDate(today.getDate() + (5 - today.getDay() + 7) % 7 + 14);
        break;
      case "3-weeks":
        departureDate.setDate(today.getDate() + (5 - today.getDay() + 7) % 7 + 21);
        break;
      default:
        departureDate = new Date();
    }
    
    const returnDate = new Date(departureDate);
    returnDate.setDate(departureDate.getDate() + 2);
    
    return {
      departure: departureDate.toISOString().split('T')[0],
      return: returnDate.toISOString().split('T')[0]
    };
  };

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
      const dates = getWeekendDates(weekend);
      
      // Extract airport codes (last 3 characters in parentheses if present, otherwise use as-is)
      const originCode = origin.match(/\(([A-Z]{3})\)/)?.[1] || origin.toUpperCase().slice(-3);
      const destCode = destination.match(/\(([A-Z]{3})\)/)?.[1] || destination.toUpperCase();
      
      const { data, error } = await supabase.functions.invoke('search-flights', {
        body: {
          origin: originCode,
          destination: destCode,
          departureDate: dates.departure,
          returnDate: dates.return,
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
                <SelectItem value="this-weekend">This Weekend (Jan 17-19)</SelectItem>
                <SelectItem value="next-weekend">Next Weekend (Jan 24-26)</SelectItem>
                <SelectItem value="2-weeks">In 2 Weeks (Jan 31-Feb 2)</SelectItem>
                <SelectItem value="3-weeks">In 3 Weeks (Feb 7-9)</SelectItem>
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
