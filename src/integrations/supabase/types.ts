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
      allocations: {
        Row: {
          actual_return: string | null
          checkout_date: string
          created_at: string
          driver_id: string
          expected_return: string | null
          id: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          actual_return?: string | null
          checkout_date?: string
          created_at?: string
          driver_id: string
          expected_return?: string | null
          id?: string
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          actual_return?: string | null
          checkout_date?: string
          created_at?: string
          driver_id?: string
          expected_return?: string | null
          id?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      departures: {
        Row: {
          created_at: string
          date: string
          departed: boolean
          departure_time: string | null
          id: string
          no_departure_reason: string | null
          supervisor_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string
          departed?: boolean
          departure_time?: string | null
          id?: string
          no_departure_reason?: string | null
          supervisor_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          departed?: boolean
          departure_time?: string | null
          id?: string
          no_departure_reason?: string | null
          supervisor_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departures_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          contato: string | null
          created_at: string
          funcao: string
          id: string
          matricula: string
          name: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          contato?: string | null
          created_at?: string
          funcao: string
          id?: string
          matricula: string
          name: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          contato?: string | null
          created_at?: string
          funcao?: string
          id?: string
          matricula?: string
          name?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          attachment_url: string | null
          created_at: string
          date: string
          description: string
          driver_id: string | null
          id: string
          severity: Database["public"]["Enums"]["incident_severity"]
          type: Database["public"]["Enums"]["incident_type"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          date?: string
          description: string
          driver_id?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["incident_severity"]
          type: Database["public"]["Enums"]["incident_type"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          date?: string
          description?: string
          driver_id?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["incident_severity"]
          type?: Database["public"]["Enums"]["incident_type"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          completed_date: string | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          proof_url: string | null
          scheduled_date: string | null
          scheduled_km: number | null
          status: Database["public"]["Enums"]["maintenance_status"]
          type: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          proof_url?: string | null
          scheduled_date?: string | null
          scheduled_km?: number | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          type: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          proof_url?: string | null
          scheduled_date?: string | null
          scheduled_km?: number | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          type?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      supervisor_teams: {
        Row: {
          created_at: string
          id: string
          supervisor_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          supervisor_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          supervisor_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_schedules: {
        Row: {
          created_at: string
          date: string
          id: string
          is_working: boolean
          observation: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_working?: boolean
          observation?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_working?: boolean
          observation?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_schedules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          cost_center: string | null
          created_at: string
          has_basket: boolean
          id: string
          name: string
          type: Database["public"]["Enums"]["team_type"]
          updated_at: string
        }
        Insert: {
          cost_center?: string | null
          created_at?: string
          has_basket?: boolean
          id?: string
          name: string
          type: Database["public"]["Enums"]["team_type"]
          updated_at?: string
        }
        Update: {
          cost_center?: string | null
          created_at?: string
          has_basket?: boolean
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["team_type"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string
          id: string
          model: string
          plate: string
          status: Database["public"]["Enums"]["vehicle_status"]
          team_id: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          model: string
          plate: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          team_id?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          plate?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          team_id?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_entries: {
        Row: {
          created_at: string
          entry_date: string
          exit_date: string | null
          id: string
          notes: string | null
          reason: string
          status: Database["public"]["Enums"]["maintenance_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          entry_date?: string
          exit_date?: string | null
          id?: string
          notes?: string | null
          reason: string
          status?: Database["public"]["Enums"]["maintenance_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          exit_date?: string | null
          id?: string
          notes?: string | null
          reason?: string
          status?: Database["public"]["Enums"]["maintenance_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      get_email_by_username: { Args: { _username: string }; Returns: string }
      get_user_team_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supervisor"
      incident_severity: "baixa" | "media" | "alta" | "critica"
      incident_type: "multa" | "acidente" | "incidente" | "observacao"
      maintenance_status: "pendente" | "em_andamento" | "concluida"
      team_type: "linha_viva" | "linha_morta" | "poda" | "linha_morta_obras"
      vehicle_status:
        | "ativo"
        | "manutencao"
        | "reserva"
        | "oficina"
        | "mobilizar"
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
      app_role: ["admin", "supervisor"],
      incident_severity: ["baixa", "media", "alta", "critica"],
      incident_type: ["multa", "acidente", "incidente", "observacao"],
      maintenance_status: ["pendente", "em_andamento", "concluida"],
      team_type: ["linha_viva", "linha_morta", "poda", "linha_morta_obras"],
      vehicle_status: [
        "ativo",
        "manutencao",
        "reserva",
        "oficina",
        "mobilizar",
      ],
    },
  },
} as const
