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
      anamnesis: {
        Row: {
          created_at: string
          created_by: string | null
          fields: Json
          patient_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fields?: Json
          patient_id: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fields?: Json
          patient_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_sets: {
        Row: {
          answers: Json
          appointment_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          patient_id: string
          questionnaire_key: string
          signals: Json
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          version_id: string | null
        }
        Insert: {
          answers?: Json
          appointment_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          patient_id: string
          questionnaire_key: string
          signals?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string | null
        }
        Update: {
          answers?: Json
          appointment_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          questionnaire_key?: string
          signals?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_sets_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_sets_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_sets_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          booking_link_id: string | null
          booking_reason: string | null
          cancel_reason: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          hold_expires_at: string | null
          hold_token: string | null
          id: string
          language: string
          location_id: string
          manage_token: string
          meet_link: string | null
          meet_link_created_at: string | null
          new_patient: boolean | null
          notify: string
          patient_id: string | null
          patient_note: string | null
          practitioner_id: string
          referral_source: string | null
          room_id: string | null
          source: string | null
          starts_at: string
          status: string
          tenant_id: string
          treatment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          booking_link_id?: string | null
          booking_reason?: string | null
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          hold_expires_at?: string | null
          hold_token?: string | null
          id?: string
          language?: string
          location_id: string
          manage_token?: string
          meet_link?: string | null
          meet_link_created_at?: string | null
          new_patient?: boolean | null
          notify?: string
          patient_id?: string | null
          patient_note?: string | null
          practitioner_id: string
          referral_source?: string | null
          room_id?: string | null
          source?: string | null
          starts_at: string
          status?: string
          tenant_id?: string
          treatment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          booking_link_id?: string | null
          booking_reason?: string | null
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          hold_expires_at?: string | null
          hold_token?: string | null
          id?: string
          language?: string
          location_id?: string
          manage_token?: string
          meet_link?: string | null
          meet_link_created_at?: string | null
          new_patient?: boolean | null
          notify?: string
          patient_id?: string | null
          patient_note?: string | null
          practitioner_id?: string
          referral_source?: string | null
          room_id?: string | null
          source?: string | null
          starts_at?: string
          status?: string
          tenant_id?: string
          treatment_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_booking_link"
            columns: ["tenant_id", "booking_link_id"]
            isOneToOne: false
            referencedRelation: "booking_links"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
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
          role_key: string | null
          tenant_id: string | null
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
          role_key?: string | null
          tenant_id?: string | null
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
          role_key?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          language: string
          location_ids: string[]
          name: string
          practitioner_id: string | null
          practitioner_mode: string | null
          slug: string
          sort: number
          source: string
          status: string
          tenant_id: string
          treatment_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          location_ids?: string[]
          name: string
          practitioner_id?: string | null
          practitioner_mode?: string | null
          slug: string
          sort?: number
          source?: string
          status?: string
          tenant_id?: string
          treatment_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          location_ids?: string[]
          name?: string
          practitioner_id?: string | null
          practitioner_mode?: string | null
          slug?: string
          sort?: number
          source?: string
          status?: string
          tenant_id?: string
          treatment_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_links_tenant_id_practitioner_id_fkey"
            columns: ["tenant_id", "practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "booking_links_tenant_id_treatment_id_fkey"
            columns: ["tenant_id", "treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      consult_notes: {
        Row: {
          appointment_id: string | null
          checklist: Json
          created_at: string
          created_by: string | null
          evaluation: string
          finished_at: string | null
          follow_up: string
          id: string
          kind: string
          objective: string
          occurred_at: string | null
          patient_id: string
          plan: string
          practitioner_id: string | null
          reason: string
          status: string
          subjective: string
          tenant_id: string
          time_and_duration: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          appointment_id?: string | null
          checklist?: Json
          created_at?: string
          created_by?: string | null
          evaluation?: string
          finished_at?: string | null
          follow_up?: string
          id?: string
          kind?: string
          objective?: string
          occurred_at?: string | null
          patient_id: string
          plan?: string
          practitioner_id?: string | null
          reason?: string
          status?: string
          subjective?: string
          tenant_id?: string
          time_and_duration?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          appointment_id?: string | null
          checklist?: Json
          created_at?: string
          created_by?: string | null
          evaluation?: string
          finished_at?: string | null
          follow_up?: string
          id?: string
          kind?: string
          objective?: string
          occurred_at?: string | null
          patient_id?: string
          plan?: string
          practitioner_id?: string | null
          reason?: string
          status?: string
          subjective?: string
          tenant_id?: string
          time_and_duration?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "consult_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consult_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consult_notes_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consult_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ekis_exports: {
        Row: {
          answer_sets: number
          created_at: string
          created_by: string | null
          document: Json
          error: string
          id: string
          patients: number
          ran_at: string
          status: string
          tenant_id: string
          trigger_kind: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          answer_sets?: number
          created_at?: string
          created_by?: string | null
          document?: Json
          error?: string
          id?: string
          patients?: number
          ran_at?: string
          status?: string
          tenant_id?: string
          trigger_kind?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          answer_sets?: number
          created_at?: string
          created_by?: string | null
          document?: Json
          error?: string
          id?: string
          patients?: number
          ran_at?: string
          status?: string
          tenant_id?: string
          trigger_kind?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ekis_exports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          location_id: string | null
          maintenance_interval_months: number | null
          mobility: string
          name: string
          next_maintenance_on: string | null
          placement: string
          recurrence: string
          room_id: string | null
          sort: number
          status: string
          tenant_id: string
          type_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          location_id?: string | null
          maintenance_interval_months?: number | null
          mobility: string
          name: string
          next_maintenance_on?: string | null
          placement?: string
          recurrence?: string
          room_id?: string | null
          sort?: number
          status?: string
          tenant_id?: string
          type_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          location_id?: string | null
          maintenance_interval_months?: number | null
          mobility?: string
          name?: string
          next_maintenance_on?: string | null
          placement?: string
          recurrence?: string
          room_id?: string | null
          sort?: number
          status?: string
          tenant_id?: string
          type_id?: string | null
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
          {
            foreignKeyName: "equipment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
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
          tenant_id: string
          updated_at: string
          updated_by: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment_id: string
          location_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          location_id?: string | null
          tenant_id?: string
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
          {
            foreignKeyName: "equipment_day_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "equipment_exceptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_kinds: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key: string
          name: string
          parent_id: string | null
          sort: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key: string
          name: string
          parent_id?: string | null
          sort?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key?: string
          name?: string
          parent_id?: string | null
          sort?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_kinds_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "equipment_kinds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_kinds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_schedule: {
        Row: {
          created_at: string
          created_by: string | null
          equipment_id: string
          location_id: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment_id: string
          location_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          location_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_schedule_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_schedule_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_schedule_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_types: {
        Row: {
          brand: string
          created_at: string
          created_by: string | null
          id: string
          kind_id: string
          tenant_id: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind_id: string
          tenant_id?: string
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind_id?: string
          tenant_id?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_types_kind_id_fkey"
            columns: ["kind_id"]
            isOneToOne: false
            referencedRelation: "equipment_kinds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_admins: {
        Row: {
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      group_settings: {
        Row: {
          created_at: string
          created_by: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "location_exceptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "location_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      mail_outbox: {
        Row: {
          appointment_id: string | null
          created_at: string
          dedupe_key: string | null
          error: string | null
          html: string
          id: string
          moment: string
          patient_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
          tenant_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          html: string
          id?: string
          moment: string
          patient_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          tenant_id?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          html?: string
          id?: string
          moment?: string
          patient_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_outbox_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_outbox_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_outbox_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "mail_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_templates: {
        Row: {
          blocks: Json
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          moment: string
          name: string
          scope: string
          sort: number
          status: string
          subject_en: string
          subject_nl: string
          tenant_id: string
          treatment_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          blocks?: Json
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          moment: string
          name: string
          scope?: string
          sort?: number
          status?: string
          subject_en?: string
          subject_nl?: string
          tenant_id?: string
          treatment_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          blocks?: Json
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          moment?: string
          name?: string
          scope?: string
          sort?: number
          status?: string
          subject_en?: string
          subject_nl?: string
          tenant_id?: string
          treatment_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mail_templates_tenant_id_category_id_fkey"
            columns: ["tenant_id", "category_id"]
            isOneToOne: false
            referencedRelation: "treatment_categories"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "mail_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_templates_tenant_id_treatment_id_fkey"
            columns: ["tenant_id", "treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      measurements: {
        Row: {
          appointment_id: string | null
          bp_diastolic: number | null
          bp_systolic: number | null
          created_at: string
          created_by: string | null
          height_cm: number | null
          id: string
          measured_on: string
          patient_id: string
          pulse: number | null
          source: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          appointment_id?: string | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          created_at?: string
          created_by?: string | null
          height_cm?: number | null
          id?: string
          measured_on: string
          patient_id: string
          pulse?: number | null
          source?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          appointment_id?: string | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          created_at?: string
          created_by?: string | null
          height_cm?: number | null
          id?: string
          measured_on?: string
          patient_id?: string
          pulse?: number | null
          source?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "measurements_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      patient_consents: {
        Row: {
          appointment_id: string | null
          created_at: string
          granted: boolean
          id: string
          kind: string
          patient_id: string
          tenant_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          granted: boolean
          id?: string
          kind: string
          patient_id: string
          tenant_id?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          granted?: boolean
          id?: string
          kind?: string
          patient_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_consents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          patient_id: string
          source: string
          storage_path: string | null
          tenant_id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          patient_id: string
          source?: string
          storage_path?: string | null
          tenant_id?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          patient_id?: string
          source?: string
          storage_path?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string
          deleted_at: string | null
          deleted_reason: string | null
          email: string
          first_name: string
          gp_name: string | null
          house_number: string | null
          house_suffix: string | null
          id: string
          last_name: string
          patient_number: number
          phone: string | null
          phone_country: string | null
          postcode: string | null
          salutation: string | null
          street: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth: string
          deleted_at?: string | null
          deleted_reason?: string | null
          email: string
          first_name: string
          gp_name?: string | null
          house_number?: string | null
          house_suffix?: string | null
          id?: string
          last_name: string
          patient_number?: number
          phone?: string | null
          phone_country?: string | null
          postcode?: string | null
          salutation?: string | null
          street?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          email?: string
          first_name?: string
          gp_name?: string | null
          house_number?: string | null
          house_suffix?: string | null
          id?: string
          last_name?: string
          patient_number?: number
          phone?: string | null
          phone_country?: string | null
          postcode?: string | null
          salutation?: string | null
          street?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          language_code: string
          practitioner_id: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          language_code?: string
          practitioner_id?: string
          tenant_id?: string
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
          {
            foreignKeyName: "practitioner_languages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          location_id: string
          practitioner_id: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          location_id?: string
          practitioner_id?: string
          tenant_id?: string
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
          {
            foreignKeyName: "practitioner_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_treatments: {
        Row: {
          created_at: string
          created_by: string | null
          excluded_location_ids: string[]
          practitioner_id: string
          tenant_id: string
          treatment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          excluded_location_ids?: string[]
          practitioner_id: string
          tenant_id?: string
          treatment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          excluded_location_ids?: string[]
          practitioner_id?: string
          tenant_id?: string
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
            foreignKeyName: "practitioner_treatments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "practitioners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      questionnaire_flows: {
        Row: {
          created_at: string
          created_by: string | null
          document: Json
          id: string
          key: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document?: Json
          id?: string
          key: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document?: Json
          id?: string
          key?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_flows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_versions: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          note: string | null
          published_at: string | null
          published_by: string | null
          questionnaire_id: string
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          version_no: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition: Json
          id?: string
          note?: string | null
          published_at?: string | null
          published_by?: string | null
          questionnaire_id: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version_no: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          note?: string | null
          published_at?: string | null
          published_by?: string | null
          questionnaire_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_versions_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaires: {
        Row: {
          created_at: string
          created_by: string | null
          flow_id: string
          id: string
          key: string
          moment: string
          name: string
          sort: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          flow_id: string
          id?: string
          key: string
          moment: string
          name: string
          sort?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          flow_id?: string
          id?: string
          key?: string
          moment?: string
          name?: string
          sort?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaires_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaires_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          permission_key: string
          role_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          permission_key: string
          role_id: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          permission_key?: string
          role_id?: string
          tenant_id?: string
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
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          name: string
          purpose: string
          sort: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          name: string
          purpose?: string
          sort?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          name?: string
          purpose?: string
          sort?: number
          tenant_id?: string
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
          {
            foreignKeyName: "rooms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_blocks: {
        Row: {
          allows_online: boolean
          created_at: string
          created_by: string | null
          ends: string
          id: string
          location_id: string
          practitioner_id: string
          recurrence: string
          starts: string
          tenant_id: string
          treatment_ids: string[] | null
          updated_at: string
          updated_by: string | null
          valid_from: string
          valid_until: string | null
          weekday: number
        }
        Insert: {
          allows_online?: boolean
          created_at?: string
          created_by?: string | null
          ends: string
          id?: string
          location_id: string
          practitioner_id: string
          recurrence?: string
          starts: string
          tenant_id?: string
          treatment_ids?: string[] | null
          updated_at?: string
          updated_by?: string | null
          valid_from: string
          valid_until?: string | null
          weekday: number
        }
        Update: {
          allows_online?: boolean
          created_at?: string
          created_by?: string | null
          ends?: string
          id?: string
          location_id?: string
          practitioner_id?: string
          recurrence?: string
          starts?: string
          tenant_id?: string
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
          {
            foreignKeyName: "schedule_blocks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "schedule_exceptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stats_requests: {
        Row: {
          created_at: string
          created_by: string | null
          endpoint: string
          id: string
          ok: boolean
          requested_at: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          endpoint?: string
          id?: string
          ok?: boolean
          requested_at?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          endpoint?: string
          id?: string
          ok?: boolean
          requested_at?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stats_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          role_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          role_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          role_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          booking_domains: string[]
          country: string
          created_at: string
          created_by: string | null
          currency: string
          default_language: string
          display_name: string
          ekis_export_enabled: boolean
          extra_languages: string[]
          feature_flags: Json
          google_meet_account: string | null
          id: string
          legal: Json
          mail_reply_to: string | null
          mail_sender: string | null
          mail_sender_verified: boolean
          processors: Json
          slug: string
          sort: number
          stats_key_hash: string | null
          test_mode: boolean
          theme: Json
          time_zone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          booking_domains?: string[]
          country: string
          created_at?: string
          created_by?: string | null
          currency?: string
          default_language?: string
          display_name: string
          ekis_export_enabled?: boolean
          extra_languages?: string[]
          feature_flags?: Json
          google_meet_account?: string | null
          id?: string
          legal?: Json
          mail_reply_to?: string | null
          mail_sender?: string | null
          mail_sender_verified?: boolean
          processors?: Json
          slug: string
          sort?: number
          stats_key_hash?: string | null
          test_mode?: boolean
          theme?: Json
          time_zone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          booking_domains?: string[]
          country?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          default_language?: string
          display_name?: string
          ekis_export_enabled?: boolean
          extra_languages?: string[]
          feature_flags?: Json
          google_meet_account?: string | null
          id?: string
          legal?: Json
          mail_reply_to?: string | null
          mail_sender?: string | null
          mail_sender_verified?: boolean
          processors?: Json
          slug?: string
          sort?: number
          stats_key_hash?: string | null
          test_mode?: boolean
          theme?: Json
          time_zone?: string
          updated_at?: string
          updated_by?: string | null
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
          mail_image_path: string | null
          name_en: string | null
          name_nl: string
          no_show_fee_eur: number | null
          parent_id: string | null
          sort: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancel_until_hours?: number | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          mail_image_path?: string | null
          name_en?: string | null
          name_nl: string
          no_show_fee_eur?: number | null
          parent_id?: string | null
          sort?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancel_until_hours?: number | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          mail_image_path?: string | null
          name_en?: string | null
          name_nl?: string
          no_show_fee_eur?: number | null
          parent_id?: string | null
          sort?: number
          tenant_id?: string
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
          {
            foreignKeyName: "treatment_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
          treatment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          sort?: number
          tenant_id?: string
          treatment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          sort?: number
          tenant_id?: string
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
            foreignKeyName: "treatment_category_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
          treatment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          location_id: string
          tenant_id?: string
          treatment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          location_id?: string
          tenant_id?: string
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
            foreignKeyName: "treatment_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      treatment_plans: {
        Row: {
          created_at: string
          created_by: string | null
          fields: Json
          patient_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fields?: Json
          patient_id: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fields?: Json
          patient_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_practitioner_roles: {
        Row: {
          created_at: string
          created_by: string | null
          role_id: string
          tenant_id: string
          treatment_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role_id: string
          tenant_id?: string
          treatment_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role_id?: string
          tenant_id?: string
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
            foreignKeyName: "treatment_practitioner_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          treatment_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_requirements_kind_fk"
            columns: ["tenant_id", "equipment_kind"]
            isOneToOne: false
            referencedRelation: "equipment_kinds"
            referencedColumns: ["tenant_id", "key"]
          },
          {
            foreignKeyName: "treatment_requirements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      triage_rejection_counts: {
        Row: {
          count: number
          day: string
          questionnaire_key: string
          reason: string
          tenant_id: string
        }
        Insert: {
          count?: number
          day: string
          questionnaire_key: string
          reason: string
          tenant_id?: string
        }
        Update: {
          count?: number
          day?: string
          questionnaire_key?: string
          reason?: string
          tenant_id?: string
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
      count_triage_rejection: {
        Args: { _questionnaire: string; _reason: string; _tenant: string }
        Returns: undefined
      }
      current_role_key: { Args: never; Returns: string }
      current_tenant: { Args: never; Returns: string }
      current_tenant_slug: { Args: never; Returns: string }
      has_permission: { Args: { _perm: string }; Returns: boolean }
      is_aal2: { Args: never; Returns: boolean }
      is_group_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      mfa_required: { Args: never; Returns: boolean }
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
      my_tenants: {
        Args: never
        Returns: {
          active: boolean
          display_name: string
          role_name: string
          slug: string
          tenant_id: string
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
      resolve_tenant_by_host: {
        Args: { _host: string }
        Returns: {
          default_language: string
          display_name: string
          extra_languages: string[]
          slug: string
          theme: Json
        }[]
      }
      staff_names: {
        Args: { _ids: string[] }
        Returns: {
          full_name: string
          id: string
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
