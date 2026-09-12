import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * API-specific auth helper that refreshes session and returns user.
 * Use this instead of requireAuth() in API routes to ensure session is fresh.
 */
export async function requireApiAuth() {
  const supabase = await createClient()

  // This getUser() call will automatically refresh the session if needed
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    console.error('API auth failed:', error?.message || 'No user')
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }

  return { user, error: null }
}

/**
 * API-specific helper to get gym profile with session refresh.
 * Use this instead of getCurrentGymProfile() in API routes.
 */
export async function getApiGymProfile() {
  const authResult = await requireApiAuth()

  if (authResult.error) {
    return {
      gymProfile: null,
      error: authResult.error,
    }
  }

  const supabase = await createClient()
  const { data: gymProfile, error } = await supabase
    .from('gyms')
    .select(
      'id, username, email, email_verified, phone_number, gym_name, gym_address, gym_website, profile_image_url'
    )
    .eq('user_id', authResult.user!.id)
    .single()

  if (error || !gymProfile) {
    console.error('Gym profile not found:', error?.message)
    return {
      gymProfile: null,
      error: NextResponse.json(
        { success: false, error: 'Gym profile not found' },
        { status: 404 }
      ),
    }
  }

  // `new_email` is set by Supabase only while an email change is awaiting
  // confirmation, and cleared once it completes. It is therefore the only
  // reliable way to tell the two unverified states apart: a brand-new signup
  // that has never confirmed (one inbox) from a pending change (two inboxes,
  // because `double_confirm_changes` requires the current address to approve).
  // Without it the interface has to guess, and guessing wrong tells the user to
  // check a mailbox that was never written to.
  return {
    gymProfile: {
      ...gymProfile,
      pending_email: pendingEmailIfLive(authResult.user!),
    },
    error: null,
  }
}

/**
 * How long a confirmation link stays usable, in milliseconds.
 *
 * Mirrors `auth.email.otp_expiry` in supabase/config.toml. Keep the two in step:
 * reporting a change as pending after its links have died leaves the user with
 * a banner they cannot act on and no way to clear it.
 */
export const EMAIL_CHANGE_TTL_MS = 30 * 60 * 1000

/**
 * The address awaiting confirmation, or null once its links have expired.
 *
 * Supabase clears `new_email` when a change COMPLETES — verified against this
 * project's `auth.users` — but an ABANDONED change has nothing to clear it. The
 * field would otherwise sit there and the settings screen would advertise a
 * pending change forever, pointing at links that stopped working at
 * `otp_expiry`.
 *
 * Expiry is derived from `email_change_sent_at` rather than inferred from the
 * presence of `new_email`, so the banner disappears at the same moment the
 * links do.
 */
export function pendingEmailIfLive(user: {
  new_email?: string
  email_change_sent_at?: string
}): string | null {
  if (!user.new_email) return null

  // No timestamp means we cannot tell. Showing it is the safer error: the user
  // can still act, and a stale banner beats hiding a real change in flight.
  if (!user.email_change_sent_at) return user.new_email

  const sentAt = Date.parse(user.email_change_sent_at)
  if (Number.isNaN(sentAt)) return user.new_email

  return Date.now() - sentAt < EMAIL_CHANGE_TTL_MS ? user.new_email : null
}
