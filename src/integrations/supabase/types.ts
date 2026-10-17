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
      equipment: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          location_id: string | null
          mobility: string
          name: string
          recurrence: string
          room_id: string | null
          sort: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          location_id?: string | null
          mobility: string
          name: string
          recurrence?: string
          room_id?: string | null
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          location_id?: string | null
          mobility?: string
          name?: string
          recurrence?: string
          room_id?: string | null
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_day_locations: {
        Row: {
          created_at: string
          created_by: string | null
          equipment_id: string
          location_id: string | null
          updated_at: string
          updated_by: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment_id: string
          location_id?: string | null
          updated_at?: string
          updated_by?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          location_id?: string | null
          updated_at?: string
          updated_by?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_day_locations_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_day_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          date_from: string
          date_to: string
          equipment_id: string
          id: string
          note: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_from: string
          date_to: string
          equipment_id: string
          id?: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_from?: string
          date_to?: string
          equipment_id?: string
          id?: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_exceptions_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
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
      languages: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          name_en: string | null
          name_nl: string
          sort: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          name_en?: string | null
          name_nl: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          name_en?: string | null
          name_nl?: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      location_exceptions: {
        Row: {
          closed: boolean
          closes: string | null
          created_at: string
          created_by: string | null
          date_from: string
          date_to: string
          id: string
          location_id: string
          note: string | null
          opens: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closed?: boolean
          closes?: string | null
          created_at?: string
          created_by?: string | null
          date_from: string
          date_to: string
          id?: string
          location_id: string
          note?: string | null
          opens?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closed?: boolean
          closes?: string | null
          created_at?: string
          created_by?: string | null
          date_from?: string
          date_to?: string
          id?: string
          location_id?: string
          note?: string | null
          opens?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_exceptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_hours: {
        Row: {
          closed: boolean
          closes: string | null
          created_at: string
          created_by: string | null
          location_id: string
          opens: string | null
          updated_at: string
          updated_by: string | null
          weekday: number
        }
        Insert: {
          closed?: boolean
          closes?: string | null
          created_at?: string
          created_by?: string | null
          location_id: string
          opens?: string | null
          updated_at?: string
          updated_by?: string | null
          weekday: number
        }
        Update: {
          closed?: boolean
          closes?: string | null
          created_at?: string
          created_by?: string | null
          location_id?: string
          opens?: string | null
          updated_at?: string
          updated_by?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "location_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          maps_url: string | null
          name: string
          phone: string | null
          postal_city: string | null
          show_new_label: boolean
          slug: string
          sort: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          maps_url?: string | null
          name: string
          phone?: string | null
          postal_city?: string | null
          show_new_label?: boolean
          slug: string
          sort?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          maps_url?: string | null
          name?: string
          phone?: string | null
          postal_city?: string | null
          show_new_label?: boolean
          slug?: string
          sort?: number
          status?: string
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
      option_lists: {
        Row: {
          created_at: string
          created_by: string | null
          label_en: string | null
          label_nl: string
          list_key: string
          sort: number
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          label_en?: string | null
          label_nl: string
          list_key: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          label_en?: string | null
          label_nl?: string
          list_key?: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
          value?: string
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
      practitioner_languages: {
        Row: {
          created_at: string
          created_by: string | null
          language_code: string
          practitioner_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          language_code: string
          practitioner_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          language_code?: string
          practitioner_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_languages_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "practitioner_languages_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_locations: {
        Row: {
          created_at: string
          created_by: string | null
          location_id: string
          practitioner_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          location_id: string
          practitioner_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          location_id?: string
          practitioner_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_locations_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key: string
          name_en: string | null
          name_nl: string
          sort: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key: string
          name_en?: string | null
          name_nl: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key?: string
          name_en?: string | null
          name_nl?: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      practitioner_treatments: {
        Row: {
          created_at: string
          created_by: string | null
          excluded_location_ids: string[]
          practitioner_id: string
          treatment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          excluded_location_ids?: string[]
          practitioner_id: string
          treatment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          excluded_location_ids?: string[]
          practitioner_id?: string
          treatment_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_treatments_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_treatments_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioners: {
        Row: {
          bio_en: string | null
          bio_nl: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          photo_path: string | null
          role_id: string
          slug: string
          sort: number
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          bio_en?: string | null
          bio_nl?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          photo_path?: string | null
          role_id: string
          slug: string
          sort?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          bio_en?: string | null
          bio_nl?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          photo_path?: string | null
          role_id?: string
          slug?: string
          sort?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practitioners_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "practitioner_roles"
            referencedColumns: ["id"]
          },
        ]
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
      rooms: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          name: string
          sort: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          name: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          name?: string
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_blocks: {
        Row: {
          created_at: string
          created_by: string | null
          ends: string
          id: string
          location_id: string
          practitioner_id: string
          recurrence: string
          starts: string
          treatment_ids: string[] | null
          updated_at: string
          updated_by: string | null
          valid_from: string
          valid_until: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends: string
          id?: string
          location_id: string
          practitioner_id: string
          recurrence?: string
          starts: string
          treatment_ids?: string[] | null
          updated_at?: string
          updated_by?: string | null
          valid_from: string
          valid_until?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends?: string
          id?: string
          location_id?: string
          practitioner_id?: string
          recurrence?: string
          starts?: string
          treatment_ids?: string[] | null
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          valid_until?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          date_from: string
          date_to: string
          ends: string | null
          existing_action: string | null
          id: string
          kind: string
          location_id: string | null
          new_bookings_action: string | null
          note: string | null
          practitioner_id: string
          starts: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_from: string
          date_to: string
          ends?: string | null
          existing_action?: string | null
          id?: string
          kind: string
          location_id?: string | null
          new_bookings_action?: string | null
          note?: string | null
          practitioner_id: string
          starts?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_from?: string
          date_to?: string
          ends?: string | null
          existing_action?: string | null
          id?: string
          kind?: string
          location_id?: string | null
          new_bookings_action?: string | null
          note?: string | null
          practitioner_id?: string
          starts?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
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
      treatment_categories: {
        Row: {
          cancel_until_hours: number | null
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          name_en: string | null
          name_nl: string
          no_show_fee_eur: number | null
          parent_id: string | null
          sort: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancel_until_hours?: number | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          name_en?: string | null
          name_nl: string
          no_show_fee_eur?: number | null
          parent_id?: string | null
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancel_until_hours?: number | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          name_en?: string | null
          name_nl?: string
          no_show_fee_eur?: number | null
          parent_id?: string | null
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "treatment_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_category_links: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          sort: number
          treatment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          sort?: number
          treatment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          sort?: number
          treatment_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_category_links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "treatment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_category_links_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_locations: {
        Row: {
          created_at: string
          created_by: string | null
          location_id: string
          treatment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          location_id: string
          treatment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          location_id?: string
          treatment_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_locations_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_practitioner_roles: {
        Row: {
          created_at: string
          created_by: string | null
          role_id: string
          treatment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role_id: string
          treatment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role_id?: string
          treatment_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_practitioner_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "practitioner_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_practitioner_roles_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_requirements: {
        Row: {
          created_at: string
          created_by: string | null
          duration: string
          equipment_kind: string | null
          id: string
          kind: string
          quantity: number
          sort: number
          treatment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration?: string
          equipment_kind?: string | null
          id?: string
          kind: string
          quantity?: number
          sort?: number
          treatment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration?: string
          equipment_kind?: string | null
          id?: string
          kind?: string
          quantity?: number
          sort?: number
          treatment_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_requirements_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          aftercare_en: string | null
          aftercare_nl: string | null
          cancel_until_hours: number | null
          created_at: string
          created_by: string | null
          description_en: string | null
          description_nl: string | null
          duration_min: number
          icon: string | null
          id: string
          name_en: string | null
          name_nl: string
          no_show_fee_eur: number | null
          post_questionnaire_key: string | null
          practitioner_choice: string
          pre_questionnaire_key: string | null
          preparation_en: string | null
          preparation_nl: string | null
          slug: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aftercare_en?: string | null
          aftercare_nl?: string | null
          cancel_until_hours?: number | null
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_nl?: string | null
          duration_min: number
          icon?: string | null
          id?: string
          name_en?: string | null
          name_nl: string
          no_show_fee_eur?: number | null
          post_questionnaire_key?: string | null
          practitioner_choice?: string
          pre_questionnaire_key?: string | null
          preparation_en?: string | null
          preparation_nl?: string | null
          slug: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aftercare_en?: string | null
          aftercare_nl?: string | null
          cancel_until_hours?: number | null
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_nl?: string | null
          duration_min?: number
          icon?: string | null
          id?: string
          name_en?: string | null
          name_nl?: string
          no_show_fee_eur?: number | null
          post_questionnaire_key?: string | null
          practitioner_choice?: string
          pre_questionnaire_key?: string | null
          preparation_en?: string | null
          preparation_nl?: string | null
          slug?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
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
