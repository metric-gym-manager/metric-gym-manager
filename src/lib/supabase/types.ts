/**
 * Supabase Database Types
 *
 * These types are generated from your Supabase database schema.
 * To regenerate: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      gyms: {
        Row: {
          id: string
          name: string
          slug: string
          email: string
          phone: string | null
          timezone: string
          currency: string
          settings: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['gyms']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['gyms']['Insert']>
      }
      users: {
        Row: {
          id: string
          gym_id: string
          email: string
          first_name: string
          last_name: string
          role: 'gym_owner' | 'admin' | 'trainer' | 'front_desk'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      members: {
        Row: {
          id: string
          gym_id: string
          email: string
          first_name: string
          last_name: string
          phone: string | null
          date_of_birth: string | null
          gender: string | null
          address: Json | null
          photo_url: string | null
          status: 'active' | 'pending' | 'frozen' | 'expired' | 'cancelled'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['members']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['members']['Insert']>
      }
      emergency_contacts: {
        Row: {
          id: string
          member_id: string
          name: string
          relationship: string
          phone: string
          email: string | null
          is_primary: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['emergency_contacts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['emergency_contacts']['Insert']>
      }
      medical_waivers: {
        Row: {
          id: string
          member_id: string
          conditions: string | null
          medications: string | null
          allergies: string | null
          signature_data: string
          signed_at: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['medical_waivers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['medical_waivers']['Insert']>
      }
      membership_plans: {
        Row: {
          id: string
          gym_id: string
          name: string
          description: string | null
          plan_type: 'drop_in' | 'class_pack' | 'monthly' | 'annual' | 'custom'
          price_amount: number
          billing_frequency: 'one_time' | 'monthly' | 'annual'
          trial_days: number
          access_level: string
          class_credits: number | null
          contract_length_months: number | null
          setup_fee: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['membership_plans']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['membership_plans']['Insert']>
      }
      member_memberships: {
        Row: {
          id: string
          member_id: string
          plan_id: string
          status: 'active' | 'pending' | 'cancelled' | 'expired'
          start_date: string
          end_date: string | null
          next_billing_date: string | null
          auto_renew: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['member_memberships']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['member_memberships']['Insert']>
      }
      payment_methods: {
        Row: {
          id: string
          member_id: string
          type: 'credit_card' | 'debit_card' | 'bank_account' | 'cash' | 'check'
          last_four: string | null
          brand: string | null
          expiry_month: number | null
          expiry_year: number | null
          is_default: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['payment_methods']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['payment_methods']['Insert']>
      }
      payments: {
        Row: {
          id: string
          gym_id: string
          member_id: string
          membership_id: string | null
          payment_method_id: string | null
          amount: number
          currency: string
          status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'
          type: 'membership' | 'setup_fee' | 'class_pack' | 'drop_in' | 'other'
          description: string | null
          mock_processor_id: string | null
          mock_data: Json
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
