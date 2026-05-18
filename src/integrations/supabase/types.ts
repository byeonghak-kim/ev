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
      app_notes: {
        Row: {
          body: string | null
          created_at: string
          id: string
          race_id: string | null
          title: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          race_id?: string | null
          title?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          race_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_notes_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      ev_results: {
        Row: {
          bet_type: string
          combination_key: string
          created_at: string
          edge: number
          ev: number
          ev_percent: number
          expected_return: number
          horse_numbers: number[]
          id: string
          implied_probability: number
          memo: string | null
          model_run_id: string
          odds: number
          probability: number
          race_id: string
          rank: number | null
          recommendation: string | null
          snapshot_id: string
        }
        Insert: {
          bet_type: string
          combination_key: string
          created_at?: string
          edge: number
          ev: number
          ev_percent: number
          expected_return: number
          horse_numbers: number[]
          id?: string
          implied_probability: number
          memo?: string | null
          model_run_id: string
          odds: number
          probability: number
          race_id: string
          rank?: number | null
          recommendation?: string | null
          snapshot_id: string
        }
        Update: {
          bet_type?: string
          combination_key?: string
          created_at?: string
          edge?: number
          ev?: number
          ev_percent?: number
          expected_return?: number
          horse_numbers?: number[]
          id?: string
          implied_probability?: number
          memo?: string | null
          model_run_id?: string
          odds?: number
          probability?: number
          race_id?: string
          rank?: number | null
          recommendation?: string | null
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ev_results_model_run_id_fkey"
            columns: ["model_run_id"]
            isOneToOne: false
            referencedRelation: "model_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ev_results_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ev_results_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "odds_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      horses: {
        Row: {
          carried_weight: number | null
          created_at: string
          horse_name: string
          horse_no: number
          id: string
          jockey: string | null
          memo: string | null
          race_id: string
          sex_age: string | null
          trainer: string | null
        }
        Insert: {
          carried_weight?: number | null
          created_at?: string
          horse_name: string
          horse_no: number
          id?: string
          jockey?: string | null
          memo?: string | null
          race_id: string
          sex_age?: string | null
          trainer?: string | null
        }
        Update: {
          carried_weight?: number | null
          created_at?: string
          horse_name?: string
          horse_no?: number
          id?: string
          jockey?: string | null
          memo?: string | null
          race_id?: string
          sex_age?: string | null
          trainer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "horses_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      model_probabilities: {
        Row: {
          bet_type: string
          combination_key: string
          created_at: string
          horse_numbers: number[]
          id: string
          memo: string | null
          model_run_id: string
          probability: number
          race_id: string
        }
        Insert: {
          bet_type: string
          combination_key: string
          created_at?: string
          horse_numbers: number[]
          id?: string
          memo?: string | null
          model_run_id: string
          probability: number
          race_id: string
        }
        Update: {
          bet_type?: string
          combination_key?: string
          created_at?: string
          horse_numbers?: number[]
          id?: string
          memo?: string | null
          model_run_id?: string
          probability?: number
          race_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_probabilities_model_run_id_fkey"
            columns: ["model_run_id"]
            isOneToOne: false
            referencedRelation: "model_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_probabilities_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      model_runs: {
        Row: {
          created_at: string
          id: string
          memo: string | null
          model_name: string | null
          model_version: string | null
          params: Json | null
          race_id: string
          trained_until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          memo?: string | null
          model_name?: string | null
          model_version?: string | null
          params?: Json | null
          race_id: string
          trained_until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          memo?: string | null
          model_name?: string | null
          model_version?: string | null
          params?: Json | null
          race_id?: string
          trained_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_runs_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      odds_entries: {
        Row: {
          bet_type: string
          combination_key: string
          created_at: string
          horse_numbers: number[]
          id: string
          is_manual_edited: boolean
          ocr_confidence: number | null
          odds: number
          race_id: string
          snapshot_id: string
        }
        Insert: {
          bet_type: string
          combination_key: string
          created_at?: string
          horse_numbers: number[]
          id?: string
          is_manual_edited?: boolean
          ocr_confidence?: number | null
          odds: number
          race_id: string
          snapshot_id: string
        }
        Update: {
          bet_type?: string
          combination_key?: string
          created_at?: string
          horse_numbers?: number[]
          id?: string
          is_manual_edited?: boolean
          ocr_confidence?: number | null
          odds?: number
          race_id?: string
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "odds_entries_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odds_entries_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "odds_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      odds_snapshots: {
        Row: {
          captured_at: string
          created_at: string
          id: string
          memo: string | null
          race_id: string
          raw_ocr_json: Json | null
          screenshot_url: string | null
          source: string | null
        }
        Insert: {
          captured_at?: string
          created_at?: string
          id?: string
          memo?: string | null
          race_id: string
          raw_ocr_json?: Json | null
          screenshot_url?: string | null
          source?: string | null
        }
        Update: {
          captured_at?: string
          created_at?: string
          id?: string
          memo?: string | null
          race_id?: string
          raw_ocr_json?: Json | null
          screenshot_url?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "odds_snapshots_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      races: {
        Row: {
          created_at: string
          distance_m: number | null
          id: string
          memo: string | null
          race_date: string
          race_no: number
          track_condition: string | null
          updated_at: string
          venue: string
          weather: string | null
        }
        Insert: {
          created_at?: string
          distance_m?: number | null
          id?: string
          memo?: string | null
          race_date: string
          race_no: number
          track_condition?: string | null
          updated_at?: string
          venue: string
          weather?: string | null
        }
        Update: {
          created_at?: string
          distance_m?: number | null
          id?: string
          memo?: string | null
          race_date?: string
          race_no?: number
          track_condition?: string | null
          updated_at?: string
          venue?: string
          weather?: string | null
        }
        Relationships: []
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
    Enums: {},
  },
} as const
