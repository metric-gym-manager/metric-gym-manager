import { NextRequest, NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSafeRedirect } from '@/features/auth/utils/getSafeRedirect'

/**
 * Auth Callback Handler — signup confirmation and email change.
 *
 * Accepts BOTH shapes Supabase can deliver, because which one arrives is
 * decided by dashboard email-template configuration rather than by this code:
 *
 * - `?token_hash=&type=` — what `{{ .TokenHash }}` in a template produces.
 *   Verified with `verifyOtp`. Device-independent.
 * - `?code=` — the default PKCE templates. Exchanged with
 *   `exchangeCodeForSession`. Only works in the browser that started the flow,
 *   because the code verifier lives in that browser's cookies.
 *
 * Handling only one of them is how recovery broke: this route read `token_hash`
 * while the project was configured for PKCE, so it could never have verified a
 * real link. The mismatch was invisible — the route is not reachable from any
 * test that mocks Supabase, and nothing rendered it.
 *
 * **Password recovery does NOT come through here any more.** Its link goes
 * straight to `/reset-password`, which carries the token and spends it on
 * submit, so an email scanner's GET cannot consume it. The `recovery` branch
 * below only exists for links already sitting in inboxes from the old flow.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null

  // `next` is attacker-controllable, so it goes through the same sanitiser the
  // login screen uses. Absent means the post-confirmation landing page.
  const rawNext = requestUrl.searchParams.get('next')
  const next = rawNext ? getSafeRedirect(rawNext) : '/members'

  if (!code && (!token_hash || !type)) {
    console.error('No verification token provided')
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=missing_code`
    )
  }

  try {
    const supabase = await createClient()

    const { data, error: verifyError } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          type: type as EmailOtpType,
          token_hash: token_hash as string,
        })

    if (verifyError || !data.user) {
      console.error('Failed to verify email token:', verifyError)
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=verification_failed`
      )
    }

    const user = data.user

    // Legacy recovery links only — see the note above. Verifying just spent the
    // token, so there is none left to hand on. `/reset-password` with no token
    // renders "Reset link incomplete", which says the links are single-use and
    // offers a fresh one — exactly the right message here. Redirecting to
    // /forgot-password was the first attempt and was wrong: that screen ignores
    // query params, so the explanation would have vanished silently.
    //
    // Sign out first: the verification created a session, and leaving it live
    // would mean a password reset that silently logged someone in instead.
    if (type === 'recovery') {
      console.log(`Legacy recovery link used by: ${user.email}`)
      await supabase.auth.signOut()
      return NextResponse.redirect(`${requestUrl.origin}/reset-password`)
    }

    // Check if gym profile already exists (in case of re-confirmation)
    const adminClient = createAdminClient()
    const { data: existingGym } = await adminClient
      .from('gyms')
      .select('id, email_verified')
      .eq('user_id', user.id)
      .single()

    if (existingGym) {
      // Profile exists - update email and email_verified status for email change
      await adminClient
        .from('gyms')
        .update({
          email: user.email, // Update to the newly verified email
          email_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      console.log(
        `✅ Email updated and verified for user ${user.id}: ${user.email}`
      )

      // Profile already exists, redirect to dashboard
      return NextResponse.redirect(`${requestUrl.origin}${next}`)
    }

    // NOTE: Profile creation now happens immediately on registration (not here).
    // If we reach this point, the profile should already exist but wasn't found.
    // This is an error state that shouldn't normally occur.
    console.error(`No gym profile found for user ${user.id} after verification`)
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=profile_not_found`
    )
  } catch (error) {
    console.error('Unexpected error in auth callback:', error)
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=unexpected_error`
    )
  }
}
