/**
 * Bu dosya `supabase/migrations` altindaki semayla birebir eslesecek sekilde
 * ELLE yazilmistir. Supabase projesi kurulduktan sonra, gercek/otoritatif
 * kaynak olarak asagidaki komutla YENIDEN URETILMELIDIR:
 *
 *   npx supabase gen types typescript --project-id <PROJECT_ID> > src/lib/types/database.types.ts
 *
 * O ana kadar bu dosya, uygulamanin geri kalaninin (client/server/data
 * katmani) tip guvenligiyle calismasini saglar.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          city: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          city?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
        Relationships: [];
      };

      profiles: {
        Row: {
          id: string;
          company_id: string | null;
          role: "admin" | "owner" | "sales";
          full_name: string | null;
          email: string | null;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          company_id?: string | null;
          role?: "admin" | "owner" | "sales";
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };

      leads: {
        Row: {
          id: string;
          company_id: string;
          first_name: string;
          last_name: string | null;
          phone: string;
          email: string | null;
          city: string | null;
          district: string | null;
          property_type:
            | "villa"
            | "detached_house"
            | "apartment"
            | "workplace"
            | "factory"
            | "hotel"
            | "other"
            | null;
          area_m2: number | null;
          building_status: "new_building" | "existing_building" | "under_construction" | "other" | null;
          heating_type:
            | "combi_gas"
            | "solid_fuel"
            | "electric"
            | "air_conditioner"
            | "central"
            | "none"
            | "other"
            | null;
          underfloor_heating: boolean;
          radiator: boolean;
          offered_amount: number | null;
          product_interest: "heat_pump" | "air_conditioner" | "vrf" | "other" | null;
          product_category_id: string | null;
          purchase_timeline:
            | "immediate"
            | "0_1_month"
            | "1_3_month"
            | "3_6_month"
            | "6_plus_month"
            | "undecided"
            | null;
          source: string | null;
          source_campaign: string | null;
          assigned_salesperson: string | null;
          status:
            | "new"
            | "called"
            | "discovery_offer"
            | "won"
            | "followup"
            | "lost";
          priority: "hot" | "cold";
          notes: string | null;
          last_contact_at: string | null;
          next_followup_at: string | null;
          next_followup_note: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          first_name: string;
          last_name?: string | null;
          phone: string;
          email?: string | null;
          city?: string | null;
          district?: string | null;
          property_type?: Database["public"]["Tables"]["leads"]["Row"]["property_type"];
          area_m2?: number | null;
          building_status?: Database["public"]["Tables"]["leads"]["Row"]["building_status"];
          heating_type?: Database["public"]["Tables"]["leads"]["Row"]["heating_type"];
          underfloor_heating?: boolean;
          radiator?: boolean;
          offered_amount?: number | null;
          product_interest?: Database["public"]["Tables"]["leads"]["Row"]["product_interest"];
          product_category_id?: string | null;
          purchase_timeline?: Database["public"]["Tables"]["leads"]["Row"]["purchase_timeline"];
          source?: string | null;
          source_campaign?: string | null;
          assigned_salesperson?: string | null;
          status?: Database["public"]["Tables"]["leads"]["Row"]["status"];
          priority?: Database["public"]["Tables"]["leads"]["Row"]["priority"];
          notes?: string | null;
          last_contact_at?: string | null;
          next_followup_at?: string | null;
          next_followup_note?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_assigned_salesperson_fkey";
            columns: ["assigned_salesperson"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_product_category_id_fkey";
            columns: ["product_category_id"];
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
        ];
      };

      product_categories: {
        Row: {
          id: string;
          company_id: string;
          label: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          label: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_categories"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };

      activities: {
        Row: {
          id: string;
          company_id: string;
          lead_id: string;
          type: "note" | "status_change" | "call" | "meeting" | "system";
          description: string;
          from_status: string | null;
          to_status: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          lead_id: string;
          type?: Database["public"]["Tables"]["activities"]["Row"]["type"];
          description: string;
          from_status?: string | null;
          to_status?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey";
            columns: ["lead_id"];
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };

      followups: {
        Row: {
          id: string;
          company_id: string;
          lead_id: string;
          followup_date: string;
          note: string | null;
          is_completed: boolean;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          lead_id: string;
          followup_date: string;
          note?: string | null;
          is_completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["followups"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "followups_lead_id_fkey";
            columns: ["lead_id"];
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };

      sales: {
        Row: {
          id: string;
          company_id: string;
          lead_id: string;
          sale_amount: number;
          sale_date: string;
          salesperson: string | null;
          product_service: string | null;
          notes: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          lead_id: string;
          sale_amount: number;
          sale_date?: string;
          salesperson?: string | null;
          product_service?: string | null;
          notes?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sales"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sales_lead_id_fkey";
            columns: ["lead_id"];
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };

      competitors: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          website: string | null;
          city: string | null;
          notes: string | null;
          tracking_frequency: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          website?: string | null;
          city?: string | null;
          notes?: string | null;
          tracking_frequency?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitors"]["Insert"]>;
        Relationships: [];
      };

      integrations: {
        Row: {
          id: string;
          company_id: string;
          provider: "whatsapp" | "meta_ads" | "telegram" | "google_analytics" | "search_console";
          status: "disconnected" | "pending" | "connected" | "error";
          config: Json;
          connected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          provider: Database["public"]["Tables"]["integrations"]["Row"]["provider"];
          status?: Database["public"]["Tables"]["integrations"]["Row"]["status"];
          config?: Json;
          connected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["integrations"]["Insert"]>;
        Relationships: [];
      };

      ai_reports: {
        Row: {
          id: string;
          company_id: string;
          report_type: string;
          period_start: string | null;
          period_end: string | null;
          content: Json;
          generated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          report_type: string;
          period_start?: string | null;
          period_end?: string | null;
          content?: Json;
          generated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["ai_reports"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_user_company_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
