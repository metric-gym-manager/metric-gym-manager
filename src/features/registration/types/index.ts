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
 * Outcome of a public token lookup.
 *
 * `not_found` and `error` are deliberately distinct: only `not_found` means
 * the printed QR code is genuinely dead (unknown or deactivated token). Any
 * infrastructure failure is `error` and must NEVER be shown to a member as a
 * dead link — a transient DB hiccup would otherwise tell a whole gym their
 * posters had been replaced (rule 2.8).
 */
export type TokenLookupResult =
  | { status: 'ok'; gymId: string }
  | { status: 'not_found' }
  | { status: 'error' }

/**
 * Outcome of the public /join page data load. Same three-way distinction as
 * {@link TokenLookupResult}.
 */
export type PublicGymInfoResult =
  | { status: 'ok'; gym: PublicGymInfo }
  | { status: 'not_found' }
  | { status: 'error' }

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
