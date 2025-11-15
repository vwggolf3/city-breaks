import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AirportAutocomplete } from "@/components/AirportAutocomplete";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_currency: string | null;
  preferred_language: string | null;
  home_airport_code: string | null;
}

interface TimeConstraint {
  id: string;
  day_of_week: string;
  earliest_time: string | null;
  latest_time: string | null;
  constraint_type: string;
  reason: string | null;
  active: boolean;
}

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timeConstraints, setTimeConstraints] = useState<TimeConstraint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchTimeConstraints();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTimeConstraints = async () => {
    try {
      const { data, error } = await supabase
        .from("user_time_constraints")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTimeConstraints(data || []);
    } catch (error) {
      console.error("Error fetching time constraints:", error);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: profile?.first_name,
          last_name: profile?.last_name,
          preferred_currency: profile?.preferred_currency,
          preferred_language: profile?.preferred_language,
          home_airport_code: profile?.home_airport_code,
        })
        .eq("id", user?.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addTimeConstraint = async () => {
    try {
      const { error } = await supabase
        .from("user_time_constraints")
        .insert({
          user_id: user?.id,
          day_of_week: "friday",
          earliest_time: "17:00",
          constraint_type: "departure",
          reason: "School pickup constraint",
          active: true,
        });

      if (error) throw error;
      await fetchTimeConstraints();
      
      toast({
        title: "Time constraint added",
        description: "New time constraint has been created.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add constraint",
        variant: "destructive",
      });
    }
  };

  const deleteTimeConstraint = async (id: string) => {
    try {
      const { error } = await supabase
        .from("user_time_constraints")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await fetchTimeConstraints();
      
      toast({
        title: "Time constraint removed",
        description: "The time constraint has been deleted.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete constraint",
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
            <p className="mt-4 text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Profile & Preferences</h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="time-constraints">Time Constraints</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="p-6">
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profile?.first_name || ""}
                      onChange={(e) =>
                        setProfile(prev => prev ? { ...prev, first_name: e.target.value } : null)
                      }
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profile?.last_name || ""}
                      onChange={(e) =>
                        setProfile(prev => prev ? { ...prev, last_name: e.target.value } : null)
                      }
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <AirportAutocomplete
                    label="Home Airport"
                    placeholder="Search for your home airport..."
                    value={profile?.home_airport_code || ""}
                    onChange={(value) =>
                      setProfile(prev => prev ? { ...prev, home_airport_code: value } : null)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Your default departure airport
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Preferred Currency</Label>
                    <Select
                      value={profile?.preferred_currency || "EUR"}
                      onValueChange={(value) =>
                        setProfile(prev => prev ? { ...prev, preferred_currency: value } : null)
                      }
                    >
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="CHF">CHF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Preferred Language</Label>
                    <Select
                      value={profile?.preferred_language || "en"}
                      onValueChange={(value) =>
                        setProfile(prev => prev ? { ...prev, preferred_language: value } : null)
                      }
                    >
                      <SelectTrigger id="language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Profile"}
                </Button>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="time-constraints">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Time Constraints
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Set time windows for departures and arrivals (e.g., school pickup times)
                  </p>
                </div>
                <Button onClick={addTimeConstraint} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Constraint
                </Button>
              </div>

              <div className="space-y-4">
                {timeConstraints.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No time constraints set yet</p>
                    <p className="text-sm">Add constraints to filter flights by your schedule</p>
                  </div>
                ) : (
                  timeConstraints.map((constraint) => (
                    <Card key={constraint.id} className="p-4 border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium capitalize">{constraint.day_of_week}</span>
                            <span className="text-sm text-muted-foreground">•</span>
                            <span className="text-sm capitalize">{constraint.constraint_type}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {constraint.earliest_time && (
                              <span>After {constraint.earliest_time}</span>
                            )}
                            {constraint.latest_time && (
                              <span> • Before {constraint.latest_time}</span>
                            )}
                          </div>
                          {constraint.reason && (
                            <p className="text-sm mt-2 text-foreground">{constraint.reason}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTimeConstraint(constraint.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;
