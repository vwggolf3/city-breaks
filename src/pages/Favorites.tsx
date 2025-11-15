import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Heart, Plus, Trash2, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FavoriteDestination {
  id: string;
  destination_type: string;
  destination_name: string;
  destination_code: string | null;
  notes: string | null;
  created_at: string;
}

const Favorites = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<FavoriteDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [newFavorite, setNewFavorite] = useState({
    destination_type: "city",
    destination_name: "",
    destination_code: "",
    notes: "",
  });

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from("favorite_destinations")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error("Error fetching favorites:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addFavorite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from("favorite_destinations")
        .insert({
          user_id: user?.id,
          ...newFavorite,
        });

      if (error) {
        if (error.message.includes("duplicate")) {
          toast({
            title: "Already exists",
            description: "This destination is already in your favorites.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        await fetchFavorites();
        setIsDialogOpen(false);
        setNewFavorite({
          destination_type: "city",
          destination_name: "",
          destination_code: "",
          notes: "",
        });
        
        toast({
          title: "Favorite added",
          description: "Destination added to your favorites.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add favorite",
        variant: "destructive",
      });
    }
  };

  const deleteFavorite = async (id: string) => {
    try {
      const { error } = await supabase
        .from("favorite_destinations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await fetchFavorites();
      
      toast({
        title: "Favorite removed",
        description: "Destination removed from your favorites.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove favorite",
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
            <p className="mt-4 text-muted-foreground">Loading favorites...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Heart className="h-8 w-8 text-primary" />
              Favorite Destinations
            </h1>
            <p className="text-muted-foreground mt-2">
              Save your dream destinations for quick access
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Favorite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Favorite Destination</DialogTitle>
                <DialogDescription>
                  Save a city or country you'd love to visit
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={addFavorite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={newFavorite.destination_type}
                    onValueChange={(value) =>
                      setNewFavorite((prev) => ({ ...prev, destination_type: value }))
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="city">City</SelectItem>
                      <SelectItem value="country">Country</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Destination Name</Label>
                  <Input
                    id="name"
                    value={newFavorite.destination_name}
                    onChange={(e) =>
                      setNewFavorite((prev) => ({ ...prev, destination_name: e.target.value }))
                    }
                    placeholder="e.g., Barcelona, Paris, Rome"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Airport/Country Code (Optional)</Label>
                  <Input
                    id="code"
                    value={newFavorite.destination_code}
                    onChange={(e) =>
                      setNewFavorite((prev) => ({
                        ...prev,
                        destination_code: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="e.g., BCN, CDG"
                    maxLength={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={newFavorite.notes}
                    onChange={(e) =>
                      setNewFavorite((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Why do you want to visit?"
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Add to Favorites
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {favorites.length === 0 ? (
          <Card className="p-12 text-center">
            <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-xl font-semibold mb-2">No favorites yet</h3>
            <p className="text-muted-foreground mb-6">
              Start adding your dream destinations to keep track of places you want to visit
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Favorite
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((favorite) => (
              <Card key={favorite.id} className="p-4 hover:shadow-elevated transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">{favorite.destination_name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">
                      {favorite.destination_type}
                      {favorite.destination_code && ` • ${favorite.destination_code}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteFavorite(favorite.id)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {favorite.notes && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {favorite.notes}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
