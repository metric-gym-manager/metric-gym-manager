// ============================================================
// SETTINGS TYPES
// ============================================================

export interface GymSettings {
  gym_name: string
  gym_address: string | null
  gym_website: string | null
}

export interface PlanType {
  id: string
  gym_id: string
  plan_type: 'daily' | 'weekly' | 'monthly' | '3-months' | '6-months' | 'annual'
  default_amount: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Discount {
  id: string
  gym_id: string
  discount_name: string
  discount_percentage: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SecuritySettings {
  phone_number: string | null
  email: string
}

export interface AdmissionFeeSettings {
  admission_fee: number
  admission_fee_enabled: boolean
}

export interface GymPolicies {
  gym_rules: string
  gym_terms: string
}
