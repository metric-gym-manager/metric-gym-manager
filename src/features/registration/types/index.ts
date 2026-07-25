// ============================================================
// QR SELF-REGISTRATION TYPES
// ============================================================

/**
 * A gym's public self-registration link (one per gym, rotatable)
 */
export interface RegistrationLink {
  token: string
  /** Full public URL encoded into the QR code: {APP_URL}/join/{token} */
  joinUrl: string
  isActive: boolean
  createdAt: string
  rotatedAt: string | null
}

/**
 * Plan option shown in the public form dropdown
 */
export interface PublicPlanOption {
  planType: string
  label: string
  amount: number
}

/**
 * Data the public /join/[token] page needs (nothing sensitive)
 */
export interface PublicGymInfo {
  gymName: string
  plans: PublicPlanOption[]
  /** One-time admission fee in LKR, only when the gym has it enabled (else 0) */
  admissionFee: number
  /** Whether the admission fee applies to this registration */
  admissionFeeEnabled: boolean
}

/**
 * Response of POST /api/public/registrations
 */
export interface PublicRegistrationResult {
  memberId: string
  name: string
  planLabel: string
  amountDue: number
  /** Present when a photo upload was requested */
  uploadUrl?: string
  photoPath?: string
}
