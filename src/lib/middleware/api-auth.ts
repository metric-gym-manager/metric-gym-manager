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
      pending_email: authResult.user!.new_email ?? null,
    },
    error: null,
  }
}
