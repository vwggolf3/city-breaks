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

interface Airport {
  type: string;
  subType: string;
  name: string;
  iataCode: string;
  address?: {
    cityName?: string;
    countryName?: string;
  };
}

interface AirportAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (airport: Airport) => void;
}

export const AirportAutocomplete = ({ value, onChange, onSelect }: AirportAutocompleteProps) => {
  const [open, setOpen] = useState(false);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      if (inputValue.length >= 2) {
        setIsLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('search-airports', {
            body: { query: inputValue }
          });

          if (error) throw error;

          if (data?.data) {
            setAirports(data.data.filter((item: Airport) => 
              item.subType === 'AIRPORT' || item.subType === 'CITY'
            ));
            setOpen(true);
          }
        } catch (error) {
          console.error('Airport search error:', error);
          setAirports([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setAirports([]);
        setOpen(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [inputValue]);

  const handleSelect = (airport: Airport) => {
    const displayValue = `${airport.name} (${airport.iataCode})`;
    setInputValue(displayValue);
    onChange(airport.iataCode);
    if (onSelect) {
      onSelect(airport);
    }
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="origin" className="flex items-center gap-2 text-foreground">
        <MapPin className="h-4 w-4 text-primary" />
        Origin Airport
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              id="origin"
              placeholder="e.g., Amsterdam, London, Paris..."
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                onChange(e.target.value);
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
          className="w-[--radix-popover-trigger-width] p-0 bg-popover border-border" 
          align="start"
        >
          <Command className="bg-transparent">
            <CommandList>
              {airports.length === 0 && !isLoading && (
                <CommandEmpty>No airports found.</CommandEmpty>
              )}
              <CommandGroup>
                {airports.map((airport) => (
                  <CommandItem
                    key={airport.iataCode}
                    onSelect={() => handleSelect(airport)}
                    className="flex items-center gap-3 cursor-pointer hover:bg-accent"
                  >
                    <Plane className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {airport.name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {airport.iataCode}
                        {airport.address?.cityName && ` • ${airport.address.cityName}`}
                        {airport.address?.countryName && `, ${airport.address.countryName}`}
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
