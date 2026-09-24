export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      applied_operations: {
        Row: {
          applied_at: string
          applied_by: string | null
          created_at: string
          deleted_at: string | null
          id: string
          op_id: string
          updated_at: string
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          op_id: string
          updated_at?: string
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          op_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      assignment_history: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assignment_id: string
          changed_at: string
          changed_by: string | null
          created_at: string
          date: string
          deleted_at: string | null
          employee_id: string
          id: string
          new_position_id: string | null
          previous_position_id: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assignment_id: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          date: string
          deleted_at?: string | null
          employee_id: string
          id?: string
          new_position_id?: string | null
          previous_position_id?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assignment_id?: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          employee_id?: string
          id?: string
          new_position_id?: string | null
          previous_position_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_history_new_position_id_fkey"
            columns: ["new_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_history_previous_position_id_fkey"
            columns: ["previous_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          employee_id: string
          id: string
          note: string | null
          position_id: string
          settled_amount: number | null
          settled_in_period_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          employee_id: string
          id?: string
          note?: string | null
          position_id: string
          settled_amount?: number | null
          settled_in_period_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          employee_id?: string
          id?: string
          note?: string | null
          position_id?: string
          settled_amount?: number | null
          settled_in_period_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_settled_in_period_id_fkey"
            columns: ["settled_in_period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_settled_in_period_id_fkey"
            columns: ["settled_in_period_id"]
            isOneToOne: false
            referencedRelation: "review_history"
            referencedColumns: ["period_id"]
          },
          {
            foreignKeyName: "assignments_settled_in_period_id_fkey"
            columns: ["settled_in_period_id"]
            isOneToOne: false
            referencedRelation: "review_items"
            referencedColumns: ["period_id"]
          },
        ]
      }
      bonus_position_rates: {
        Row: {
          amount: number
          bonus_settings_id: string
          created_at: string
          deleted_at: string | null
          id: string
          position_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          bonus_settings_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          position_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bonus_settings_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          position_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_position_rates_bonus_settings_id_fkey"
            columns: ["bonus_settings_id"]
            isOneToOne: false
            referencedRelation: "bonus_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_position_rates_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_settings: {
        Row: {
          created_at: string
          daily_cap: number
          deleted_at: string | null
          effective_from: string
          effective_to: string | null
          id: string
          max_amount_per_person: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_cap: number
          deleted_at?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          max_amount_per_person: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_cap?: number
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          max_amount_per_person?: number
          updated_at?: string
        }
        Relationships: []
      }
      cap_overrides: {
        Row: {
          approved_amount: number
          approved_at: string
          approved_by: string | null
          created_at: string
          daily_cap: number
          date: string
          deleted_at: string | null
          id: string
          note: string | null
          period_id: string
          updated_at: string
        }
        Insert: {
          approved_amount: number
          approved_at?: string
          approved_by?: string | null
          created_at?: string
          daily_cap: number
          date: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          period_id: string
          updated_at?: string
        }
        Update: {
          approved_amount?: number
          approved_at?: string
          approved_by?: string | null
          created_at?: string
          daily_cap?: number
          date?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          period_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cap_overrides_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cap_overrides_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "review_history"
            referencedColumns: ["period_id"]
          },
          {
            foreignKeyName: "cap_overrides_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "review_items"
            referencedColumns: ["period_id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          first_name: string
          id: string
          last_name: string
          national_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          first_name: string
          id?: string
          last_name: string
          national_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          national_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          deleted_at: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          active: boolean
          bonus_eligible: boolean
          code: string
          created_at: string
          deleted_at: string | null
          display_order: number
          id: string
          name: string
          triggers_equal_share: boolean
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bonus_eligible?: boolean
          code: string
          created_at?: string
          deleted_at?: string | null
          display_order: number
          id?: string
          name: string
          triggers_equal_share?: boolean
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bonus_eligible?: boolean
          code?: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          name?: string
          triggers_equal_share?: boolean
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          role: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          role: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          role?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      review_history: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assignment_id: string | null
          changed_at: string | null
          changed_by: string | null
          date: string | null
          employee_id: string | null
          history_id: string | null
          new_position_id: string | null
          period_id: string | null
          previous_position_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_history_new_position_id_fkey"
            columns: ["new_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_history_previous_position_id_fkey"
            columns: ["previous_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_items: {
        Row: {
          assignment_id: string | null
          changed_at: string | null
          changed_by: string | null
          date: string | null
          employee_id: string | null
          history_id: string | null
          new_position_id: string | null
          period_id: string | null
          previous_position_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_history_new_position_id_fkey"
            columns: ["new_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_history_previous_position_id_fkey"
            columns: ["previous_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_assignment_operation: {
        Args: {
          p_date: string
          p_employee_id: string
          p_note?: string
          p_op_id: string
          p_position_id?: string
        }
        Returns: undefined
      }
      close_period: {
        Args: { p_period_id: string; p_settlements: Json }
        Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

