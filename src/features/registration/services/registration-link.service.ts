/**
 * Registration link service (server-side)
 *
 * Manages the per-gym public self-registration token behind /join/{token}.
 * Gym-scoped operations use the session client (RLS enforced); the public
 * token lookup uses the admin client because anonymous visitors have no
 * session — it only ever resolves a token to gym name + active plans.
 */

import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanLabel } from '@/features/members/config/PlanConfig'
import type {
  PublicGymInfo,
  PublicGymInfoResult,
  RegistrationLink,
  TokenLookupResult,
} from '../types'

/** Generate an unguessable URL token (32 hex chars = 128 bits) */
function generateToken(): string {
  return randomBytes(16).toString('hex')
}

/** Compose the public join URL for a token */
export function buildJoinUrl(token: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  return `${baseUrl}/join/${token}`
}

interface LinkRow {
  token: string
  is_active: boolean
  created_at: string
  rotated_at: string | null
}

function toRegistrationLink(row: LinkRow): RegistrationLink {
  return {
    token: row.token,
    joinUrl: buildJoinUrl(row.token),
    isActive: row.is_active,
    createdAt: row.created_at,
    rotatedAt: row.rotated_at,
  }
}

/**
 * Get the gym's registration link, creating one on first access.
 * (Existing gyms are backfilled by migration; this covers gyms created
 * before the insert trigger existed or edge cases.)
 */
export async function getOrCreateRegistrationLink(
  gymId: string
): Promise<RegistrationLink> {
  const supabase = await createClient()

  const { data: existing, error } = await supabase
    .from('gym_registration_links')
    .select('token, is_active, created_at, rotated_at')
    .eq('gym_id', gymId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch registration link: ${error.message}`)
  }

  if (existing) {
    return toRegistrationLink(existing as LinkRow)
  }

  const { data: created, error: insertError } = await supabase
    .from('gym_registration_links')
    .insert({ gym_id: gymId, token: generateToken() })
    .select('token, is_active, created_at, rotated_at')
    .single()

  if (insertError || !created) {
    throw new Error(
      `Failed to create registration link: ${insertError?.message}`
    )
  }

  return toRegistrationLink(created as LinkRow)
}

/**
 * Look up a public token (admin client — anonymous callers).
 *
 * Separates "this token is genuinely dead" from "the lookup failed": a
 * malformed token or a missing/deactivated row is `not_found`, while a
 * database/transport failure is `error`. Callers must not collapse the two —
 * see {@link TokenLookupResult}.
 */
export async function lookupRegistrationToken(
  token: string
): Promise<TokenLookupResult> {
  if (!/^[a-f0-9]{32,64}$/i.test(token)) {
    return { status: 'not_found' }
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('gym_registration_links')
    .select('gym_id, is_active')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    console.error('Registration token lookup failed:', error)
    return { status: 'error' }
  }

  if (!data || !data.is_active) {
    return { status: 'not_found' }
  }

  return { status: 'ok', gymId: data.gym_id as string }
}

/**
 * Resolve a public token to its gym id (admin client — anonymous callers).
 *
 * @returns gym id, or null when the token is unknown, deactivated, or the
 *   lookup failed. Prefer {@link lookupRegistrationToken} when the caller can
 *   tell the member something different for an infrastructure failure.
 */
export async function resolveRegistrationToken(
  token: string
): Promise<string | null> {
  const result = await lookupRegistrationToken(token)
  return result.status === 'ok' ? result.gymId : null
}

interface AdmissionFeeSettings {
  admissionFee: number
  admissionFeeEnabled: boolean
}

const NO_ADMISSION_FEE: AdmissionFeeSettings = {
  admissionFee: 0,
  admissionFeeEnabled: false,
}

/**
 * Read the gym's admission fee settings, degrading to "no fee" when they
 * cannot be read.
 *
 * The fee is an OPTIONAL add-on to the first payment, so a failure to read it
 * must never take down the registration flow that depends on it — charging no
 * admission fee is always the safe fallback (the desk collects the cash in
 * person either way).
 */
async function readAdmissionFeeSettings(
  gymId: string
): Promise<AdmissionFeeSettings> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('gyms')
    .select('admission_fee, admission_fee_enabled')
    .eq('id', gymId)
    .maybeSingle()

  if (error) {
    console.error('Admission fee lookup failed, charging no fee:', error)
    return NO_ADMISSION_FEE
  }

  if (!data || !data.admission_fee_enabled) return NO_ADMISSION_FEE

  return {
    admissionFee: Number(data.admission_fee) || 0,
    admissionFeeEnabled: true,
  }
}

/**
 * Fetch what the public /join page needs: gym name + active plans with
 * amounts. Deliberately returns nothing else about the gym.
 *
 * The gym name and plan list are the only things this page cannot render
 * without; the admission fee is read separately so that losing the optional
 * fee never costs a gym its working QR code.
 *
 * @returns `ok` with the public info, `not_found` for a dead token, or
 *   `error` when a lookup failed.
 */
export async function getPublicGymInfo(
  token: string
): Promise<PublicGymInfoResult> {
  const lookup = await lookupRegistrationToken(token)
  if (lookup.status !== 'ok') {
    return lookup
  }

  const gymId = lookup.gymId
  const supabase = createAdminClient()

  const [gymResult, plansResult, admissionFeeSettings] = await Promise.all([
    supabase.from('gyms').select('gym_name').eq('id', gymId).single(),
    supabase
      .from('plan_types')
      .select('plan_type, default_amount')
      .eq('gym_id', gymId)
      .eq('is_active', true)
      .order('default_amount', { ascending: true }),
    readAdmissionFeeSettings(gymId),
  ])

  if (gymResult.error || !gymResult.data) {
    console.error('Public gym lookup failed:', gymResult.error)
    return { status: 'error' }
  }

  if (plansResult.error) {
    console.error('Public plan lookup failed:', plansResult.error)
    return { status: 'error' }
  }

  const gym: PublicGymInfo = {
    gymName: gymResult.data.gym_name as string,
    plans: (plansResult.data ?? []).map((plan) => ({
      planType: plan.plan_type as string,
      label: getPlanLabel(plan.plan_type),
      amount: Number(plan.default_amount),
    })),
    admissionFee: admissionFeeSettings.admissionFee,
    admissionFeeEnabled: admissionFeeSettings.admissionFeeEnabled,
  }

  return { status: 'ok', gym }
}

/**
 * Admission fee authority for public registration. Like the plan amount, the
 * charged admission fee is always resolved server-side from the gym row, never
 * from client input. Admin client — the public join flow has no session.
 *
 * @returns The fee to add to the first payment (0 when disabled or unreadable).
 */
export async function getGymAdmissionFee(gymId: string): Promise<number> {
  const { admissionFee } = await readAdmissionFeeSettings(gymId)
  return admissionFee
}

// ============================================================
// SaaS-operator QR dashboard (extracted verbatim from api/admin/qr-codes)
// ============================================================

export interface GymQrCodeItem {
  gymId: string
  gymName: string
  username: string
  email: string
  token: string | null
  joinUrl: string | null
  isActive: boolean
  rotatedAt: string | null
}

/**
 * All gyms with their registration QR links, backfilling a link for any gym
 * that does not have one yet. Admin-client (cross-tenant) — caller must have
 * performed SaaS-operator authorization first.
 */
export async function listGymsWithRegistrationLinks(): Promise<
  GymQrCodeItem[]
> {
  const supabase = createAdminClient()

  const { data: gyms, error: gymsError } = await supabase
    .from('gyms')
    .select(
      'id, gym_name, username, email, gym_registration_links(token, is_active, created_at, rotated_at)'
    )
    .order('gym_name', { ascending: true })

  if (gymsError) {
    console.error('Failed to fetch gyms for QR dashboard:', gymsError)
    throw new Error('Failed to fetch gyms')
  }

  // Backfill links for any gym that doesn't have one yet (gyms created
  // before the migration backfill, or edge cases)
  const gymsWithoutLink = (gyms ?? []).filter(
    (gym) =>
      !gym.gym_registration_links ||
      (Array.isArray(gym.gym_registration_links) &&
        gym.gym_registration_links.length === 0)
  )

  const backfilledTokens = new Map<string, string>()
  for (const gym of gymsWithoutLink) {
    const token = randomBytes(16).toString('hex')
    const { error: insertError } = await supabase
      .from('gym_registration_links')
      .insert({ gym_id: gym.id, token })
    if (!insertError) {
      backfilledTokens.set(gym.id, token)
    }
  }

  return (gyms ?? []).map((gym) => {
    const linkRelation = gym.gym_registration_links
    const link = Array.isArray(linkRelation) ? linkRelation[0] : linkRelation
    const token =
      (link?.token as string | undefined) ??
      backfilledTokens.get(gym.id) ??
      null

    return {
      gymId: gym.id,
      gymName: gym.gym_name,
      username: gym.username,
      email: gym.email,
      token,
      joinUrl: token ? buildJoinUrl(token) : null,
      isActive: link?.is_active ?? true,
      rotatedAt: link?.rotated_at ?? null,
    }
  })
}

/**
 * Regenerate (rotate) a gym's public registration token.
 *
 * Generates a fresh unguessable token, stamps `rotated_at`, and re-activates
 * the link. Because the token is UNIQUE and the QR encodes `/join/{token}`,
 * rotating it immediately invalidates every previously printed poster without
 * touching the gym id. Admin client (cross-tenant) — the caller MUST have
 * performed SaaS-operator authorization first. Creates the link if the gym
 * somehow has none yet.
 *
 * @param gymId - The gym whose token to rotate
 * @returns The new registration link
 * @throws {Error} When the update/insert fails
 */
export async function rotateRegistrationToken(
  gymId: string
): Promise<RegistrationLink> {
  const supabase = createAdminClient()
  const token = generateToken()

  const { data: updated, error: updateError } = await supabase
    .from('gym_registration_links')
    .update({ token, is_active: true, rotated_at: new Date().toISOString() })
    .eq('gym_id', gymId)
    .select('token, is_active, created_at, rotated_at')
    .maybeSingle()

  if (updateError) {
    throw new Error(
      `Failed to rotate registration link: ${updateError.message}`
    )
  }

  if (updated) {
    return toRegistrationLink(updated as LinkRow)
  }

  // No existing link (edge case) — create one with the freshly generated token.
  const { data: created, error: insertError } = await supabase
    .from('gym_registration_links')
    .insert({ gym_id: gymId, token })
    .select('token, is_active, created_at, rotated_at')
    .single()

  if (insertError || !created) {
    throw new Error(
      `Failed to create registration link: ${insertError?.message}`
    )
  }

  return toRegistrationLink(created as LinkRow)
}

export interface GymPosterInput {
  gymName: string
  location: string | null
  logoUrl: string | null
  joinUrl: string
}

/**
 * Derive the short uppercase locality shown top-right on the poster from a
 * free-form gym address. Uses the first comma-separated segment and caps the
 * length so it never overflows the header. Returns null when nothing usable.
 */
export function derivePosterLocation(address?: string | null): string | null {
  if (!address) return null
  const first = address.split(',')[0]?.trim()
  if (!first) return null
  const upper = first.toUpperCase()
  return upper.length > 24 ? null : upper
}

/**
 * Assemble everything the 2b registration poster needs for a single gym:
 * name, profile logo, derived locality and the public join URL. Admin client
 * (cross-tenant) — caller must have performed SaaS-operator authorization
 * first. Backfills a registration link if the gym has none yet.
 *
 * @returns Poster input, or null when the gym does not exist.
 */
export async function getGymPosterInput(
  gymId: string
): Promise<GymPosterInput | null> {
  const supabase = createAdminClient()

  const { data: gym, error } = await supabase
    .from('gyms')
    .select(
      'gym_name, gym_address, profile_image_url, gym_registration_links(token, is_active)'
    )
    .eq('id', gymId)
    .maybeSingle()

  if (error || !gym) {
    return null
  }

  const linkRelation = gym.gym_registration_links
  const link = Array.isArray(linkRelation) ? linkRelation[0] : linkRelation
  let token = (link?.token as string | undefined) ?? null

  if (!token) {
    const generated = generateToken()
    const { error: insertError } = await supabase
      .from('gym_registration_links')
      .insert({ gym_id: gymId, token: generated })
    if (insertError) {
      return null
    }
    token = generated
  }

  return {
    gymName: gym.gym_name as string,
    location: derivePosterLocation(gym.gym_address as string | null),
    logoUrl: (gym.profile_image_url as string | null) ?? null,
    joinUrl: buildJoinUrl(token),
  }
}

/**
 * Amount authority for public registration: the chosen plan must be one of
 * the gym's ACTIVE plans and the charged amount always comes from the DB,
 * never from client input. Admin client — the public join flow has no session.
 */
export async function getActivePlanForGym(
  gymId: string,
  planType: string
): Promise<{ plan_type: string; default_amount: number } | null> {
  const supabase = createAdminClient()
  const { data: plan, error: planError } = await supabase
    .from('plan_types')
    .select('plan_type, default_amount')
    .eq('gym_id', gymId)
    .eq('plan_type', planType)
    .eq('is_active', true)
    .maybeSingle()

  if (planError || !plan) return null
  return plan
}
