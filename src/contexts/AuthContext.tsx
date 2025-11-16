import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

// Derive profile fields from OAuth metadata with sensible fallbacks
function deriveProfileFromUser(user: User) {
  const md: Record<string, any> = user.user_metadata || {};

  let first_name: string | null = md.first_name || md.given_name || null;
  let last_name: string | null = md.last_name || md.family_name || null;

  const full = (md.full_name || md.name) as string | undefined;
  if ((!first_name || !last_name) && full && typeof full === 'string') {
    const parts = full.trim().split(/\s+/);
    if (!first_name && parts.length > 0) first_name = parts[0] || null;
    if (!last_name && parts.length > 1) last_name = parts.slice(1).join(' ') || null;
  }

  const gender: string | null = md.gender || null; // Only present if scope granted
  const avatar_url: string | null = md.avatar_url || md.picture || null;

  return { first_name, last_name, gender, avatar_url };
}
interface AuthContextType {
  user: User | null;
  session: Session | null;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === "SIGNED_IN" && session?.user) {
          // Sync profile data from OAuth providers (especially Google)
          setTimeout(() => {
            const derived = deriveProfileFromUser(session.user);
            console.log("Syncing profile for user:", session.user.id, derived);
            
            supabase
              .from("profiles")
              .upsert({
                id: session.user.id,
                ...derived,
              }, {
                onConflict: "id"
              })
              .then(({ error }) => {
                if (error) {
                  console.error("Error syncing profile:", error);
                } else {
                  console.log("Profile synced successfully");
                }
              });
          }, 0);
          
          navigate("/");
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Ensure profile exists and is synced even if user was already logged in (INITIAL_SESSION)
      if (session?.user) {
        const derived = deriveProfileFromUser(session.user);
        try {
          await supabase
            .from("profiles")
            .upsert({
              id: session.user.id,
              ...derived,
            }, {
              onConflict: "id"
            });
        } catch (e) {
          console.error("Profile upsert on INITIAL_SESSION failed:", e);
        }
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, session, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
