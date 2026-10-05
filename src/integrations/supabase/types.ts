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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          amount: number | null
          created_at: string
          id: string
          metadata: Json | null
          sector: string
        }
        Insert: {
          action: string
          amount?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          sector: string
        }
        Update: {
          action?: string
          amount?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          sector?: string
        }
        Relationships: []
      }
      bank_deposits: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          sector: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          sector: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          sector?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          approved_at: string | null
          code: string | null
          code_expires_at: string | null
          created_at: string
          id: string
          last_seen_at: string | null
          status: string
          token_hash: string | null
        }
        Insert: {
          approved_at?: string | null
          code?: string | null
          code_expires_at?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string | null
          status?: string
          token_hash?: string | null
        }
        Update: {
          approved_at?: string | null
          code?: string | null
          code_expires_at?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string | null
          status?: string
          token_hash?: string | null
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          asset_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          invoice_path: string | null
          notes: string | null
          payment_method: string
          quantity: number | null
          sector: string
          status: string
          stock_unit: string | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          asset_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          invoice_path?: string | null
          notes?: string | null
          payment_method?: string
          quantity?: number | null
          sector: string
          status?: string
          stock_unit?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          asset_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          invoice_path?: string | null
          notes?: string | null
          payment_method?: string
          quantity?: number | null
          sector?: string
          status?: string
          stock_unit?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "rental_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rental_assets: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          name: string
          notes: string | null
          plate: string | null
          sector: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name: string
          notes?: string | null
          plate?: string | null
          sector?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          plate?: string | null
          sector?: string
        }
        Relationships: []
      }
      rental_stock_usage: {
        Row: {
          amount: number
          asset_id: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          purchase_id: string
          quantity: number
          sector: string
          used_on: string
        }
        Insert: {
          amount?: number
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          purchase_id: string
          quantity?: number
          sector?: string
          used_on?: string
        }
        Update: {
          amount?: number
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          purchase_id?: string
          quantity?: number
          sector?: string
          used_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_stock_usage_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "rental_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_stock_usage_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_menu_items: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      restaurant_orders: {
        Row: {
          created_at: string
          id: string
          status: string
          table_id: string | null
          total: number
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          table_id?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          table_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          capacity: number
          created_at: string
          current_order_value: number | null
          id: string
          number: number
          status: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          current_order_value?: number | null
          id?: string
          number: number
          status?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          current_order_value?: number | null
          id?: string
          number?: number
          status?: string
        }
        Relationships: []
      }
      school_contracts: {
        Row: {
          created_at: string
          id: string
          monthly_fee: number
          route_code: string
          school_name: string
          status: string
          student_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_fee: number
          route_code: string
          school_name: string
          status?: string
          student_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          monthly_fee?: number
          route_code?: string
          school_name?: string
          status?: string
          student_count?: number
        }
        Relationships: []
      }
      school_routes: {
        Row: {
          created_at: string
          driver_name: string
          id: string
          route_code: string
          status: string
          student_count: number
          vehicle: string
        }
        Insert: {
          created_at?: string
          driver_name: string
          id?: string
          route_code: string
          status?: string
          student_count?: number
          vehicle: string
        }
        Update: {
          created_at?: string
          driver_name?: string
          id?: string
          route_code?: string
          status?: string
          student_count?: number
          vehicle?: string
        }
        Relationships: []
      }
      sector_entries: {
        Row: {
          amount: number
          asset_id: string | null
          client_name: string | null
          cost: number
          created_at: string
          created_by: string | null
          id: string
          payment_method: string
          per_student: number | null
          sector: string
          status: string
          students: number | null
        }
        Insert: {
          amount: number
          asset_id?: string | null
          client_name?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          payment_method?: string
          per_student?: number | null
          sector: string
          status?: string
          students?: number | null
        }
        Update: {
          amount?: number
          asset_id?: string | null
          client_name?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          payment_method?: string
          per_student?: number | null
          sector?: string
          status?: string
          students?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sector_entries_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "rental_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_transfers: {
        Row: {
          amount: number
          asset_id: string | null
          created_at: string
          created_by: string | null
          expense_id: string | null
          from_sector: string
          id: string
          kind: string
          note: string | null
          parent_id: string | null
          payment_method: string
          to_sector: string
          transfer_date: string
        }
        Insert: {
          amount: number
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          from_sector: string
          id?: string
          kind?: string
          note?: string | null
          parent_id?: string | null
          payment_method?: string
          to_sector: string
          transfer_date?: string
        }
        Update: {
          amount?: number
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          from_sector?: string
          id?: string
          kind?: string
          note?: string | null
          parent_id?: string | null
          payment_method?: string
          to_sector?: string
          transfer_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_transfers_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "rental_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_transfers_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_transfers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "sector_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      staff_accounts: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          role_label: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name: string
          role_label?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          role_label?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          id: string
          sector: string
          user_id: string
        }
        Insert: {
          id?: string
          sector: string
          user_id: string
        }
        Update: {
          id?: string
          sector?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wash_queue: {
        Row: {
          car_description: string
          created_at: string
          id: string
          service_id: string | null
          status: string
          total: number
        }
        Insert: {
          car_description: string
          created_at?: string
          id?: string
          service_id?: string | null
          status?: string
          total: number
        }
        Update: {
          car_description?: string
          created_at?: string
          id?: string
          service_id?: string | null
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "wash_queue_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "wash_services"
            referencedColumns: ["id"]
          },
        ]
      }
      wash_services: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      water_products: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
          stock: number
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price: number
          stock?: number
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
          stock?: number
          unit?: string
        }
        Relationships: []
      }
      water_sales: {
        Row: {
          asset_id: string | null
          client_name: string | null
          created_at: string
          description: string | null
          id: string
          payment_method: string
          product_id: string | null
          quantity: number
          status: string
          total: number
          unit_price: number
        }
        Insert: {
          asset_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: string
          product_id?: string | null
          quantity?: number
          status?: string
          total: number
          unit_price: number
        }
        Update: {
          asset_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: string
          product_id?: string | null
          quantity?: number
          status?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "water_sales_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "rental_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "water_products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access: {
        Args: { _sector: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "tecnico"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "tecnico"],
    },
  },
} as const
