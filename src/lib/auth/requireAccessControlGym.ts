/**
 * Authorization for the gym-facing access-control API.
 *
 * Every one of these routes needs the same three things established before it
 * may do anything: a signed-in user, the gym they own, and the Enterprise
 * `accessControlHardware` capability. Doing that inline in fourteen handlers is
 * fourteen chances to omit the third check — and omitting it means a Lite gym
 * can drive door hardware.
 *
 * Returns a ready `NextResponse` on failure, matching `getApiGymProfile` in
 * `lib/middleware/api-auth`, so handlers stay linear: guard, return, proceed.
 */

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createGymSubscriptionRepository } from '@/features/subscriptions'
import { isFeatureEnabled } from '@/features/subscriptions/domain/PlanRestrictions'
import { ResponseBuilder } from '@/utils/api/ApiResponse'

/** The caller, once every check has passed. */
export interface AccessControlCaller {
  gymId: string
  userId: string
  /** The caller's session client — RLS-scoped, and what routes must pass on. */
  supabase: SupabaseClient
}

export interface AccessControlGuardResult {
  caller: AccessControlCaller | null
  error: NextResponse | null
}

/**
 * Resolve and authorize the caller for an access-control route.
 *
 * @returns The caller's gym and session client, or the response to return.
 *
 * @example
 * const { caller, error } = await requireAccessControlGym()
 * if (error) return error
 * const devices = await createAccessControlRepository(caller!.supabase)
 *   .listDevices(caller!.gymId)
 */
export async function requireAccessControlGym(): Promise<AccessControlGuardResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      caller: null,
      error: NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 }),
    }
  }

  const { data: gym, error: gymError } = await supabase
    .from('gyms')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (gymError || !gym) {
    return {
      caller: null,
      error: NextResponse.json(ResponseBuilder.notFound('Gym profile'), {
        status: 404,
      }),
    }
  }

  const gymId = (gym as { id: string }).id

  const subscription =
    await createGymSubscriptionRepository(supabase).findByGymId(gymId)

  // Fails closed: no resolvable subscription means no hardware access. A gym
  // that cannot be shown to be entitled is not entitled.
  if (
    !subscription ||
    !isFeatureEnabled(subscription.tier, 'accessControlHardware')
  ) {
    return {
      caller: null,
      error: NextResponse.json(
        ResponseBuilder.forbidden(
          'Access control hardware is available on the Enterprise plan'
        ),
        { status: 403 }
      ),
    }
  }

  return {
    caller: { gymId, userId: user.id, supabase },
    error: null,
  }
}
