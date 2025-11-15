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
  code: string;
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

  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-destinations', {
          body: { query: inputValue }
        });

        if (error) throw error;

        if (data?.data) {
          setDestinations(data.data);
          if (inputValue.length >= 1) {
            setOpen(true);
          }
        }
      } catch (error) {
        console.error('Destination search error:', error);
        setDestinations([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [inputValue]);

  const handleSelect = (destination: Destination) => {
    const displayValue = `${destination.city}, ${destination.country} (${destination.code})`;
    setInputValue(displayValue);
    onChange(destination.code);
    if (onSelect) {
      onSelect(destination);
    }
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="destination" className="flex items-center gap-2 text-foreground">
        <MapPin className="h-4 w-4 text-primary" />
        Destination (European Cities)
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              id="destination"
              placeholder="e.g., Barcelona, Rome, Paris..."
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
              {destinations.length === 0 && !isLoading && (
                <CommandEmpty>No destinations found.</CommandEmpty>
              )}
              <CommandGroup>
                {destinations.map((destination) => (
                  <CommandItem
                    key={destination.code}
                    onSelect={() => handleSelect(destination)}
                    className="flex items-center gap-3 cursor-pointer hover:bg-accent"
                  >
                    <Plane className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {destination.city}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {destination.code} • {destination.country}
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
