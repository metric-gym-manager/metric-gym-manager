import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  AuthResponse,
  AuthUser,
  GymProfile,
  LoginResponse,
  RegistrationResponse,
  SessionData,
} from '../types';
import type {
  LoginInput,
  RegistrationInput,
  UpdateGymInfoInput,
  UpdatePasswordInput,
} from '../schemas/auth.schemas';
import { SESSION_DURATION } from '../types';

// ============================================================
// REGISTRATION
// ============================================================

export async function registerGym(
  input: RegistrationInput
): Promise<AuthResponse<RegistrationResponse>> {
  try {
    const supabase = await createClient();

    // Check if username already exists
    const { data: existingUsername } = await supabase
      .from('gyms')
      .select('username')
      .eq('username', input.username)
      .single();

    if (existingUsername) {
      return {
        success: false,
        error: 'Username already taken',
      };
    }

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('gyms')
      .select('email')
      .eq('email', input.email)
      .single();

    if (existingEmail) {
      return {
        success: false,
        error: 'Email already registered',
      };
    }

    // Create auth user with Supabase Auth
    console.log(`📧 Creating new user account for: ${input.email}`);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: {
          username: input.username,
          gym_name: input.gymName,
          gym_address: input.gymAddress || '',
          gym_website: input.gymWebsite || '',
        },
      },
    });

    if (authError || !authData.user || !authData.user.email) {
      console.error('❌ User creation failed:', authError?.message);

      // Handle specific Supabase Auth errors
      if (authError?.message?.includes('already registered')) {
        return {
          success: false,
          error: 'Email already registered',
        };
      }

      return {
        success: false,
        error: authError?.message || 'Failed to create account',
      };
    }

    console.log(`✅ User created successfully. Verification email should be sent to: ${input.email}`);

    // Create gym profile immediately (allows login before email verification)
    // Use admin client to bypass RLS since user is not authenticated in this session yet
    const adminClient = createAdminClient();
    const { error: gymError } = await adminClient.from('gyms').insert({
      user_id: authData.user.id,
      username: input.username,
      email: input.email,
      email_verified: false, // Will be updated when they verify
      gym_name: input.gymName,
      gym_address: input.gymAddress || null,
      gym_website: input.gymWebsite || null,
    });

    if (gymError) {
      // If profile creation fails, clean up auth user
      console.error('❌ Gym profile creation failed:', gymError.message);
      await adminClient.auth.admin.deleteUser(authData.user.id);

      // Check for specific database errors
      if (gymError.code === '23505') { // PostgreSQL unique violation
        if (gymError.message.includes('email')) {
          return {
            success: false,
            error: 'Email already registered',
          };
        }
        if (gymError.message.includes('username')) {
          return {
            success: false,
            error: 'Username already taken',
          };
        }
      }

      return {
        success: false,
        error: 'Failed to create gym profile. Please try again.',
      };
    }

    // Get the created gym profile to initialize default plans
    const { data: gymProfile } = await adminClient
      .from('gyms')
      .select('id')
      .eq('user_id', authData.user.id)
      .single();

    console.log(`✅ Gym profile created successfully for: ${input.gymName}`);

    if (gymProfile) {
      // Initialize default plan types
      const defaultPlans = [
        { gym_id: gymProfile.id, plan_type: 'monthly', default_amount: 5000.0, is_active: true },
        { gym_id: gymProfile.id, plan_type: 'daily', default_amount: 300.0, is_active: true },
        { gym_id: gymProfile.id, plan_type: 'annual', default_amount: 50000.0, is_active: true },
      ];

      const { error: plansError } = await adminClient.from('plan_types').insert(defaultPlans);
      if (plansError) {
        console.error('⚠️  Failed to create default plan types:', plansError.message);
      } else {
        console.log('✅ Default plan types created');
      }
    }

    return {
      success: true,
      data: {
        user: authData.user as AuthUser,
        requiresEmailVerification: true,
        message: 'Registration successful! Please check your email to verify your account.',
      },
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during registration',
    };
  }
}

// ============================================================
// LOGIN WITH USERNAME/EMAIL + PASSWORD
// ============================================================

export async function loginWithPassword(
  input: LoginInput
): Promise<AuthResponse<LoginResponse>> {
  try {
    const supabase = await createClient();

    // Determine if input is email or username
    const isEmail = input.usernameOrEmail.includes('@');

    let email = input.usernameOrEmail;

    // If username, look up email
    if (!isEmail) {
      const { data: gymData } = await supabase
        .from('gyms')
        .select('email')
        .eq('username', input.usernameOrEmail)
        .single();

      if (!gymData) {
        return {
          success: false,
          error: 'Invalid username or password',
        };
      }

      email = gymData.email;
    }

    // Sign in with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password: input.password,
      });

    if (authError || !authData.user || !authData.user.email) {
      return {
        success: false,
        error: 'Invalid username or password',
      };
    }

    // Get gym profile
    const { data: gymProfile, error: gymError } = await supabase
      .from('gyms')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();

    if (gymError || !gymProfile) {
      return {
        success: false,
        error: 'Failed to load gym profile',
      };
    }

    // Update session duration based on "remember me"
    const sessionDuration = input.rememberMe
      ? SESSION_DURATION.REMEMBER_ME
      : SESSION_DURATION.DEFAULT;

    await supabase.auth.updateUser({
      data: { session_duration: sessionDuration },
    });

    return {
      success: true,
      data: {
        user: authData.user as AuthUser,
        gymProfile: gymProfile as GymProfile,
        requiresEmailVerification: !gymProfile.email_verified,
      },
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during login',
    };
  }
}

// ============================================================
// GET CURRENT SESSION
// ============================================================

export async function getCurrentSession(): Promise<SessionData | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return null;
    }

    const { data: gymProfile } = await supabase
      .from('gyms')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!gymProfile) {
      return null;
    }

    return {
      user: user as AuthUser,
      gymProfile: gymProfile as GymProfile,
    };
  } catch (error) {
    console.error('Get session error:', error);
    return null;
  }
}

// ============================================================
// LOGOUT
// ============================================================

export async function logout(): Promise<AuthResponse<void>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: 'Failed to sign out',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Logout error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during logout',
    };
  }
}

// ============================================================
// FORGOT PASSWORD
// ============================================================

export async function sendPasswordResetEmail(
  email: string
): Promise<AuthResponse<void>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    });

    if (error) {
      return {
        success: false,
        error: 'Failed to send password reset email',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Password reset error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// ============================================================
// RESET PASSWORD
// ============================================================

export async function resetPassword(
  newPassword: string
): Promise<AuthResponse<void>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return {
        success: false,
        error: 'Failed to reset password',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Reset password error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// ============================================================
// UPDATE GYM INFORMATION
// ============================================================

export async function updateGymInfo(
  input: UpdateGymInfoInput
): Promise<AuthResponse<GymProfile>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      };
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
      .single();

    if (error || !data) {
      return {
        success: false,
        error: 'Failed to update gym information',
      };
    }

    return {
      success: true,
      data: data as GymProfile,
    };
  } catch (error) {
    console.error('Update gym info error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// ============================================================
// UPDATE PASSWORD
// ============================================================

export async function updatePassword(
  input: UpdatePasswordInput
): Promise<AuthResponse<void>> {
  try {
    const supabase = await createClient();

    // Verify current password by attempting to re-authenticate
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    // Verify current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: input.currentPassword,
    });

    if (verifyError) {
      return {
        success: false,
        error: 'Current password is incorrect',
      };
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: input.newPassword,
    });

    if (updateError) {
      return {
        success: false,
        error: 'Failed to update password',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Update password error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// ============================================================
// UPDATE EMAIL
// ============================================================

export async function updateEmail(
  newEmail: string
): Promise<AuthResponse<{ message: string }>> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    // Check if email already in use by another user
    const { data: existingGym } = await supabase
      .from('gyms')
      .select('id')
      .eq('email', newEmail)
      .neq('user_id', user.id)
      .single();

    if (existingGym) {
      return {
        success: false,
        error: 'Email already in use',
      };
    }

    // Update email in Supabase Auth (triggers verification email)
    const { error: updateError } = await supabase.auth.updateUser(
      {
        email: newEmail,
      },
      {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/verify-email`,
      }
    );

    if (updateError) {
      // Handle rate limiting error
      if (updateError.message?.includes('email') && updateError.status === 429) {
        return {
          success: false,
          error: 'Too many email update attempts. Please wait a few minutes before trying again.',
        };
      }

      return {
        success: false,
        error: 'Failed to update email',
      };
    }

    // Update email in gyms table and mark as unverified
    await supabase
      .from('gyms')
      .update({
        email: newEmail,
        email_verified: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    return {
      success: true,
      data: {
        message: 'Verification email sent. Please check your inbox to confirm the new email address.',
      },
    };
  } catch (error) {
    console.error('Update email error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================
