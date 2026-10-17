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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          at: string
          category: string
          correlation_id: string
          details: Json
          id: number
          ip: string | null
          record_id: string | null
          record_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          at?: string
          category: string
          correlation_id?: string
          details?: Json
          id?: never
          ip?: string | null
          record_id?: string | null
          record_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          at?: string
          category?: string
          correlation_id?: string
          details?: Json
          id?: never
          ip?: string | null
          record_id?: string | null
          record_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      holidays: {
        Row: {
          applies_to: string
          created_at: string
          created_by: string | null
          dates: string[]
          deleted_at: string | null
          deleted_reason: string | null
          id: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applies_to?: string
          created_at?: string
          created_by?: string | null
          dates: string[]
          deleted_at?: string | null
          deleted_reason?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applies_to?: string
          created_at?: string
          created_by?: string | null
          dates?: string[]
          deleted_at?: string | null
          deleted_reason?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          created_by: string | null
          email_hash: string
          failed_count: number
          locked_until: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email_hash: string
          failed_count?: number
          locked_until?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email_hash?: string
          failed_count?: number
          locked_until?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      patients: {
        Row: {
          created_at: string
          created_by: string | null
          date_of_birth: string
          deleted_at: string | null
          deleted_reason: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          patient_number: number
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_of_birth: string
          deleted_at?: string | null
          deleted_reason?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          patient_number?: number
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          patient_number?: number
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string
          created_by: string | null
          group_label: string
          key: string
          label: string
          sort: number
          sublabel: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_label: string
          key: string
          label: string
          sort?: number
          sublabel?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_label?: string
          key?: string
          label?: string
          sort?: number
          sublabel?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          blocked: boolean
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          blocked?: boolean
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          permission_key: string
          role_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          permission_key: string
          role_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          permission_key?: string
          role_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          consult_mode: string
          created_at: string
          created_by: string | null
          id: string
          key: string
          landing_page: string
          name: string
          patient_scope: string
          record_visibility: string
          sort: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          consult_mode: string
          created_at?: string
          created_by?: string | null
          id?: string
          key: string
          landing_page: string
          name: string
          patient_scope?: string
          record_visibility: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          consult_mode?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key?: string
          landing_page?: string
          name?: string
          patient_scope?: string
          record_visibility?: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      setting_sections: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          key: string
          sort: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          key: string
          sort?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          key?: string
          sort?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          created_by: string | null
          help: string | null
          input_type: string
          key: string
          label: string
          options: Json
          section: string
          section_sort: number
          sort: number
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          help?: string | null
          input_type?: string
          key: string
          label: string
          options?: Json
          section: string
          section_sort?: number
          sort?: number
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          help?: string | null
          input_type?: string
          key?: string
          label?: string
          options?: Json
          section?: string
          section_sort?: number
          sort?: number
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role_key: { Args: never; Returns: string }
      has_permission: { Args: { _perm: string }; Returns: boolean }
      is_aal2: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      my_staff_context: {
        Args: never
        Returns: {
          consult_mode: string
          email: string
          full_name: string
          landing_page: string
          permissions: string[]
          role_key: string
          role_name: string
        }[]
      }
      public_app_flags: {
        Args: never
        Returns: {
          banner: string
          idle_timeout_minutes: number
          test_mode: boolean
        }[]
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
  public: {
    Enums: {},
  },
} as const
