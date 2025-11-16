export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      airports: {
        Row: {
          city: string
          country: string
          created_at: string | null
          iata_code: string
          id: string
          last_synced_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          region: string | null
          updated_at: string | null
        }
        Insert: {
          city: string
          country: string
          created_at?: string | null
          iata_code: string
          id?: string
          last_synced_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          region?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string
          country?: string
          created_at?: string | null
          iata_code?: string
          id?: string
          last_synced_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          region?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ams_destinations: {
        Row: {
          city: string
          country: string
          created_at: string | null
          currency: string | null
          destination_code: string
          id: string
          last_price: number | null
          last_synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          city: string
          country: string
          created_at?: string | null
          currency?: string | null
          destination_code: string
          id?: string
          last_price?: number | null
          last_synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string
          country?: string
          created_at?: string | null
          currency?: string | null
          destination_code?: string
          id?: string
          last_price?: number | null
          last_synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      favorite_destinations: {
        Row: {
          created_at: string | null
          destination_code: string | null
          destination_name: string
          destination_type: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          destination_code?: string | null
          destination_name: string
          destination_type: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          destination_code?: string | null
          destination_name?: string
          destination_type?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_destinations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_bookings: {
        Row: {
          booked_at: string | null
          booking_reference: string | null
          created_at: string
          currency: string
          encrypted_email: string | null
          encrypted_phone: string | null
          encrypted_traveler_name: string | null
          flight_data: Json
          flight_offer_id: string
          id: string
          order_id: string | null
          status: string
          total_price: number
          traveler_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          booked_at?: string | null
          booking_reference?: string | null
          created_at?: string
          currency: string
          encrypted_email?: string | null
          encrypted_phone?: string | null
          encrypted_traveler_name?: string | null
          flight_data: Json
          flight_offer_id: string
          id?: string
          order_id?: string | null
          status?: string
          total_price: number
          traveler_data: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          booked_at?: string | null
          booking_reference?: string | null
          created_at?: string
          currency?: string
          encrypted_email?: string | null
          encrypted_phone?: string | null
          encrypted_traveler_name?: string | null
          flight_data?: Json
          flight_offer_id?: string
          id?: string
          order_id?: string | null
          status?: string
          total_price?: number
          traveler_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          first_name: string | null
          gender: string | null
          home_airport_code: string | null
          id: string
          last_name: string | null
          preferred_currency: string | null
          preferred_language: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          gender?: string | null
          home_airport_code?: string | null
          id: string
          last_name?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          gender?: string | null
          home_airport_code?: string | null
          id?: string
          last_name?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          budget: number | null
          created_at: string | null
          departure_time_preference: string | null
          destination_airport: string | null
          id: string
          max_stops: number | null
          notes: string | null
          origin_airport: string
          search_name: string | null
          updated_at: string | null
          user_id: string
          weekend_date: string | null
        }
        Insert: {
          budget?: number | null
          created_at?: string | null
          departure_time_preference?: string | null
          destination_airport?: string | null
          id?: string
          max_stops?: number | null
          notes?: string | null
          origin_airport: string
          search_name?: string | null
          updated_at?: string | null
          user_id: string
          weekend_date?: string | null
        }
        Update: {
          budget?: number | null
          created_at?: string | null
          departure_time_preference?: string | null
          destination_airport?: string | null
          id?: string
          max_stops?: number | null
          notes?: string | null
          origin_airport?: string
          search_name?: string | null
          updated_at?: string | null
          user_id?: string
          weekend_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_preferences: {
        Row: {
          accessibility_needs: string | null
          baggage_preference: string | null
          created_at: string | null
          dietary_requirements: string | null
          id: string
          max_budget: number | null
          max_stops: number | null
          preferred_airlines: string[] | null
          preferred_seat_class: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accessibility_needs?: string | null
          baggage_preference?: string | null
          created_at?: string | null
          dietary_requirements?: string | null
          id?: string
          max_budget?: number | null
          max_stops?: number | null
          preferred_airlines?: string[] | null
          preferred_seat_class?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accessibility_needs?: string | null
          baggage_preference?: string | null
          created_at?: string | null
          dietary_requirements?: string | null
          id?: string
          max_budget?: number | null
          max_stops?: number | null
          preferred_airlines?: string[] | null
          preferred_seat_class?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_time_constraints: {
        Row: {
          active: boolean | null
          constraint_type: string
          created_at: string | null
          day_of_week: string
          earliest_time: string | null
          id: string
          latest_time: string | null
          reason: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          constraint_type: string
          created_at?: string | null
          day_of_week: string
          earliest_time?: string | null
          id?: string
          latest_time?: string | null
          reason?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          constraint_type?: string
          created_at?: string | null
          day_of_week?: string
          earliest_time?: string | null
          id?: string
          latest_time?: string | null
          reason?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_time_constraints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_bookings: {
        Row: {
          booked_at: string | null
          booking_reference: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          currency: string | null
          flight_data: Json | null
          flight_offer_id: string | null
          id: string | null
          order_id: string | null
          status: string | null
          total_price: number | null
          traveler_data: Json | null
          traveler_name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          booked_at?: string | null
          booking_reference?: string | null
          contact_email?: never
          contact_phone?: never
          created_at?: string | null
          currency?: string | null
          flight_data?: Json | null
          flight_offer_id?: string | null
          id?: string | null
          order_id?: string | null
          status?: string | null
          total_price?: number | null
          traveler_data?: Json | null
          traveler_name?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          booked_at?: string | null
          booking_reference?: string | null
          contact_email?: never
          contact_phone?: never
          created_at?: string | null
          currency?: string | null
          flight_data?: Json | null
          flight_offer_id?: string | null
          id?: string | null
          order_id?: string | null
          status?: string | null
          total_price?: number | null
          traveler_data?: Json | null
          traveler_name?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_encrypted_booking: {
        Args: {
          p_booked_at: string
          p_booking_reference: string
          p_contact_email: string
          p_contact_phone: string
          p_currency: string
          p_flight_data: Json
          p_flight_offer_id: string
          p_order_id: string
          p_status: string
          p_total_price: number
          p_traveler_name: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
