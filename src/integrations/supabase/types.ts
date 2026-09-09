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
      applications: {
        Row: {
          answers: Json
          consent_version: string
          id: string
          influencer_id: string | null
          submitted_at: string
          tenant_id: string
        }
        Insert: {
          answers?: Json
          consent_version?: string
          id?: string
          influencer_id?: string | null
          submitted_at?: string
          tenant_id: string
        }
        Update: {
          answers?: Json
          consent_version?: string
          id?: string
          influencer_id?: string | null
          submitted_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          meta: Json
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_logs: {
        Row: {
          accepted_at: string
          id: string
          influencer_id: string | null
          purpose: string
          source: string | null
          tenant_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          influencer_id?: string | null
          purpose: string
          source?: string | null
          tenant_id: string
          version?: string
        }
        Update: {
          accepted_at?: string
          id?: string
          influencer_id?: string | null
          purpose?: string
          source?: string | null
          tenant_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_logs_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          influencer_id: string
          tenant_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          influencer_id: string
          tenant_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          influencer_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          confirmed: boolean
          created_at: string
          id: string
          influencer_id: string | null
          kind: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          id?: string
          influencer_id?: string | null
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          id?: string
          influencer_id?: string | null
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      influencers: {
        Row: {
          archived_at: string | null
          asked_about: string | null
          assigned_to: string | null
          avatar_url: string | null
          city: string | null
          consent_at: string | null
          created_at: string
          daily_time: string | null
          data_source: Database["public"]["Enums"]["data_source"]
          email: string
          female_audience_pct: number | null
          followers: number | null
          full_name: string
          id: string
          initial_followers: number | null
          initial_posts_count: number | null
          instagram_goal: string | null
          instagram_handle: string | null
          instagram_url: string | null
          level: string
          main_difficulty: string | null
          origin: string | null
          posts_count: number | null
          profile_goal: string | null
          profile_type: Database["public"]["Enums"]["ig_profile_type"] | null
          progress_score: number
          recent_posts_6m: Database["public"]["Enums"]["tri_state"] | null
          reels_frequency: string | null
          state: string | null
          status: Database["public"]["Enums"]["influencer_status"]
          stories_frequency: string | null
          tenant_id: string
          topics: string | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          archived_at?: string | null
          asked_about?: string | null
          assigned_to?: string | null
          avatar_url?: string | null
          city?: string | null
          consent_at?: string | null
          created_at?: string
          daily_time?: string | null
          data_source?: Database["public"]["Enums"]["data_source"]
          email: string
          female_audience_pct?: number | null
          followers?: number | null
          full_name: string
          id?: string
          initial_followers?: number | null
          initial_posts_count?: number | null
          instagram_goal?: string | null
          instagram_handle?: string | null
          instagram_url?: string | null
          level?: string
          main_difficulty?: string | null
          origin?: string | null
          posts_count?: number | null
          profile_goal?: string | null
          profile_type?: Database["public"]["Enums"]["ig_profile_type"] | null
          progress_score?: number
          recent_posts_6m?: Database["public"]["Enums"]["tri_state"] | null
          reels_frequency?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["influencer_status"]
          stories_frequency?: string | null
          tenant_id: string
          topics?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          archived_at?: string | null
          asked_about?: string | null
          assigned_to?: string | null
          avatar_url?: string | null
          city?: string | null
          consent_at?: string | null
          created_at?: string
          daily_time?: string | null
          data_source?: Database["public"]["Enums"]["data_source"]
          email?: string
          female_audience_pct?: number | null
          followers?: number | null
          full_name?: string
          id?: string
          initial_followers?: number | null
          initial_posts_count?: number | null
          instagram_goal?: string | null
          instagram_handle?: string | null
          instagram_url?: string | null
          level?: string
          main_difficulty?: string | null
          origin?: string | null
          posts_count?: number | null
          profile_goal?: string | null
          profile_type?: Database["public"]["Enums"]["ig_profile_type"] | null
          progress_score?: number
          recent_posts_6m?: Database["public"]["Enums"]["tri_state"] | null
          reels_frequency?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["influencer_status"]
          stories_frequency?: string | null
          tenant_id?: string
          topics?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_snapshots: {
        Row: {
          captured_at: string
          created_by: string | null
          female_audience_pct: number | null
          followers: number | null
          id: string
          influencer_id: string
          posts_count: number | null
          source: Database["public"]["Enums"]["data_source"]
          tenant_id: string
        }
        Insert: {
          captured_at?: string
          created_by?: string | null
          female_audience_pct?: number | null
          followers?: number | null
          id?: string
          influencer_id: string
          posts_count?: number | null
          source?: Database["public"]["Enums"]["data_source"]
          tenant_id: string
        }
        Update: {
          captured_at?: string
          created_by?: string | null
          female_audience_pct?: number | null
          followers?: number | null
          id?: string
          influencer_id?: string
          posts_count?: number | null
          source?: Database["public"]["Enums"]["data_source"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_snapshots_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          influencer_id: string
          tenant_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          influencer_id: string
          tenant_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          influencer_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          custom_branding: boolean
          description: string | null
          id: string
          is_active: boolean
          max_ai_analyses: number
          max_candidates: number
          max_members: number
          name: string
          price_cents: number
          sort_order: number
          storage_mb: number
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          custom_branding?: boolean
          description?: string | null
          id?: string
          is_active?: boolean
          max_ai_analyses?: number
          max_candidates?: number
          max_members?: number
          name: string
          price_cents?: number
          sort_order?: number
          storage_mb?: number
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          custom_branding?: boolean
          description?: string | null
          id?: string
          is_active?: boolean
          max_ai_analyses?: number
          max_candidates?: number
          max_members?: number
          name?: string
          price_cents?: number
          sort_order?: number
          storage_mb?: number
        }
        Relationships: []
      }
      platform_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      qualification_results: {
        Row: {
          computed_at: string
          id: string
          influencer_id: string
          manual_decision: string | null
          manual_decision_by: string | null
          manual_decision_note: string | null
          progress: Json
          requirements: Json
          rule_set_version: string
          status: Database["public"]["Enums"]["qualification_status"]
          tenant_id: string
        }
        Insert: {
          computed_at?: string
          id?: string
          influencer_id: string
          manual_decision?: string | null
          manual_decision_by?: string | null
          manual_decision_note?: string | null
          progress?: Json
          requirements?: Json
          rule_set_version?: string
          status: Database["public"]["Enums"]["qualification_status"]
          tenant_id: string
        }
        Update: {
          computed_at?: string
          id?: string
          influencer_id?: string
          manual_decision?: string | null
          manual_decision_by?: string | null
          manual_decision_note?: string | null
          progress?: Json
          requirements?: Json
          rule_set_version?: string
          status?: Database["public"]["Enums"]["qualification_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualification_results_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      qualification_rule_sets: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          requirements: Json
          tenant_id: string | null
          version: string
          weights: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          requirements: Json
          tenant_id?: string | null
          version?: string
          weights: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          requirements?: Json
          tenant_id?: string | null
          version?: string
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "qualification_rule_sets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["influencer_status"] | null
          id: string
          influencer_id: string
          note: string | null
          tenant_id: string
          to_status: Database["public"]["Enums"]["influencer_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["influencer_status"] | null
          id?: string
          influencer_id: string
          note?: string | null
          tenant_id: string
          to_status: Database["public"]["Enums"]["influencer_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["influencer_status"] | null
          id?: string
          influencer_id?: string
          note?: string | null
          tenant_id?: string
          to_status?: Database["public"]["Enums"]["influencer_status"]
        }
        Relationships: [
          {
            foreignKeyName: "status_history_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          level: string
          tenant_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          level: string
          tenant_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          level?: string
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          evidence_url: string | null
          id: string
          influencer_id: string | null
          level: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          evidence_url?: string | null
          id?: string
          influencer_id?: string | null
          level?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          evidence_url?: string | null
          id?: string
          influencer_id?: string | null
          level?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_branding: {
        Row: {
          accent_color: string | null
          authority_quote: string | null
          avatar_url: string | null
          bio: string | null
          headline: string | null
          hero_image_url: string | null
          instagram_handle: string | null
          manager_name: string | null
          subheadline: string | null
          tenant_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          accent_color?: string | null
          authority_quote?: string | null
          avatar_url?: string | null
          bio?: string | null
          headline?: string | null
          hero_image_url?: string | null
          instagram_handle?: string | null
          manager_name?: string | null
          subheadline?: string | null
          tenant_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          accent_color?: string | null
          authority_quote?: string | null
          avatar_url?: string | null
          bio?: string | null
          headline?: string | null
          hero_image_url?: string | null
          instagram_handle?: string | null
          manager_name?: string | null
          subheadline?: string | null
          tenant_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_branding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
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
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          is_public_page_enabled: boolean
          name: string
          plan_id: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          is_public_page_enabled?: boolean
          name: string
          plan_id?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          is_public_page_enabled?: boolean
          name?: string
          plan_id?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_tenant: { Args: { _tenant: string }; Returns: boolean }
      has_platform_role: {
        Args: {
          _role: Database["public"]["Enums"]["platform_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _roles: Database["public"]["Enums"]["tenant_role"][]
          _tenant: string
        }
        Returns: boolean
      }
      is_tenant_member: { Args: { _tenant: string }; Returns: boolean }
      shares_tenant_with: { Args: { _user: string }; Returns: boolean }
      tenant_is_demo: { Args: { _tenant: string }; Returns: boolean }
    }
    Enums: {
      data_source: "META_API" | "MANUAL" | "SCREENSHOT" | "INTERNAL"
      ig_profile_type: "PESSOAL" | "CRIADOR" | "COMERCIAL" | "NAO_SEI"
      influencer_status:
        | "NOVA_INSCRICAO"
        | "AGUARDANDO_DIAGNOSTICO"
        | "AGUARDANDO_EVIDENCIAS"
        | "EM_ESTRUTURACAO"
        | "EM_PRODUCAO"
        | "EM_CRESCIMENTO"
        | "PRONTA_AUDITORIA"
        | "QUALIFICADA"
        | "ENVIADA_ANALISE"
        | "APROVADA"
        | "NAO_APROVADA"
        | "PAUSADA"
        | "ARQUIVADA"
      platform_role: "platform_owner" | "platform_admin" | "support_agent"
      qualification_status:
        | "QUALIFIED"
        | "NOT_QUALIFIED"
        | "NEEDS_EVIDENCE"
        | "MANUAL_REVIEW"
      task_priority: "BAIXA" | "MEDIA" | "ALTA"
      task_status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA"
      tenant_role:
        | "manager_owner"
        | "manager_admin"
        | "manager_member"
        | "influencer"
      tri_state: "SIM" | "NAO" | "NAO_SEI"
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
      data_source: ["META_API", "MANUAL", "SCREENSHOT", "INTERNAL"],
      ig_profile_type: ["PESSOAL", "CRIADOR", "COMERCIAL", "NAO_SEI"],
      influencer_status: [
        "NOVA_INSCRICAO",
        "AGUARDANDO_DIAGNOSTICO",
        "AGUARDANDO_EVIDENCIAS",
        "EM_ESTRUTURACAO",
        "EM_PRODUCAO",
        "EM_CRESCIMENTO",
        "PRONTA_AUDITORIA",
        "QUALIFICADA",
        "ENVIADA_ANALISE",
        "APROVADA",
        "NAO_APROVADA",
        "PAUSADA",
        "ARQUIVADA",
      ],
      platform_role: ["platform_owner", "platform_admin", "support_agent"],
      qualification_status: [
        "QUALIFIED",
        "NOT_QUALIFIED",
        "NEEDS_EVIDENCE",
        "MANUAL_REVIEW",
      ],
      task_priority: ["BAIXA", "MEDIA", "ALTA"],
      task_status: ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"],
      tenant_role: [
        "manager_owner",
        "manager_admin",
        "manager_member",
        "influencer",
      ],
      tri_state: ["SIM", "NAO", "NAO_SEI"],
    },
  },
} as const
