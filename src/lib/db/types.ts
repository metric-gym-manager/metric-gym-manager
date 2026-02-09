// Database type definitions
export interface DatabaseRow {
  id: string
  created_at: Date
  updated_at: Date
}

export interface GymRow extends DatabaseRow {
  name: string
  slug: string
  email: string
  phone?: string
  address?: Record<string, any>
  timezone: string
  currency: string
  settings: Record<string, any>
}

export interface UserRow extends DatabaseRow {
  gym_id: string
  email: string
  password_hash: string
  first_name: string
  last_name: string
  role: 'gym_owner' | 'admin' | 'trainer' | 'front_desk'
  is_active: boolean
  last_login_at?: Date
}

export interface MemberRow extends DatabaseRow {
  gym_id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  date_of_birth?: Date
  gender?: string
  address?: Record<string, any>
  photo_url?: string
  status: 'active' | 'pending' | 'frozen' | 'expired' | 'cancelled'
  notes?: string
}

export interface MembershipPlanRow extends DatabaseRow {
  gym_id: string
  name: string
  description?: string
  plan_type: 'drop_in' | 'class_pack' | 'monthly' | 'annual' | 'custom'
  price_amount: number
  billing_frequency: 'one_time' | 'monthly' | 'annual'
  trial_days: number
  access_level: string
  class_credits?: number
  contract_length_months?: number
  setup_fee: number
  is_active: boolean
}

export interface PaymentRow extends DatabaseRow {
  gym_id: string
  member_id: string
  membership_id?: string
  payment_method_id?: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'
  type: 'membership' | 'setup_fee' | 'class_pack' | 'drop_in' | 'other'
  description?: string
  mock_processor_id?: string
  mock_data: Record<string, any>
  processed_at?: Date
}
