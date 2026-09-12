import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  AuthResponse,
  AuthUser,
  GymProfile,
  LoginResponse,
  RegistrationResponse,
  SessionData,
} from '../types'
import type {
  LoginInput,
  RegistrationInput,
  UpdateGymInfoInput,
  UpdatePasswordInput,
} from '../schemas/auth.schemas'

// ============================================================
// REGISTRATION
// ============================================================

export async function registerGym(
  input: RegistrationInput
): Promise<AuthResponse<RegistrationResponse>> {
  try {
    const supabase = await createClient()

    // Check if username already exists
    const { data: existingUsername } = await supabase
      .from('gyms')
      .select('username')
      .eq('username', input.username)
      .single()

    if (existingUsername) {
      return {
        success: false,
        error: 'Username already taken',
      }
    }

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('gyms')
      .select('email')
      .eq('email', input.email)
      .single()

    if (existingEmail) {
      return {
        success: false,
        error: 'Email already registered',
      }
    }

    // Create auth user with Supabase Auth
    console.log(`📧 Creating new user account for: ${input.email}`)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
        data: {
          username: input.username,
          gym_name: input.gymName,
          gym_address: input.gymAddress || '',
          gym_website: input.gymWebsite || '',
        },
      },
    })

    if (authError || !authData.user || !authData.user.email) {
      console.error('❌ User creation failed:', authError?.message)

      // Handle specific Supabase Auth errors
      if (authError?.message?.includes('already registered')) {
        return {
          success: false,
          error: 'Email already registered',
        }
      }

      return {
        success: false,
        error: authError?.message || 'Failed to create account',
      }
    }

    console.log(
      `✅ User created successfully. Verification email should be sent to: ${input.email}`
    )

    // Create gym profile immediately (allows login before email verification)
    // Use admin client to bypass RLS since user is not authenticated in this session yet
    const adminClient = createAdminClient()
    const { error: gymError } = await adminClient.from('gyms').insert({
      user_id: authData.user.id,
      username: input.username,
      email: input.email,
      email_verified: false, // Will be updated when they verify
      gym_name: input.gymName,
      gym_address: input.gymAddress || null,
      gym_website: input.gymWebsite || null,
    })

    if (gymError) {
      // If profile creation fails, clean up auth user
      console.error('❌ Gym profile creation failed:', gymError.message)
      await adminClient.auth.admin.deleteUser(authData.user.id)

      // Check for specific database errors
      if (gymError.code === '23505') {
        // PostgreSQL unique violation
        if (gymError.message.includes('email')) {
          return {
            success: false,
            error: 'Email already registered',
          }
        }
        if (gymError.message.includes('username')) {
          return {
            success: false,
            error: 'Username already taken',
          }
        }
      }

      return {
        success: false,
        error: 'Failed to create gym profile. Please try again.',
      }
    }

    console.log(`✅ Gym profile created successfully for: ${input.gymName}`)

    // Note: Plan types are no longer auto-seeded during gym creation.
    // Gym owners must configure their own plan types via Settings → Plans.
    // This ensures each gym sets their own pricing instead of using arbitrary defaults.

    return {
      success: true,
      data: {
        user: authData.user as AuthUser,
        requiresEmailVerification: true,
        message:
          'Registration successful! Please check your email to verify your account.',
      },
    }
  } catch (error) {
    console.error('Registration error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred during registration',
    }
  }
}

// ============================================================
// LOGIN WITH USERNAME/EMAIL + PASSWORD
// ============================================================

export async function loginWithPassword(
  input: LoginInput
): Promise<AuthResponse<LoginResponse>> {
  try {
    // Pass the rememberMe preference so the server client sets the correct
    // cookie maxAge (persistent vs session) on the auth tokens.
    const supabase = await createClient({
      rememberSession: input.rememberMe,
    })

    // Sign in with Supabase Auth using email
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      })

    if (authError || !authData.user || !authData.user.email) {
      // Check if error is related to email verification
      if (
        authError?.message?.toLowerCase().includes('email') &&
        (authError?.message?.toLowerCase().includes('confirm') ||
          authError?.message?.toLowerCase().includes('verif'))
      ) {
        return {
          success: false,
          error:
            'Please verify your email before logging in. Check your inbox (including spam folder) for the verification link.',
        }
      }

      return {
        success: false,
        error: 'Invalid username or password',
      }
    }

    // Get gym profile
    const { data: gymProfile, error: gymError } = await supabase
      .from('gyms')
      .select('*')
      .eq('user_id', authData.user.id)
      .single()

    if (gymError || !gymProfile) {
      return {
        success: false,
        error: 'Failed to load gym profile',
      }
    }

    return {
      success: true,
      data: {
        user: authData.user as AuthUser,
        gymProfile: gymProfile as GymProfile,
        requiresEmailVerification: !gymProfile.email_verified,
      },
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred during login',
    }
  }
}

// ============================================================
// GET CURRENT SESSION
// ============================================================

export async function getCurrentSession(): Promise<SessionData | null> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return null
    }

    const { data: gymProfile } = await supabase
      .from('gyms')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!gymProfile) {
      return null
    }

    return {
      user: user as AuthUser,
      gymProfile: gymProfile as GymProfile,
    }
  } catch (error) {
    console.error('Get session error:', error)
    return null
  }
}

// ============================================================
// LOGOUT
// ============================================================

export async function logout(): Promise<AuthResponse<void>> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      return {
        success: false,
        error: 'Failed to sign out',
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error('Logout error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred during logout',
    }
  }
}

// ============================================================
// FORGOT PASSWORD
// ============================================================

export async function sendPasswordResetEmail(
  email: string
): Promise<AuthResponse<void>> {
  try {
    const supabase = await createClient()

    console.log(`📧 Sending password reset email to: ${email}`)

    // Straight to the form — NOT through /auth/callback, which verifies on GET
    // and would let an email scanner spend the token before the user clicks.
    // The template pairs with this as
    //   {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery
    // so the link carries the token and `resetPassword()` spends it on submit.
    //
    // This URL must be on the Supabase "Redirect URLs" allow list. When it is
    // not, Supabase silently discards it and substitutes Site URL — which is
    // how every recovery link came to land on the marketing root.
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
      : 'http://localhost:3000/reset-password'

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })

    if (error) {
      console.error('❌ Password reset email failed:', error.message)

      // Check for rate limit error
      if (error.message?.toLowerCase().includes('rate limit')) {
        return {
          success: false,
          error:
            'Too many password reset requests. Please wait a few minutes before trying again.',
        }
      }

      // Check for user not found
      if (error.message?.toLowerCase().includes('not found')) {
        return {
          success: false,
          error: 'No account found with this email address.',
        }
      }

      return {
        success: false,
        error: 'Failed to send password reset email. Please try again.',
      }
    }

    console.log(`✅ Password reset email sent to: ${email}`)

    return {
      success: true,
    }
  } catch (error) {
    console.error('Password reset error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// ============================================================
// RESET PASSWORD
// ============================================================

/**
 * Complete a password reset from the one-time token carried by the email link.
 *
 * **The token is spent HERE, not when the link is opened.** The previous design
 * verified on GET at `/auth/callback`, which meant any GET consumed it — and
 * Gmail's link scanner issues one before the recipient ever clicks. Production
 * logs for 2026-09-11 show four `403 One-time token not found` hits from Google
 * IPs against a single recovery token. Supabase's own guidance is to "invalidate
 * the OTP token only after a user explicitly submits it, rather than upon
 * initial access of a confirmation URL"; this function is that submit step.
 *
 * Verifying here rather than on the link also means recovery no longer depends
 * on PKCE, whose code verifier lives in the cookies of the browser that
 * requested the reset — so the link now works when the mail is opened on a
 * different device, which is the common case for a password reset.
 *
 * @param tokenHash - `token_hash` from the email link (`{{ .TokenHash }}`).
 * @param newPassword - The already-validated new password.
 */
export async function resetPassword(
  tokenHash: string,
  newPassword: string
): Promise<AuthResponse<void>> {
  try {
    const supabase = await createClient()

    console.log('🔄 Attempting to reset password...')

    // Spending the one-time token establishes the session this update needs.
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    })

    if (verifyError || !data.user) {
      console.error('❌ Recovery token rejected:', verifyError?.message)
      return {
        success: false,
        error:
          'Invalid or expired password reset link. Please request a new one.',
      }
    }

    console.log(`✓ Recovery token verified for: ${data.user.email}`)

    // Update the password
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      console.error('❌ Password update failed:', error.message)
      return {
        success: false,
        error: 'Failed to reset password. Please try again.',
      }
    }

    // The session this function created exists only to authorise the update.
    // Leaving it live would strand the user signed in under the password they
    // just replaced, while the login screen tells them to sign in again.
    await supabase.auth.signOut()

    console.log('✅ Password reset successfully')

    return {
      success: true,
    }
  } catch (error) {
    console.error('Reset password error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// ============================================================
// UPDATE GYM INFORMATION
// ============================================================

export async function updateGymInfo(
  input: UpdateGymInfoInput
): Promise<AuthResponse<GymProfile>> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    const { data, error } = await supabase
      .from('gyms')
      .update({
        gym_name: input.gymName,
        gym_address: input.gymAddress || null,
        gym_website: input.gymWebsite || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !data) {
      return {
        success: false,
        error: 'Failed to update gym information',
      }
    }

    return {
      success: true,
      data: data as GymProfile,
    }
  } catch (error) {
    console.error('Update gym info error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// ============================================================
// UPDATE PASSWORD
// ============================================================

export async function updatePassword(
  input: UpdatePasswordInput
): Promise<AuthResponse<void>> {
  try {
    const supabase = await createClient()

    // Verify current password by attempting to re-authenticate
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    // Verify current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: input.currentPassword,
    })

    if (verifyError) {
      return {
        success: false,
        error: 'Current password is incorrect',
      }
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: input.newPassword,
    })

    if (updateError) {
      return {
        success: false,
        error: 'Failed to update password',
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error('Update password error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// ============================================================
// UPDATE EMAIL
// ============================================================

export async function updateEmail(
  newEmail: string
): Promise<AuthResponse<{ message: string }>> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    // Check if email already in use by another user
    const { data: existingGym } = await supabase
      .from('gyms')
      .select('id')
      .eq('email', newEmail)
      .neq('user_id', user.id)
      .single()

    if (existingGym) {
      return {
        success: false,
        error: 'Email already in use',
      }
    }

    // Update email in Supabase Auth (triggers verification email)
    const { error: updateError } = await supabase.auth.updateUser(
      {
        email: newEmail,
      },
      {
        // No `?next=` here. The callback decides the destination from the OTP
        // `type`, so this URL is byte-identical to the other two callers — which
        // means all three email templates can append `?token_hash=...` with the
        // same separator. The old form ended in a query string, so its template
        // alone needed `&`, and getting that one character wrong would have
        // silently produced a malformed link.
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      }
    )

    if (updateError) {
      // Handle rate limiting error
      if (
        updateError.message?.includes('email') &&
        updateError.status === 429
      ) {
        return {
          success: false,
          error:
            'Too many email update attempts. Please wait a few minutes before trying again.',
        }
      }

      return {
        success: false,
        error: 'Failed to update email',
      }
    }

    // Update email in gyms table and mark as unverified
    await supabase
      .from('gyms')
      .update({
        email: newEmail,
        email_verified: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return {
      success: true,
      data: {
        message:
          'Confirmation links sent to both your current and new address. The change takes effect once both are confirmed.',
      },
    }
  } catch (error) {
    console.error('Update email error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================
