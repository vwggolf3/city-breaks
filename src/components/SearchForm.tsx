import { useState } from "react";
import { Calendar, MapPin, DollarSign, Clock } from "lucide-react";
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

export const SearchForm = () => {
  const [origin, setOrigin] = useState("");
  const [budget, setBudget] = useState("");
  const [weekend, setWeekend] = useState("");

  const handleSearch = () => {
    // Mock search - will integrate real API later
    console.log("Searching flights...", { origin, budget, weekend });
  };

  return (
    <Card className="w-full max-w-4xl mx-auto p-8 shadow-elevated border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="origin" className="flex items-center gap-2 text-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              Origin Airport
            </Label>
            <Input
              id="origin"
              placeholder="e.g., London (LHR)"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="h-12 border-border/50"
            />
          </div>

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
        >
          Find Weekend Getaways
        </Button>
      </div>
    </Card>
  );
};
