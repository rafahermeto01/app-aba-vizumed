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
      cid_codes: {
        Row: {
          clinic_id: string | null
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          id: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description: string
          id?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cid_codes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          logo_path: string | null
          name: string
          show_initials_only: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          logo_path?: string | null
          name: string
          show_initials_only?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          show_initials_only?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          accepted_at: string
          clinic_id: string
          consent_text: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          guardian_id: string | null
          id: string
          learner_id: string
          registered_by: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string
          clinic_id: string
          consent_text: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          guardian_id?: string | null
          id?: string
          learner_id: string
          registered_by?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string
          clinic_id?: string
          consent_text?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          guardian_id?: string | null
          id?: string
          learner_id?: string
          registered_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          learner_id: string
          name: string
          phone: string | null
          relationship: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          learner_id: string
          name: string
          phone?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          learner_id?: string
          name?: string
          phone?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_cids: {
        Row: {
          cid_code_id: string
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          learner_id: string
          updated_at: string
        }
        Insert: {
          cid_code_id: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          learner_id: string
          updated_at?: string
        }
        Update: {
          cid_code_id?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          learner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_cids_cid_code_id_fkey"
            columns: ["cid_code_id"]
            isOneToOne: false
            referencedRelation: "cid_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_cids_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_cids_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_cids_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_programs: {
        Row: {
          category_name: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          goal: Database["public"]["Enums"]["program_goal"]
          id: string
          learner_id: string
          mastery_min_pct: number
          mastery_min_trials: number
          mastery_sessions: number
          measure_type: Database["public"]["Enums"]["measure_type"]
          name: string
          objective: string | null
          procedure: string | null
          protocol: Database["public"]["Enums"]["protocol"] | null
          protocol_other: string | null
          sort_order: number
          status: Database["public"]["Enums"]["program_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          category_name?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          goal?: Database["public"]["Enums"]["program_goal"]
          id?: string
          learner_id: string
          mastery_min_pct?: number
          mastery_min_trials?: number
          mastery_sessions?: number
          measure_type?: Database["public"]["Enums"]["measure_type"]
          name: string
          objective?: string | null
          procedure?: string | null
          protocol?: Database["public"]["Enums"]["protocol"] | null
          protocol_other?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["program_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          category_name?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          goal?: Database["public"]["Enums"]["program_goal"]
          id?: string
          learner_id?: string
          mastery_min_pct?: number
          mastery_min_trials?: number
          mastery_sessions?: number
          measure_type?: Database["public"]["Enums"]["measure_type"]
          name?: string
          objective?: string | null
          procedure?: string | null
          protocol?: Database["public"]["Enums"]["protocol"] | null
          protocol_other?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["program_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_programs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_programs_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_programs_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_programs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_team: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          learner_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          learner_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          learner_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_team_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_team_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_team_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_team_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learners: {
        Row: {
          active: boolean
          birth_date: string | null
          clinic_id: string
          cpf: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          full_name: string
          id: string
          initials: string
          last_session_number: number
          notes: string | null
          photo_path: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          birth_date?: string | null
          clinic_id: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          full_name: string
          id?: string
          initials?: string
          last_session_number?: number
          notes?: string | null
          photo_path?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          birth_date?: string | null
          clinic_id?: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          full_name?: string
          id?: string
          initials?: string
          last_session_number?: number
          notes?: string | null
          photo_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learners_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_programs: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          learner_program_id: string
          playlist_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          learner_program_id: string
          playlist_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          learner_program_id?: string
          playlist_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_programs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_programs_learner_program_id_fkey"
            columns: ["learner_program_id"]
            isOneToOne: false
            referencedRelation: "learner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_programs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          learner_id: string
          name: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          learner_id: string
          name: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          learner_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlists_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlists_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          must_change_password: boolean
          photo_path: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email: string
          full_name: string
          id: string
          must_change_password?: boolean
          photo_path?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean
          photo_path?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      program_categories: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      program_templates: {
        Row: {
          category_id: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          goal: Database["public"]["Enums"]["program_goal"]
          id: string
          mastery_min_pct: number
          mastery_min_trials: number
          mastery_sessions: number
          measure_type: Database["public"]["Enums"]["measure_type"]
          name: string
          objective: string | null
          procedure: string | null
          protocol: Database["public"]["Enums"]["protocol"] | null
          protocol_other: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          goal?: Database["public"]["Enums"]["program_goal"]
          id?: string
          mastery_min_pct?: number
          mastery_min_trials?: number
          mastery_sessions?: number
          measure_type?: Database["public"]["Enums"]["measure_type"]
          name: string
          objective?: string | null
          procedure?: string | null
          protocol?: Database["public"]["Enums"]["protocol"] | null
          protocol_other?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          goal?: Database["public"]["Enums"]["program_goal"]
          id?: string
          mastery_min_pct?: number
          mastery_min_trials?: number
          mastery_sessions?: number
          measure_type?: Database["public"]["Enums"]["measure_type"]
          name?: string
          objective?: string | null
          procedure?: string | null
          protocol?: Database["public"]["Enums"]["protocol"] | null
          protocol_other?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "program_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_levels: {
        Row: {
          abbreviation: string
          clinic_id: string
          color: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_independent: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          abbreviation: string
          clinic_id: string
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_independent?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          abbreviation?: string
          clinic_id?: string
          color?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_independent?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_levels_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      session_audit: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          learner_id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          session_id: string
          table_name: string
          updated_at: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          learner_id: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          session_id: string
          table_name: string
          updated_at?: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          learner_id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          session_id?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_audit_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_audit_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_audit_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_audit_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_audit_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_programs: {
        Row: {
          client_id: string
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          learner_program_id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          learner_program_id: string
          session_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          learner_program_id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_programs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_programs_learner_program_id_fkey"
            columns: ["learner_program_id"]
            isOneToOne: false
            referencedRelation: "learner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_programs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_programs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          applicator_id: string
          applicator_signature_path: string | null
          client_id: string
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          learner_id: string
          notes: string | null
          number: number | null
          rating: number | null
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          supervisor_signature_path: string | null
          supervisor_signed_by: string | null
          updated_at: string
        }
        Insert: {
          applicator_id?: string
          applicator_signature_path?: string | null
          client_id: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          learner_id: string
          notes?: string | null
          number?: number | null
          rating?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          supervisor_signature_path?: string | null
          supervisor_signed_by?: string | null
          updated_at?: string
        }
        Update: {
          applicator_id?: string
          applicator_signature_path?: string | null
          client_id?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          learner_id?: string
          notes?: string | null
          number?: number | null
          rating?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          supervisor_signature_path?: string | null
          supervisor_signed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_applicator_id_fkey"
            columns: ["applicator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_supervisor_signed_by_fkey"
            columns: ["supervisor_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      target_prompt_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          from_level_id: string | null
          id: string
          learner_id: string
          target_id: string
          to_level_id: string | null
          updated_at: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_level_id?: string | null
          id?: string
          learner_id: string
          target_id: string
          to_level_id?: string | null
          updated_at?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_level_id?: string | null
          id?: string
          learner_id?: string
          target_id?: string
          to_level_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_prompt_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_prompt_history_from_level_id_fkey"
            columns: ["from_level_id"]
            isOneToOne: false
            referencedRelation: "prompt_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_prompt_history_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_prompt_history_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_prompt_history_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "target_mastery"
            referencedColumns: ["target_id"]
          },
          {
            foreignKeyName: "target_prompt_history_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_prompt_history_to_level_id_fkey"
            columns: ["to_level_id"]
            isOneToOne: false
            referencedRelation: "prompt_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      target_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          from_status: Database["public"]["Enums"]["target_status"] | null
          id: string
          learner_id: string
          target_id: string
          to_status: Database["public"]["Enums"]["target_status"]
          updated_at: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_status?: Database["public"]["Enums"]["target_status"] | null
          id?: string
          learner_id: string
          target_id: string
          to_status: Database["public"]["Enums"]["target_status"]
          updated_at?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_status?: Database["public"]["Enums"]["target_status"] | null
          id?: string
          learner_id?: string
          target_id?: string
          to_status?: Database["public"]["Enums"]["target_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_status_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_status_history_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_status_history_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_status_history_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "target_mastery"
            referencedColumns: ["target_id"]
          },
          {
            foreignKeyName: "target_status_history_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
      targets: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          current_prompt_level_id: string | null
          deleted_at: string | null
          id: string
          learner_id: string
          learner_program_id: string
          maintenance_interval_days: number | null
          mastered_at: string | null
          name: string
          next_maintenance_date: string | null
          queue_position: number
          status: Database["public"]["Enums"]["target_status"]
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          current_prompt_level_id?: string | null
          deleted_at?: string | null
          id?: string
          learner_id: string
          learner_program_id: string
          maintenance_interval_days?: number | null
          mastered_at?: string | null
          name: string
          next_maintenance_date?: string | null
          queue_position?: number
          status?: Database["public"]["Enums"]["target_status"]
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          current_prompt_level_id?: string | null
          deleted_at?: string | null
          id?: string
          learner_id?: string
          learner_program_id?: string
          maintenance_interval_days?: number | null
          mastered_at?: string | null
          name?: string
          next_maintenance_date?: string | null
          queue_position?: number
          status?: Database["public"]["Enums"]["target_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "targets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "targets_current_prompt_level_id_fkey"
            columns: ["current_prompt_level_id"]
            isOneToOne: false
            referencedRelation: "prompt_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "targets_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "targets_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "targets_learner_program_id_fkey"
            columns: ["learner_program_id"]
            isOneToOne: false
            referencedRelation: "learner_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      template_targets: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          sort_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          sort_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          sort_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_targets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_targets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      trials: {
        Row: {
          client_id: string
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          help_level_id: string | null
          id: string
          learner_id: string
          prompt_level_id: string | null
          recorded_at: string
          result: Database["public"]["Enums"]["trial_result"] | null
          session_id: string
          started_at: string | null
          target_id: string
          updated_at: string
          value: number | null
        }
        Insert: {
          client_id: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          help_level_id?: string | null
          id?: string
          learner_id: string
          prompt_level_id?: string | null
          recorded_at?: string
          result?: Database["public"]["Enums"]["trial_result"] | null
          session_id: string
          started_at?: string | null
          target_id: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          client_id?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          help_level_id?: string | null
          id?: string
          learner_id?: string
          prompt_level_id?: string | null
          recorded_at?: string
          result?: Database["public"]["Enums"]["trial_result"] | null
          session_id?: string
          started_at?: string | null
          target_id?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trials_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_help_level_id_fkey"
            columns: ["help_level_id"]
            isOneToOne: false
            referencedRelation: "prompt_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_prompt_level_id_fkey"
            columns: ["prompt_level_id"]
            isOneToOne: false
            referencedRelation: "prompt_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "target_mastery"
            referencedColumns: ["target_id"]
          },
          {
            foreignKeyName: "trials_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      learner_overview: {
        Row: {
          active: boolean | null
          birth_date: string | null
          clinic_id: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          initials: string | null
          last_session_at: string | null
          photo_path: string | null
          sessions_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "learners_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      program_session_stats: {
        Row: {
          applicator_id: string | null
          correct_independent: number | null
          errors: number | null
          learner_id: string | null
          learner_program_id: string | null
          occurrences: number | null
          pct_independent: number | null
          prompted: number | null
          session_id: string | null
          session_status: Database["public"]["Enums"]["session_status"] | null
          started_at: string | null
          trials_total: number | null
          value_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_applicator_id_fkey"
            columns: ["applicator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "targets_learner_program_id_fkey"
            columns: ["learner_program_id"]
            isOneToOne: false
            referencedRelation: "learner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_overview: {
        Row: {
          applicator_id: string | null
          applicator_signature_path: string | null
          clinic_id: string | null
          correct_independent: number | null
          duration_seconds: number | null
          ended_at: string | null
          id: string | null
          learner_id: string | null
          notes: string | null
          number: number | null
          occurrences: number | null
          programs_count: number | null
          prompted: number | null
          rating: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["session_status"] | null
          targets_count: number | null
          trials_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_applicator_id_fkey"
            columns: ["applicator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      session_target_stats: {
        Row: {
          correct_independent: number | null
          errors: number | null
          learner_id: string | null
          occurrences: number | null
          pct_independent: number | null
          pct_total: number | null
          prompt_level_id: string | null
          prompted: number | null
          session_id: string | null
          session_status: Database["public"]["Enums"]["session_status"] | null
          started_at: string | null
          target_id: string | null
          trials_total: number | null
          value_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trials_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "target_mastery"
            referencedColumns: ["target_id"]
          },
          {
            foreignKeyName: "trials_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
        ]
      }
      target_mastery: {
        Row: {
          learner_id: string | null
          learner_program_id: string | null
          mastery_min_pct: number | null
          mastery_min_trials: number | null
          mastery_sessions: number | null
          ready_to_master: boolean | null
          sessions_considered: number | null
          sessions_meeting: number | null
          target_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "targets_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learner_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "targets_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "targets_learner_program_id_fkey"
            columns: ["learner_program_id"]
            isOneToOne: false
            referencedRelation: "learner_programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_targets: {
        Args: { p_level?: string; p_names: string[]; p_program: string }
        Returns: number
      }
      can_manage: { Args: { p_learner: string }; Returns: boolean }
      can_see: { Args: { p_learner: string }; Returns: boolean }
      can_see_session: { Args: { p_session: string }; Returns: boolean }
      can_write_session: { Args: { p_session: string }; Returns: boolean }
      complete_password_change: { Args: never; Returns: boolean }
      create_learner_program: { Args: { p: Json }; Returns: string }
      first_prompt_level: { Args: { p_clinic: string }; Returns: string }
      is_on_team: { Args: { p_learner: string }; Returns: boolean }
      is_valid_cpf: { Args: { p_cpf: string }; Returns: boolean }
      lgpd_consent_text: { Args: never; Returns: string }
      make_initials: { Args: { p_name: string }; Returns: string }
      mark_provisional_password: {
        Args: { p_user: string }
        Returns: undefined
      }
      my_clinic_id: { Args: never; Returns: string }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      reorder_programs: {
        Args: { p_ids: string[]; p_learner: string }
        Returns: undefined
      }
      reorder_targets: {
        Args: { p_ids: string[]; p_program: string }
        Returns: undefined
      }
      save_learner: { Args: { p: Json }; Returns: string }
      save_playlist: { Args: { p: Json }; Returns: string }
      save_prompt_levels: { Args: { p: Json }; Returns: undefined }
      save_template: { Args: { p: Json }; Returns: string }
      set_target_status: {
        Args: {
          p_interval_days?: number
          p_status: Database["public"]["Enums"]["target_status"]
          p_target: string
        }
        Returns: string
      }
      try_uuid: { Args: { p: string }; Returns: string }
    }
    Enums: {
      measure_type: "tentativa" | "frequencia" | "duracao"
      program_goal: "aquisicao" | "reducao"
      program_status: "ativo" | "pausado" | "concluido"
      protocol:
        | "vbmapp"
        | "ablls_r"
        | "denver_esdm"
        | "peak"
        | "afls"
        | "portage"
        | "marcos_cv"
        | "outro"
      session_status: "em_andamento" | "finalizada"
      target_status: "fila" | "intervencao" | "manutencao" | "masterizado"
      trial_result: "acerto" | "erro" | "dica"
      user_role: "coordenador" | "supervisor" | "aplicador"
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
      measure_type: ["tentativa", "frequencia", "duracao"],
      program_goal: ["aquisicao", "reducao"],
      program_status: ["ativo", "pausado", "concluido"],
      protocol: [
        "vbmapp",
        "ablls_r",
        "denver_esdm",
        "peak",
        "afls",
        "portage",
        "marcos_cv",
        "outro",
      ],
      session_status: ["em_andamento", "finalizada"],
      target_status: ["fila", "intervencao", "manutencao", "masterizado"],
      trial_result: ["acerto", "erro", "dica"],
      user_role: ["coordenador", "supervisor", "aplicador"],
    },
  },
} as const
