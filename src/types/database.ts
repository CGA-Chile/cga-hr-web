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
          new_bonus_task_id: string | null
          new_late: boolean | null
          new_late_notified: boolean | null
          new_left_early: boolean | null
          new_position_id: string | null
          previous_bonus_task_id: string | null
          previous_late: boolean | null
          previous_late_notified: boolean | null
          previous_left_early: boolean | null
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
          new_bonus_task_id?: string | null
          new_late?: boolean | null
          new_late_notified?: boolean | null
          new_left_early?: boolean | null
          new_position_id?: string | null
          previous_bonus_task_id?: string | null
          previous_late?: boolean | null
          previous_late_notified?: boolean | null
          previous_left_early?: boolean | null
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
          new_bonus_task_id?: string | null
          new_late?: boolean | null
          new_late_notified?: boolean | null
          new_left_early?: boolean | null
          new_position_id?: string | null
          previous_bonus_task_id?: string | null
          previous_late?: boolean | null
          previous_late_notified?: boolean | null
          previous_left_early?: boolean | null
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
            foreignKeyName: "assignment_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "bonus_task_owed_days"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "assignment_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "period_bonus_owed_days"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "assignment_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_history_new_bonus_task_id_fkey"
            columns: ["new_bonus_task_id"]
            isOneToOne: false
            referencedRelation: "bonus_tasks"
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
            foreignKeyName: "assignment_history_previous_bonus_task_id_fkey"
            columns: ["previous_bonus_task_id"]
            isOneToOne: false
            referencedRelation: "bonus_tasks"
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
          bonus_task_id: string | null
          compliance_settled_in_period_id: string | null
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          employee_id: string
          id: string
          late: boolean
          late_notified: boolean | null
          left_early: boolean
          note: string | null
          position_id: string
          production_settled_in_period_id: string | null
          settled_amount: number | null
          settled_in_period_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bonus_task_id?: string | null
          compliance_settled_in_period_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          employee_id: string
          id?: string
          late?: boolean
          late_notified?: boolean | null
          left_early?: boolean
          note?: string | null
          position_id: string
          production_settled_in_period_id?: string | null
          settled_amount?: number | null
          settled_in_period_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bonus_task_id?: string | null
          compliance_settled_in_period_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          employee_id?: string
          id?: string
          late?: boolean
          late_notified?: boolean | null
          left_early?: boolean
          note?: string | null
          position_id?: string
          production_settled_in_period_id?: string | null
          settled_amount?: number | null
          settled_in_period_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_bonus_task_id_fkey"
            columns: ["bonus_task_id"]
            isOneToOne: false
            referencedRelation: "bonus_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_compliance_settled_in_period_id_fkey"
            columns: ["compliance_settled_in_period_id"]
            isOneToOne: false
            referencedRelation: "period_bonus_owed_days"
            referencedColumns: ["origin_period_id"]
          },
          {
            foreignKeyName: "assignments_compliance_settled_in_period_id_fkey"
            columns: ["compliance_settled_in_period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "assignments_production_settled_in_period_id_fkey"
            columns: ["production_settled_in_period_id"]
            isOneToOne: false
            referencedRelation: "period_bonus_owed_days"
            referencedColumns: ["origin_period_id"]
          },
          {
            foreignKeyName: "assignments_production_settled_in_period_id_fkey"
            columns: ["production_settled_in_period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_settled_in_period_id_fkey"
            columns: ["settled_in_period_id"]
            isOneToOne: false
            referencedRelation: "period_bonus_owed_days"
            referencedColumns: ["origin_period_id"]
          },
          {
            foreignKeyName: "assignments_settled_in_period_id_fkey"
            columns: ["settled_in_period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_clockings: {
        Row: {
          clocked_at: string
          clocking_date: string | null
          created_at: string
          deleted_at: string | null
          id: string
          national_id: string
          status: string
          updated_at: string
          workera_type: number
        }
        Insert: {
          clocked_at: string
          clocking_date?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          national_id: string
          status: string
          updated_at?: string
          workera_type: number
        }
        Update: {
          clocked_at?: string
          clocking_date?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          national_id?: string
          status?: string
          updated_at?: string
          workera_type?: number
        }
        Relationships: []
      }
      attendance_reads: {
        Row: {
          created_at: string
          deleted_at: string | null
          failure: string | null
          id: string
          read_at: string
          read_date: string
          succeeded: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          failure?: string | null
          id?: string
          read_at?: string
          read_date: string
          succeeded: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          failure?: string | null
          id?: string
          read_at?: string
          read_date?: string
          succeeded?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      attendance_schedules: {
        Row: {
          created_at: string
          deleted_at: string | null
          ends_at: string
          id: string
          national_id: string
          schedule_date: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          ends_at: string
          id?: string
          national_id: string
          schedule_date: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          ends_at?: string
          id?: string
          national_id?: string
          schedule_date?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
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
          compliance_amount: number | null
          created_at: string
          daily_cap: number
          deleted_at: string | null
          effective_from: string
          effective_to: string | null
          holiday_day_rate: number | null
          id: string
          max_amount_per_person: number
          production_amount: number | null
          saturday_day_rate: number | null
          strike_deduction: number | null
          strike_limit: number | null
          sunday_day_rate: number | null
          updated_at: string
        }
        Insert: {
          compliance_amount?: number | null
          created_at?: string
          daily_cap: number
          deleted_at?: string | null
          effective_from: string
          effective_to?: string | null
          holiday_day_rate?: number | null
          id?: string
          max_amount_per_person: number
          production_amount?: number | null
          saturday_day_rate?: number | null
          strike_deduction?: number | null
          strike_limit?: number | null
          sunday_day_rate?: number | null
          updated_at?: string
        }
        Update: {
          compliance_amount?: number | null
          created_at?: string
          daily_cap?: number
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          holiday_day_rate?: number | null
          id?: string
          max_amount_per_person?: number
          production_amount?: number | null
          saturday_day_rate?: number | null
          strike_deduction?: number | null
          strike_limit?: number | null
          sunday_day_rate?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      bonus_task_rates: {
        Row: {
          amount: number
          bonus_settings_id: string
          bonus_task_id: string
          created_at: string
          deleted_at: string | null
          id: string
          updated_at: string
        }
        Insert: {
          amount: number
          bonus_settings_id: string
          bonus_task_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bonus_settings_id?: string
          bonus_task_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_task_rates_bonus_settings_id_fkey"
            columns: ["bonus_settings_id"]
            isOneToOne: false
            referencedRelation: "bonus_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_task_rates_bonus_task_id_fkey"
            columns: ["bonus_task_id"]
            isOneToOne: false
            referencedRelation: "bonus_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_task_settlements: {
        Row: {
          amount: number
          assignment_id: string
          bonus_task_id: string
          created_at: string
          date: string
          deleted_at: string | null
          employee_id: string
          id: string
          period_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          assignment_id: string
          bonus_task_id: string
          created_at?: string
          date: string
          deleted_at?: string | null
          employee_id: string
          id?: string
          period_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          assignment_id?: string
          bonus_task_id?: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          employee_id?: string
          id?: string
          period_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_task_settlements_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_task_settlements_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "bonus_task_owed_days"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "bonus_task_settlements_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "period_bonus_owed_days"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "bonus_task_settlements_bonus_task_id_fkey"
            columns: ["bonus_task_id"]
            isOneToOne: false
            referencedRelation: "bonus_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_task_settlements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_task_settlements_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "period_bonus_owed_days"
            referencedColumns: ["origin_period_id"]
          },
          {
            foreignKeyName: "bonus_task_settlements_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_tasks: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_date_history: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          calendar_date_id: string
          changed_at: string
          changed_by: string | null
          created_at: string
          date: string
          deleted_at: string | null
          id: string
          new_day_rate: number | null
          new_holiday: boolean
          previous_day_rate: number | null
          previous_holiday: boolean
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          calendar_date_id: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          date: string
          deleted_at?: string | null
          id?: string
          new_day_rate?: number | null
          new_holiday: boolean
          previous_day_rate?: number | null
          previous_holiday: boolean
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          calendar_date_id?: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          id?: string
          new_day_rate?: number | null
          new_holiday?: boolean
          previous_day_rate?: number | null
          previous_holiday?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_date_history_calendar_date_id_fkey"
            columns: ["calendar_date_id"]
            isOneToOne: false
            referencedRelation: "calendar_dates"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_dates: {
        Row: {
          created_at: string
          date: string
          day_rate: number | null
          deleted_at: string | null
          holiday: boolean
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          day_rate?: number | null
          deleted_at?: string | null
          holiday?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          day_rate?: number | null
          deleted_at?: string | null
          holiday?: boolean
          id?: string
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
            referencedRelation: "period_bonus_owed_days"
            referencedColumns: ["origin_period_id"]
          },
          {
            foreignKeyName: "cap_overrides_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
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
      period_bonus_settlements: {
        Row: {
          amount: number
          bonus: string
          created_at: string
          days: number
          deleted_at: string | null
          employee_id: string
          id: string
          origin_period_id: string
          period_id: string
          reprimanded: boolean
          strikes: number
          updated_at: string
        }
        Insert: {
          amount: number
          bonus: string
          created_at?: string
          days: number
          deleted_at?: string | null
          employee_id: string
          id?: string
          origin_period_id: string
          period_id: string
          reprimanded: boolean
          strikes: number
          updated_at?: string
        }
        Update: {
          amount?: number
          bonus?: string
          created_at?: string
          days?: number
          deleted_at?: string | null
          employee_id?: string
          id?: string
          origin_period_id?: string
          period_id?: string
          reprimanded?: boolean
          strikes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_bonus_settlements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_bonus_settlements_origin_period_id_fkey"
            columns: ["origin_period_id"]
            isOneToOne: false
            referencedRelation: "period_bonus_owed_days"
            referencedColumns: ["origin_period_id"]
          },
          {
            foreignKeyName: "period_bonus_settlements_origin_period_id_fkey"
            columns: ["origin_period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_bonus_settlements_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "period_bonus_owed_days"
            referencedColumns: ["origin_period_id"]
          },
          {
            foreignKeyName: "period_bonus_settlements_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          compliance_amount: number | null
          created_at: string
          deleted_at: string | null
          end_date: string
          id: string
          name: string
          production_amount: number | null
          start_date: string
          status: string
          strike_deduction: number | null
          strike_limit: number | null
          updated_at: string
          working_days: number | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          compliance_amount?: number | null
          created_at?: string
          deleted_at?: string | null
          end_date: string
          id?: string
          name: string
          production_amount?: number | null
          start_date: string
          status?: string
          strike_deduction?: number | null
          strike_limit?: number | null
          updated_at?: string
          working_days?: number | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          compliance_amount?: number | null
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          id?: string
          name?: string
          production_amount?: number | null
          start_date?: string
          status?: string
          strike_deduction?: number | null
          strike_limit?: number | null
          updated_at?: string
          working_days?: number | null
        }
        Relationships: []
      }
      positions: {
        Row: {
          abbreviation: string
          active: boolean
          bonus_eligible: boolean
          code: string
          compliance_bonus: boolean
          compliance_strike: boolean
          created_at: string
          deleted_at: string | null
          display_order: number
          id: string
          name: string
          production_bonus: boolean
          triggers_equal_share: boolean
          type: string
          updated_at: string
        }
        Insert: {
          abbreviation: string
          active?: boolean
          bonus_eligible?: boolean
          code: string
          compliance_bonus?: boolean
          compliance_strike?: boolean
          created_at?: string
          deleted_at?: string | null
          display_order: number
          id?: string
          name: string
          production_bonus?: boolean
          triggers_equal_share?: boolean
          type: string
          updated_at?: string
        }
        Update: {
          abbreviation?: string
          active?: boolean
          bonus_eligible?: boolean
          code?: string
          compliance_bonus?: boolean
          compliance_strike?: boolean
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          name?: string
          production_bonus?: boolean
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
      reprimands: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          employee_id: string
          id: string
          note: string | null
          period_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          employee_id: string
          id?: string
          note?: string | null
          period_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          employee_id?: string
          id?: string
          note?: string | null
          period_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reprimands_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprimands_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "period_bonus_owed_days"
            referencedColumns: ["origin_period_id"]
          },
          {
            foreignKeyName: "reprimands_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bonus_task_owed_days: {
        Row: {
          assignment_id: string | null
          bonus_task_id: string | null
          date: string | null
          employee_id: string | null
          paid_amount: number | null
        }
        Insert: {
          assignment_id?: string | null
          bonus_task_id?: string | null
          date?: string | null
          employee_id?: string | null
          paid_amount?: never
        }
        Update: {
          assignment_id?: string | null
          bonus_task_id?: string | null
          date?: string | null
          employee_id?: string | null
          paid_amount?: never
        }
        Relationships: [
          {
            foreignKeyName: "assignments_bonus_task_id_fkey"
            columns: ["bonus_task_id"]
            isOneToOne: false
            referencedRelation: "bonus_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      period_bonus_owed_days: {
        Row: {
          assignment_id: string | null
          bonus: string | null
          date: string | null
          employee_id: string | null
          late: boolean | null
          origin_period_id: string | null
          position_id: string | null
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
        ]
      }
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
          kind: string | null
          new_bonus_task_id: string | null
          new_day_rate: number | null
          new_holiday: boolean | null
          new_late: boolean | null
          new_late_notified: boolean | null
          new_left_early: boolean | null
          new_position_id: string | null
          period_id: string | null
          previous_bonus_task_id: string | null
          previous_day_rate: number | null
          previous_holiday: boolean | null
          previous_late: boolean | null
          previous_late_notified: boolean | null
          previous_left_early: boolean | null
          previous_position_id: string | null
        }
        Relationships: []
      }
      review_items: {
        Row: {
          assignment_id: string | null
          changed_at: string | null
          changed_by: string | null
          date: string | null
          employee_id: string | null
          history_id: string | null
          kind: string | null
          new_position_id: string | null
          period_id: string | null
          previous_position_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_assignment_operation: {
        Args: {
          p_bonus_task_id?: string
          p_clear_bonus_task?: boolean
          p_date: string
          p_employee_id: string
          p_late?: boolean
          p_late_notified?: boolean
          p_left_early?: boolean
          p_note?: string
          p_op_id: string
          p_position_id?: string
        }
        Returns: undefined
      }
      apply_assignment_range: {
        Args: {
          p_dates: string[]
          p_employee_id: string
          p_note?: string
          p_position_id?: string
        }
        Returns: {
          changed_date: string
          previous_bonus_task_id: string
          previous_late: boolean
          previous_late_notified: boolean
          previous_left_early: boolean
          previous_note: string
          previous_position_id: string
        }[]
      }
      close_period: {
        Args: {
          p_next_end: string
          p_next_name: string
          p_period_bonuses?: Json
          p_period_id: string
          p_settlements: Json
          p_task_settlements?: Json
        }
        Returns: undefined
      }
      create_bonus_settings_version: {
        Args: {
          p_compliance_amount?: number
          p_daily_cap: number
          p_effective_from: string
          p_holiday_day_rate: number
          p_max_amount_per_person: number
          p_production_amount?: number
          p_rates: Json
          p_saturday_day_rate: number
          p_strike_deduction?: number
          p_strike_limit?: number
          p_sunday_day_rate: number
          p_task_rates?: Json
        }
        Returns: string
      }
      create_bonus_task: {
        Args: { p_amount: number; p_name: string }
        Returns: string
      }
      record_attendance_read: {
        Args: {
          p_clockings: Json
          p_from: string
          p_schedules: Json
          p_to: string
        }
        Returns: undefined
      }
      record_attendance_read_failure: {
        Args: { p_failure: string; p_from: string; p_to: string }
        Returns: undefined
      }
      set_calendar_date: {
        Args: { p_date: string; p_day_rate?: number; p_holiday: boolean }
        Returns: undefined
      }
      set_period_end: {
        Args: { p_end_date: string; p_period_id: string }
        Returns: undefined
      }
      set_reprimand: {
        Args: {
          p_employee_id: string
          p_note?: string
          p_period_id: string
          p_reprimanded: boolean
        }
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

