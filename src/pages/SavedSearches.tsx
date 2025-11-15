import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Search, Trash2, MapPin, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface SavedSearch {
  id: string;
  origin_airport: string;
  destination_airport: string | null;
  budget: number | null;
  weekend_date: string | null;
  departure_time_preference: string | null;
  max_stops: number | null;
  search_name: string | null;
  notes: string | null;
  created_at: string;
}

const SavedSearches = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSearches();
    }
  }, [user]);

  const fetchSearches = async () => {
    try {
      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSearches(data || []);
    } catch (error) {
      console.error("Error fetching searches:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSearch = async (id: string) => {
    try {
      const { error } = await supabase
        .from("saved_searches")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await fetchSearches();
      
      toast({
        title: "Search removed",
        description: "Saved search has been deleted.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove search",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto py-8 px-4 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading searches...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Search className="h-8 w-8 text-primary" />
            Saved Searches
          </h1>
          <p className="text-muted-foreground mt-2">
            Your previous flight searches for quick access
          </p>
        </div>

        {searches.length === 0 ? (
          <Card className="p-12 text-center">
            <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-xl font-semibold mb-2">No saved searches yet</h3>
            <p className="text-muted-foreground mb-6">
              When you search for flights, you'll be able to save them here for easy access
            </p>
            <Button onClick={() => window.location.href = "/#search"}>
              <Search className="h-4 w-4 mr-2" />
              Search for Flights
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {searches.map((search) => (
              <Card key={search.id} className="p-5 hover:shadow-elevated transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    {search.search_name && (
                      <h3 className="font-semibold text-lg mb-2">{search.search_name}</h3>
                    )}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>
                          From <strong className="text-foreground">{search.origin_airport}</strong>
                          {search.destination_airport && (
                            <> to <strong className="text-foreground">{search.destination_airport}</strong></>
                          )}
                        </span>
                      </div>
                      
                      {search.weekend_date && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span>{format(new Date(search.weekend_date), "MMM d, yyyy")}</span>
                        </div>
                      )}
                      
                      {search.budget && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="h-4 w-4 text-primary" />
                          <span>Budget: €{search.budget}</span>
                        </div>
                      )}
                      
                      {search.departure_time_preference && (
                        <div className="text-muted-foreground">
                          <span>Departure: {search.departure_time_preference}</span>
                        </div>
                      )}
                      
                      {search.max_stops !== null && (
                        <div className="text-muted-foreground">
                          <span>Max stops: {search.max_stops}</span>
                        </div>
                      )}
                    </div>
                    
                    {search.notes && (
                      <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border">
                        {search.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSearch(search.id)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                
                <div className="flex gap-2 pt-3 border-t border-border">
                  <Button size="sm" className="flex-1">
                    Search Again
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    Set Alert
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedSearches;
