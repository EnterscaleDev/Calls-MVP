// Generated via Supabase typegen against project mmimoqmqiejkipiaccox (Calls MVP).
// Do not hand-edit — regenerate after any schema migration instead.

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
      agent_profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          organisation_id: string
          phone: string
          status: Database["public"]["Enums"]["agent_status_enum"]
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          organisation_id: string
          phone?: string
          status?: Database["public"]["Enums"]["agent_status_enum"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          organisation_id?: string
          phone?: string
          status?: Database["public"]["Enums"]["agent_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "agent_profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_name: string
          actor_type: Database["public"]["Enums"]["actor_type_enum"]
          actor_user_id: string | null
          campaign_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          organisation_id: string
        }
        Insert: {
          action: string
          actor_name: string
          actor_type: Database["public"]["Enums"]["actor_type_enum"]
          actor_user_id?: string | null
          campaign_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          organisation_id: string
        }
        Update: {
          action?: string
          actor_name?: string
          actor_type?: Database["public"]["Enums"]["actor_type_enum"]
          actor_user_id?: string | null
          campaign_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_history_events: {
        Row: {
          action: string
          actor_user_id: string | null
          booking_id: string
          id: string
          note: string | null
          occurred_at: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          booking_id: string
          id?: string
          note?: string | null
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          booking_id?: string
          id?: string
          note?: string | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_history_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "interview_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      call_assignments: {
        Row: {
          agent_id: string
          assigned_at: string
          assigned_by_name: string
          assigned_by_user_id: string | null
          booking_id: string
          campaign_id: string
          id: string
          participant_id: string
          status: Database["public"]["Enums"]["assignment_status_enum"]
        }
        Insert: {
          agent_id: string
          assigned_at?: string
          assigned_by_name: string
          assigned_by_user_id?: string | null
          booking_id: string
          campaign_id: string
          id?: string
          participant_id: string
          status?: Database["public"]["Enums"]["assignment_status_enum"]
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          assigned_by_name?: string
          assigned_by_user_id?: string | null
          booking_id?: string
          campaign_id?: string
          id?: string
          participant_id?: string
          status?: Database["public"]["Enums"]["assignment_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "call_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_assignments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "interview_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "campaign_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_attempts: {
        Row: {
          agent_id: string
          assignment_id: string
          campaign_id: string
          connected_at: string | null
          created_at: string
          disposition: Database["public"]["Enums"]["call_outcome_enum"] | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          notes: string | null
          participant_id: string
          provider_call_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["call_attempt_status_enum"]
        }
        Insert: {
          agent_id: string
          assignment_id: string
          campaign_id: string
          connected_at?: string | null
          created_at?: string
          disposition?: Database["public"]["Enums"]["call_outcome_enum"] | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          participant_id: string
          provider_call_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_attempt_status_enum"]
        }
        Update: {
          agent_id?: string
          assignment_id?: string
          campaign_id?: string
          connected_at?: string | null
          created_at?: string
          disposition?: Database["public"]["Enums"]["call_outcome_enum"] | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          participant_id?: string
          provider_call_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_attempt_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "call_attempts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "call_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_attempts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_attempts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "campaign_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_script_sections: {
        Row: {
          campaign_id: string
          id: string
          instructions: string | null
          position: number
          questions: string[]
          title: string
        }
        Insert: {
          campaign_id: string
          id?: string
          instructions?: string | null
          position: number
          questions?: string[]
          title: string
        }
        Update: {
          campaign_id?: string
          id?: string
          instructions?: string | null
          position?: number
          questions?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_script_sections_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_scripts"
            referencedColumns: ["campaign_id"]
          },
        ]
      }
      call_scripts: {
        Row: {
          campaign_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_scripts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_agents: {
        Row: {
          active: boolean
          agent_id: string
          campaign_id: string
          created_at: string
          daily_target: number
          id: string
        }
        Insert: {
          active?: boolean
          agent_id: string
          campaign_id: string
          created_at?: string
          daily_target: number
          id?: string
        }
        Update: {
          active?: boolean
          agent_id?: string
          campaign_id?: string
          created_at?: string
          daily_target?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_agents_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_invitations: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          participant_id: string
          provider_message_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["invitation_status_enum"]
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          participant_id: string
          provider_message_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status_enum"]
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          participant_id?: string
          provider_message_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "campaign_invitations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_invitations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "campaign_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_participants: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string
          id: string
          invite_token_hash: string
          participation_status: Database["public"]["Enums"]["participation_status_enum"]
          segment: string | null
          token_expires_at: string
          token_revoked: boolean
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string
          id?: string
          invite_token_hash: string
          participation_status?: Database["public"]["Enums"]["participation_status_enum"]
          segment?: string | null
          token_expires_at: string
          token_revoked?: boolean
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          invite_token_hash?: string
          participation_status?: Database["public"]["Enums"]["participation_status_enum"]
          segment?: string | null
          token_expires_at?: string
          token_revoked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "campaign_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          archived_at: string | null
          campaign_type: string
          client_name: string
          created_at: string
          created_by_name: string
          created_by_user_id: string | null
          daily_agent_target: number
          deleted_at: string | null
          deleted_by: string | null
          description: string
          end_date: string
          estimated_duration_minutes: number
          id: string
          incentive_description: string
          incentive_title: string
          name: string
          organisation_id: string
          recording_enabled: boolean
          research_objective: string
          sender_id: string
          start_date: string
          status: Database["public"]["Enums"]["campaign_status_enum"]
          status_before_archive:
            | Database["public"]["Enums"]["campaign_status_enum"]
            | null
          target_completions: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          campaign_type?: string
          client_name: string
          created_at?: string
          created_by_name: string
          created_by_user_id?: string | null
          daily_agent_target: number
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          end_date: string
          estimated_duration_minutes: number
          id?: string
          incentive_description?: string
          incentive_title?: string
          name: string
          organisation_id: string
          recording_enabled?: boolean
          research_objective?: string
          sender_id: string
          start_date: string
          status?: Database["public"]["Enums"]["campaign_status_enum"]
          status_before_archive?:
            | Database["public"]["Enums"]["campaign_status_enum"]
            | null
          target_completions: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          campaign_type?: string
          client_name?: string
          created_at?: string
          created_by_name?: string
          created_by_user_id?: string | null
          daily_agent_target?: number
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          end_date?: string
          estimated_duration_minutes?: number
          id?: string
          incentive_description?: string
          incentive_title?: string
          name?: string
          organisation_id?: string
          recording_enabled?: boolean
          research_objective?: string
          sender_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["campaign_status_enum"]
          status_before_archive?:
            | Database["public"]["Enums"]["campaign_status_enum"]
            | null
          target_completions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_events: {
        Row: {
          campaign_id: string
          consent_status: Database["public"]["Enums"]["consent_status_enum"]
          consent_type: Database["public"]["Enums"]["consent_type_enum"]
          consent_version: string
          consented_at: string
          id: string
          participant_id: string
          source: string
        }
        Insert: {
          campaign_id: string
          consent_status: Database["public"]["Enums"]["consent_status_enum"]
          consent_type: Database["public"]["Enums"]["consent_type_enum"]
          consent_version: string
          consented_at?: string
          id?: string
          participant_id: string
          source: string
        }
        Update: {
          campaign_id?: string
          consent_status?: Database["public"]["Enums"]["consent_status_enum"]
          consent_type?: Database["public"]["Enums"]["consent_type_enum"]
          consent_version?: string
          consented_at?: string
          id?: string
          participant_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "campaign_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          external_customer_id: string | null
          id: string
          name: string
          organisation_id: string
          phone: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          external_customer_id?: string | null
          id?: string
          name: string
          organisation_id: string
          phone: string
        }
        Update: {
          created_at?: string
          email?: string | null
          external_customer_id?: string | null
          id?: string
          name?: string
          organisation_id?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          account: string
          amount: number
          campaign_id: string | null
          created_at: string
          detail: string
          id: string
          kind: string
          organisation_id: string
        }
        Insert: {
          account: string
          amount: number
          campaign_id?: string | null
          created_at?: string
          detail: string
          id?: string
          kind: string
          organisation_id: string
        }
        Update: {
          account?: string
          amount?: number
          campaign_id?: string | null
          created_at?: string
          detail?: string
          id?: string
          kind?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_bookings: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          is_current: boolean
          participant_id: string
          scheduled_end: string
          scheduled_start: string
          status: Database["public"]["Enums"]["booking_status_enum"]
          timezone: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          is_current?: boolean
          participant_id: string
          scheduled_end: string
          scheduled_start: string
          status?: Database["public"]["Enums"]["booking_status_enum"]
          timezone: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          is_current?: boolean
          participant_id?: string
          scheduled_end?: string
          scheduled_start?: string
          status?: Database["public"]["Enums"]["booking_status_enum"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_bookings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_bookings_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "campaign_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      org_credits: {
        Row: {
          organisation_id: string
          sms: number
          updated_at: string
          voice_minutes: number
        }
        Insert: {
          organisation_id: string
          sms?: number
          updated_at?: string
          voice_minutes?: number
        }
        Update: {
          organisation_id?: string
          sms?: number
          updated_at?: string
          voice_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_credits_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agent_id: string | null
          created_at: string
          display_name: string
          id: string
          organisation_id: string
          role: Database["public"]["Enums"]["user_role_enum"]
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          display_name: string
          id: string
          organisation_id: string
          role: Database["public"]["Enums"]["user_role_enum"]
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["user_role_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      recordings: {
        Row: {
          call_attempt_id: string
          campaign_id: string
          created_at: string
          duration: number | null
          id: string
          provider_recording_id: string
          status: Database["public"]["Enums"]["recording_status_enum"]
          storage_reference: string
        }
        Insert: {
          call_attempt_id: string
          campaign_id: string
          created_at?: string
          duration?: number | null
          id?: string
          provider_recording_id?: string
          status?: Database["public"]["Enums"]["recording_status_enum"]
          storage_reference?: string
        }
        Update: {
          call_attempt_id?: string
          campaign_id?: string
          created_at?: string
          duration?: number | null
          id?: string
          provider_recording_id?: string
          status?: Database["public"]["Enums"]["recording_status_enum"]
          storage_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_call_attempt_id_fkey"
            columns: ["call_attempt_id"]
            isOneToOne: true
            referencedRelation: "call_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sender_ids: {
        Row: {
          approved_at: string | null
          client_name: string
          created_at: string
          id: string
          organisation_id: string
          requested_at: string
          sender_id: string
          status: Database["public"]["Enums"]["sender_id_status_enum"]
        }
        Insert: {
          approved_at?: string | null
          client_name: string
          created_at?: string
          id?: string
          organisation_id: string
          requested_at?: string
          sender_id: string
          status?: Database["public"]["Enums"]["sender_id_status_enum"]
        }
        Update: {
          approved_at?: string | null
          client_name?: string
          created_at?: string
          id?: string
          organisation_id?: string
          requested_at?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["sender_id_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "sender_ids_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_activate_campaign: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      admin_assign_participant: {
        Args: {
          p_agent_id: string
          p_campaign_id: string
          p_participant_id: string
        }
        Returns: string
      }
      admin_attach_agent_to_campaign: {
        Args: {
          p_agent_id: string
          p_campaign_id: string
          p_daily_target: number
        }
        Returns: string
      }
      admin_campaign_delete_eligibility: {
        Args: { p_campaign_id: string }
        Returns: { eligible: boolean; reason: string }[]
      }
      admin_check_duplicate_phones: {
        Args: { p_campaign_id: string; p_phones: string[] }
        Returns: string[]
      }
      admin_create_campaign: {
        Args: {
          p_client_name: string
          p_daily_agent_target: number
          p_description: string
          p_end_date: string
          p_estimated_duration_minutes: number
          p_incentive_description: string
          p_incentive_title: string
          p_name: string
          p_recording_enabled: boolean
          p_research_objective: string
          p_sender_id: string
          p_start_date: string
          p_status?: Database["public"]["Enums"]["campaign_status_enum"]
          p_target_completions: number
        }
        Returns: string
      }
      admin_delete_campaign: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      admin_detach_agent_from_campaign: {
        Args: { p_campaign_agent_id: string }
        Returns: undefined
      }
      admin_duplicate_campaign: {
        Args: { p_campaign_id: string }
        Returns: string
      }
      admin_import_contact: {
        Args: {
          p_campaign_id: string
          p_email: string
          p_external_customer_id: string
          p_name: string
          p_phone: string
          p_segment: string
        }
        Returns: string
      }
      admin_invite_agent: {
        Args: {
          p_campaign_id?: string
          p_daily_target?: number
          p_email: string
          p_name: string
          p_phone?: string
        }
        Returns: string
      }
      admin_restore_campaign: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      admin_update_campaign_details: {
        Args: {
          p_campaign_id: string
          p_client_name: string
          p_daily_agent_target: number
          p_description: string
          p_end_date: string
          p_estimated_duration_minutes: number
          p_incentive_description: string
          p_incentive_title: string
          p_name: string
          p_research_objective: string
          p_sender_id: string
          p_start_date: string
          p_target_completions: number
        }
        Returns: undefined
      }
      admin_update_campaign_recording: {
        Args: { p_campaign_id: string; p_recording_enabled: boolean }
        Returns: undefined
      }
      admin_update_campaign_status: {
        Args: {
          p_campaign_id: string
          p_status: Database["public"]["Enums"]["campaign_status_enum"]
        }
        Returns: undefined
      }
      agent_call_queue: {
        Args: never
        Returns: {
          assignment_id: string
          assignment_status: Database["public"]["Enums"]["assignment_status_enum"]
          booking_id: string
          bucket: string
          campaign_id: string
          campaign_name: string
          participant_alias: string
          scheduled_end: string
          scheduled_start: string
        }[]
      }
      agent_participant_detail: {
        Args: { p_assignment_id: string }
        Returns: {
          assignment_id: string
          booking_id: string
          campaign_id: string
          campaign_name: string
          participant_alias: string
          recording_enabled: boolean
          scheduled_end: string
          scheduled_start: string
        }[]
      }
      agent_submit_call_outcome: {
        Args: {
          p_call_attempt_id: string
          p_disposition: Database["public"]["Enums"]["call_outcome_enum"]
          p_notes: string
        }
        Returns: undefined
      }
      cancel_participant_booking: {
        Args: { p_booking_id: string; p_token: string }
        Returns: undefined
      }
      contacts_list_masked: {
        Args: { p_campaign_id?: string }
        Returns: {
          created_at: string
          has_email: boolean
          has_external_id: boolean
          id: string
          name: string
          phone_masked: string
        }[]
      }
      contacts_reveal: {
        Args: { p_campaign_id: string; p_contact_ids: string[] }
        Returns: {
          email: string
          external_customer_id: string
          id: string
          name: string
          phone: string
        }[]
      }
      create_participant_booking: {
        Args: {
          p_end: string
          p_start: string
          p_timezone: string
          p_token: string
        }
        Returns: string
      }
      fn_campaign_has_activity: {
        Args: { p_campaign_id: string }
        Returns: boolean
      }
      fn_current_agent_id: { Args: never; Returns: string }
      fn_is_admin: { Args: never; Returns: boolean }
      fn_participant_alias: {
        Args: { p_name: string; p_participant_id: string }
        Returns: string
      }
      fn_participant_id_from_token: {
        Args: { p_token: string }
        Returns: string
      }
      log_sms_batch_sent: {
        Args: { p_campaign_id: string; p_recipient_count: number }
        Returns: undefined
      }
      record_participant_consent: {
        Args: {
          p_consent_status: Database["public"]["Enums"]["consent_status_enum"]
          p_consent_type: Database["public"]["Enums"]["consent_type_enum"]
          p_source: string
          p_token: string
        }
        Returns: undefined
      }
      record_sms_send_cost: {
        Args: {
          p_amount: number
          p_campaign_id: string
          p_recipient_count: number
        }
        Returns: undefined
      }
      reschedule_participant_booking: {
        Args: {
          p_booking_id: string
          p_end: string
          p_start: string
          p_timezone: string
          p_token: string
        }
        Returns: string
      }
      resolve_participant_by_token: {
        Args: { p_token: string }
        Returns: {
          booking_id: string
          campaign_id: string
          campaign_name: string
          client_name: string
          estimated_duration_minutes: number
          first_name: string
          has_agreed_participation: boolean
          has_declined: boolean
          incentive_description: string
          incentive_title: string
          participant_id: string
          recording_enabled: boolean
          research_objective: string
          resolution_status: string
          scheduled_end: string
          scheduled_start: string
        }[]
      }
      top_up_credits: {
        Args: { p_amount: number; p_kind: string }
        Returns: undefined
      }
    }
    Enums: {
      actor_type_enum: "admin" | "agent" | "participant" | "system"
      agent_status_enum: "invited" | "active" | "inactive"
      assignment_status_enum:
        | "assigned"
        | "in_progress"
        | "completed"
        | "reassigned"
        | "cancelled"
      booking_status_enum:
        | "scheduled"
        | "rescheduled"
        | "cancelled"
        | "completed"
        | "missed"
      call_attempt_status_enum:
        | "preparing"
        | "connecting"
        | "connected"
        | "failed"
        | "ended"
      call_outcome_enum:
        | "completed"
        | "no_answer"
        | "busy"
        | "reschedule_requested"
        | "declined"
        | "wrong_number"
        | "ineligible"
        | "follow_up_required"
        | "technical_failure"
      campaign_status_enum:
        | "draft"
        | "ready"
        | "active"
        | "paused"
        | "completed"
        | "archived"
      consent_status_enum: "agreed" | "declined"
      consent_type_enum: "participation" | "recording"
      invitation_status_enum: "queued" | "sent" | "delivered" | "failed"
      participation_status_enum:
        | "imported"
        | "invited"
        | "delivered"
        | "invite_failed"
        | "opted_in"
        | "declined"
        | "scheduled"
        | "completed"
        | "ineligible"
      recording_status_enum:
        | "recording"
        | "available"
        | "failed"
        | "unavailable"
      sender_id_status_enum: "pending" | "active" | "rejected"
      user_role_enum: "admin" | "agent"
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
      actor_type_enum: ["admin", "agent", "participant", "system"],
      agent_status_enum: ["invited", "active", "inactive"],
      assignment_status_enum: [
        "assigned",
        "in_progress",
        "completed",
        "reassigned",
        "cancelled",
      ],
      booking_status_enum: [
        "scheduled",
        "rescheduled",
        "cancelled",
        "completed",
        "missed",
      ],
      call_attempt_status_enum: [
        "preparing",
        "connecting",
        "connected",
        "failed",
        "ended",
      ],
      call_outcome_enum: [
        "completed",
        "no_answer",
        "busy",
        "reschedule_requested",
        "declined",
        "wrong_number",
        "ineligible",
        "follow_up_required",
        "technical_failure",
      ],
      campaign_status_enum: [
        "draft",
        "ready",
        "active",
        "paused",
        "completed",
        "archived",
      ],
      consent_status_enum: ["agreed", "declined"],
      consent_type_enum: ["participation", "recording"],
      invitation_status_enum: ["queued", "sent", "delivered", "failed"],
      participation_status_enum: [
        "imported",
        "invited",
        "delivered",
        "invite_failed",
        "opted_in",
        "declined",
        "scheduled",
        "completed",
        "ineligible",
      ],
      recording_status_enum: [
        "recording",
        "available",
        "failed",
        "unavailable",
      ],
      sender_id_status_enum: ["pending", "active", "rejected"],
      user_role_enum: ["admin", "agent"],
    },
  },
} as const
