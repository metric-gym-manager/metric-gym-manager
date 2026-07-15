/**
 * Registration link service (server-side)
 *
 * Manages the per-gym public self-registration token behind /join/{token}.
 * Gym-scoped operations use the session client (RLS enforced); the public
 * token lookup uses the admin client because anonymous visitors have no
 * session — it only ever resolves a token to gym name + active plans.
 */

import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlanLabel } from '@/core/utils/constants/PlanConfig';
import type { PublicGymInfo, RegistrationLink } from '../types';

/** Generate an unguessable URL token (32 hex chars = 128 bits) */
function generateToken(): string {
  return randomBytes(16).toString('hex');
}

/** Compose the public join URL for a token */
export function buildJoinUrl(token: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return `${baseUrl}/join/${token}`;
}

interface LinkRow {
  token: string;
  is_active: boolean;
  created_at: string;
  rotated_at: string | null;
}

function toRegistrationLink(row: LinkRow): RegistrationLink {
  return {
    token: row.token,
    joinUrl: buildJoinUrl(row.token),
    isActive: row.is_active,
    createdAt: row.created_at,
    rotatedAt: row.rotated_at,
  };
}

/**
 * Get the gym's registration link, creating one on first access.
 * (Existing gyms are backfilled by migration; this covers gyms created
 * before the insert trigger existed or edge cases.)
 */
export async function getOrCreateRegistrationLink(
  gymId: string
): Promise<RegistrationLink> {
  const supabase = await createClient();

  const { data: existing, error } = await supabase
    .from('gym_registration_links')
    .select('token, is_active, created_at, rotated_at')
    .eq('gym_id', gymId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch registration link: ${error.message}`);
  }

  if (existing) {
    return toRegistrationLink(existing as LinkRow);
  }

  const { data: created, error: insertError } = await supabase
    .from('gym_registration_links')
    .insert({ gym_id: gymId, token: generateToken() })
    .select('token, is_active, created_at, rotated_at')
    .single();

  if (insertError || !created) {
    throw new Error(
      `Failed to create registration link: ${insertError?.message}`
    );
  }

  return toRegistrationLink(created as LinkRow);
}

/**
 * Rotate the gym's registration token.
 * Previously printed QR posters stop working immediately.
 */
export async function rotateRegistrationLink(
  gymId: string
): Promise<RegistrationLink> {
  // Ensure a link exists first (also covers rotate-before-first-view)
  await getOrCreateRegistrationLink(gymId);

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from('gym_registration_links')
    .update({
      token: generateToken(),
      rotated_at: new Date().toISOString(),
      is_active: true,
    })
    .eq('gym_id', gymId)
    .select('token, is_active, created_at, rotated_at')
    .single();

  if (error || !updated) {
    throw new Error(`Failed to rotate registration link: ${error?.message}`);
  }

  return toRegistrationLink(updated as LinkRow);
}

/**
 * Resolve a public token to its gym id (admin client — anonymous callers).
 *
 * @returns gym id, or null when the token is unknown or deactivated
 */
export async function resolveRegistrationToken(
  token: string
): Promise<string | null> {
  if (!/^[a-f0-9]{32,64}$/i.test(token)) {
    return null;
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('gym_registration_links')
    .select('gym_id, is_active')
    .eq('token', token)
    .maybeSingle();

  if (error || !data || !data.is_active) {
    return null;
  }

  return data.gym_id as string;
}

/**
 * Fetch what the public /join page needs: gym name + active plans with
 * amounts. Deliberately returns nothing else about the gym.
 *
 * @returns Public gym info, or null when the token is invalid
 */
export async function getPublicGymInfo(
  token: string
): Promise<PublicGymInfo | null> {
  const gymId = await resolveRegistrationToken(token);
  if (!gymId) {
    return null;
  }

  const supabase = createAdminClient();

  const [gymResult, plansResult] = await Promise.all([
    supabase.from('gyms').select('gym_name').eq('id', gymId).single(),
    supabase
      .from('plan_types')
      .select('plan_type, default_amount')
      .eq('gym_id', gymId)
      .eq('is_active', true)
      .order('default_amount', { ascending: true }),
  ]);

  if (gymResult.error || !gymResult.data) {
    return null;
  }

  return {
    gymName: gymResult.data.gym_name as string,
    plans: (plansResult.data ?? []).map((plan) => ({
      planType: plan.plan_type as string,
      label: getPlanLabel(plan.plan_type),
      amount: Number(plan.default_amount),
    })),
  };
}
