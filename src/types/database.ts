export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      briefs: {
        Row: {
          budget: string
          client_contact: string
          company: string | null
          conversation_id: string
          created_at: string
          email: string | null
          enrichment: Json | null
          id: string
          project_type: string
          scope_summary: string
          share_token: string
          timeline: string
          urgency: string
          website: string | null
        }
        Insert: {
          budget?: string
          client_contact?: string
          company?: string | null
          conversation_id: string
          created_at?: string
          email?: string | null
          enrichment?: Json | null
          id?: string
          project_type?: string
          scope_summary?: string
          share_token?: string
          timeline?: string
          urgency?: string
          website?: string | null
        }
        Update: {
          budget?: string
          client_contact?: string
          company?: string | null
          conversation_id?: string
          created_at?: string
          email?: string | null
          enrichment?: Json | null
          id?: string
          project_type?: string
          scope_summary?: string
          share_token?: string
          timeline?: string
          urgency?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          qualification_checks: Json | null
          referral: Json | null
          status: string
          updated_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          qualification_checks?: Json | null
          referral?: Json | null
          status?: string
          updated_at?: string
          visitor_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          qualification_checks?: Json | null
          referral?: Json | null
          status?: string
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          availability: string
          created_at: string
          id: string
          out_of_scope_rules: Json
          past_projects: Json
          pricing_ranges: Json
          referral_contacts: Json | null
          services: Json
          updated_at: string
        }
        Insert: {
          availability?: string
          created_at?: string
          id?: string
          out_of_scope_rules?: Json
          past_projects?: Json
          pricing_ranges?: Json
          referral_contacts?: Json | null
          services?: Json
          updated_at?: string
        }
        Update: {
          availability?: string
          created_at?: string
          id?: string
          out_of_scope_rules?: Json
          past_projects?: Json
          pricing_ranges?: Json
          referral_contacts?: Json | null
          services?: Json
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']