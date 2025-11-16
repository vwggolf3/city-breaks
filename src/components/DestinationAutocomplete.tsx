import { useState, useEffect } from "react";
import { MapPin, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Destination {
  destination_code: string;
  city: string;
  country: string;
}

interface DestinationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (destination: Destination) => void;
}

export const DestinationAutocomplete = ({ value, onChange, onSelect }: DestinationAutocompleteProps) => {
  const [open, setOpen] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);

  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      // Special case: "anywhere" doesn't need destination search
      if (inputValue.toLowerCase() === 'anywhere') {
        setDestinations([]);
        setOpen(false);
        return;
      }

      // Only search if we don't have a selected destination or if the input has changed
      if (inputValue.length >= 1 && !selectedDestination) {
        setIsLoading(true);
        try {
          // Query ams_destinations table for European destinations from Amsterdam
          const { data, error } = await supabase
            .from('ams_destinations')
            .select('destination_code, city, country')
            .or(`city.ilike.%${inputValue}%,country.ilike.%${inputValue}%,destination_code.ilike.%${inputValue}%`)
            .neq('country', 'Unknown')
            .order('city', { ascending: true })
            .limit(20);

          if (error) throw error;

          if (data) {
            setDestinations(data);
            setOpen(true);
          }
        } catch (error) {
          console.error('Destination search error:', error);
          setDestinations([]);
        } finally {
          setIsLoading(false);
        }
      } else if (inputValue.length === 0) {
        setDestinations([]);
        setSelectedDestination(null);
        setOpen(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [inputValue, selectedDestination]);

  const handleSelect = (destination: Destination) => {
    const displayValue = `${destination.city} (${destination.destination_code})`;
    setInputValue(displayValue);
    setSelectedDestination(destination);
    onChange(destination.destination_code);
    if (onSelect) {
      onSelect(destination);
    }
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedDestination(null); // Clear selection when user starts typing
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="destination" className="flex items-center gap-2 text-foreground">
        <MapPin className="h-4 w-4 text-primary" />
        Destination (or type "anywhere")
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              id="destination"
              placeholder='Type "anywhere" or a city name...'
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => {
                if (selectedDestination) {
                  setOpen(true);
                }
              }}
              className="h-12 border-border/50"
              autoComplete="off"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[--radix-popover-trigger-width] p-0 bg-popover border-border z-50" 
          align="start"
        >
          <Command className="bg-transparent">
            <CommandList>
              {destinations.length === 0 && !isLoading && !selectedDestination && inputValue.length > 0 && inputValue.toLowerCase() !== 'anywhere' && (
                <CommandEmpty>No destinations found. Only European destinations from Amsterdam are available.</CommandEmpty>
              )}
              <CommandGroup>
                {destinations.map((destination) => (
                  <CommandItem
                    key={destination.destination_code}
                    onSelect={() => handleSelect(destination)}
                    className="flex items-center gap-3 cursor-pointer hover:bg-accent"
                  >
                    <Plane className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {destination.city}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {destination.destination_code} • {destination.country}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
