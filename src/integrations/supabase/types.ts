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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      infrastructures: {
        Row: {
          architecture: string | null
          capabilities: Json | null
          cpu_cores: number | null
          created_at: string
          created_by: string | null
          disk_gb: number | null
          distribution: string | null
          id: string
          name: string
          notes: string | null
          os: string | null
          ram_gb: number | null
          type: Database["public"]["Enums"]["infra_type"]
          updated_at: string
        }
        Insert: {
          architecture?: string | null
          capabilities?: Json | null
          cpu_cores?: number | null
          created_at?: string
          created_by?: string | null
          disk_gb?: number | null
          distribution?: string | null
          id?: string
          name: string
          notes?: string | null
          os?: string | null
          ram_gb?: number | null
          type?: Database["public"]["Enums"]["infra_type"]
          updated_at?: string
        }
        Update: {
          architecture?: string | null
          capabilities?: Json | null
          cpu_cores?: number | null
          created_at?: string
          created_by?: string | null
          disk_gb?: number | null
          distribution?: string | null
          id?: string
          name?: string
          notes?: string | null
          os?: string | null
          ram_gb?: number | null
          type?: Database["public"]["Enums"]["infra_type"]
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          category: Database["public"]["Enums"]["order_category"]
          command: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          error_message: string | null
          id: string
          infrastructure_id: string | null
          name: string
          progress: number | null
          result: Json | null
          runner_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["order_category"]
          command: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          infrastructure_id?: string | null
          name: string
          progress?: number | null
          result?: Json | null
          runner_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["order_category"]
          command?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          infrastructure_id?: string | null
          name?: string
          progress?: number | null
          result?: Json | null
          runner_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_infrastructure_id_fkey"
            columns: ["infrastructure_id"]
            isOneToOne: false
            referencedRelation: "infrastructures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_logs: {
        Row: {
          created_at: string
          error_details: string | null
          event_type: string
          id: string
          level: string
          message: string
          parsed_data: Json | null
          raw_body: string | null
          runner_id: string | null
          timestamp: string
        }
        Insert: {
          created_at?: string
          error_details?: string | null
          event_type: string
          id?: string
          level?: string
          message: string
          parsed_data?: Json | null
          raw_body?: string | null
          runner_id?: string | null
          timestamp?: string
        }
        Update: {
          created_at?: string
          error_details?: string | null
          event_type?: string
          id?: string
          level?: string
          message?: string
          parsed_data?: Json | null
          raw_body?: string | null
          runner_id?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "runner_logs_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
        ]
      }
      runners: {
        Row: {
          capabilities: Json | null
          created_at: string
          created_by: string | null
          host_info: Json | null
          id: string
          infrastructure_id: string | null
          last_seen_at: string | null
          name: string
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          capabilities?: Json | null
          created_at?: string
          created_by?: string | null
          host_info?: Json | null
          id?: string
          infrastructure_id?: string | null
          last_seen_at?: string | null
          name: string
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          capabilities?: Json | null
          created_at?: string
          created_by?: string | null
          host_info?: Json | null
          id?: string
          infrastructure_id?: string | null
          last_seen_at?: string | null
          name?: string
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "runners_infrastructure_id_fkey"
            columns: ["infrastructure_id"]
            isOneToOne: false
            referencedRelation: "infrastructures"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      infra_type: "vps" | "bare_metal" | "cloud"
      order_category:
        | "installation"
        | "update"
        | "security"
        | "maintenance"
        | "detection"
      order_status: "pending" | "running" | "completed" | "failed" | "cancelled"
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
    Enums: {
      infra_type: ["vps", "bare_metal", "cloud"],
      order_category: [
        "installation",
        "update",
        "security",
        "maintenance",
        "detection",
      ],
      order_status: ["pending", "running", "completed", "failed", "cancelled"],
    },
  },
} as const
