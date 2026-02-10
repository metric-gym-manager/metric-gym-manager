import { RegisterUserInput, LoginInput } from '../schemas/auth.schemas'
import { User, SupabaseAuthResponse, SupabaseSession, SupabaseUser } from '../types'
import { createClient } from '@/lib/supabase/server'

/**
 * Register a new user using Supabase Auth
 * Creates both an auth user and a profile in the users table
 *
 * @param input - User registration data including email, password, and profile info
 * @returns Combined auth user and profile data with session tokens
 * @throws Error if email already exists or registration fails
 *
 * @example
 * const result = await registerUser({
 *   gymId: '123e4567-...',
 *   email: 'user@example.com',
 *   password: 'SecurePass123',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   role: 'trainer'
 * });
 */
export async function registerUser(
  input: RegisterUserInput
): Promise<SupabaseAuthResponse> {
  const supabase = await createClient()

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        gym_id: input.gymId,
        first_name: input.firstName,
        last_name: input.lastName,
        role: input.role,
      },
    },
  })

  if (authError) {
    throw new Error(`Authentication error: ${authError.message}`)
  }

  if (!authData.user) {
    throw new Error('User creation failed: No user returned from auth')
  }

  // 2. Create profile in users table
  type UserProfile = {
    id: string
    gym_id: string
    email: string
    first_name: string
    last_name: string
    role: 'gym_owner' | 'admin' | 'trainer' | 'front_desk'
    is_active: boolean
    created_at: string
    updated_at: string
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id, // Same ID as auth.users
      gym_id: input.gymId,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      role: input.role,
    } as any)
    .select()
    .single<UserProfile>()

  if (profileError) {
    // If profile creation fails, we should clean up the auth user
    // Note: In production, consider using a database trigger or transaction
    throw new Error(`Profile creation error: ${profileError.message}`)
  }

  // 3. Combine auth user with profile data
  const supabaseUser: SupabaseUser = {
    id: profile.id,
    authId: authData.user.id,
    gymId: profile.gym_id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    role: profile.role,
    isActive: profile.is_active,
    createdAt: new Date(profile.created_at),
    updatedAt: new Date(profile.updated_at),
  }

  return {
    user: supabaseUser,
    session: authData.session
      ? {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at || 0,
          expires_in: authData.session.expires_in,
          token_type: authData.session.token_type,
        }
      : null,
  }
}

/**
 * Login user using Supabase Auth
 * Authenticates user and retrieves profile data from users table
 *
 * @param input - Login credentials (email and password)
 * @returns Combined auth user and profile data with session tokens
 * @throws Error if credentials are invalid or user is inactive
 *
 * @example
 * const result = await loginUser({
 *   email: 'user@example.com',
 *   password: 'SecurePass123'
 * });
 */
export async function loginUser(input: LoginInput): Promise<SupabaseAuthResponse> {
  const supabase = await createClient()

  // 1. Authenticate with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (authError) {
    throw new Error(`Authentication error: ${authError.message}`)
  }

  if (!authData.user) {
    throw new Error('Login failed: No user returned from auth')
  }

  // 2. Fetch user profile from users table
  type UserProfile = {
    id: string
    gym_id: string
    email: string
    first_name: string
    last_name: string
    role: 'gym_owner' | 'admin' | 'trainer' | 'front_desk'
    is_active: boolean
    created_at: string
    updated_at: string
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single<UserProfile>()

  if (profileError) {
    throw new Error(`Profile fetch error: ${profileError.message}`)
  }

  // 3. Check if user is active
  if (!profile.is_active) {
    throw new Error('Account is deactivated')
  }

  // 4. Combine auth user with profile data
  const supabaseUser: SupabaseUser = {
    id: profile.id,
    authId: authData.user.id,
    gymId: profile.gym_id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    role: profile.role,
    isActive: profile.is_active,
    createdAt: new Date(profile.created_at),
    updatedAt: new Date(profile.updated_at),
  }

  return {
    user: supabaseUser,
    session: authData.session
      ? {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at || 0,
          expires_in: authData.session.expires_in,
          token_type: authData.session.token_type,
        }
      : null,
  }
}

/**
 * Refresh the current Supabase session
 * Generates new access and refresh tokens
 *
 * @returns New session with updated tokens
 * @throws Error if session refresh fails
 *
 * @example
 * const newSession = await refreshSession();
 */
export async function refreshSession(): Promise<SupabaseSession> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.refreshSession()

  if (error) {
    throw new Error(`Session refresh error: ${error.message}`)
  }

  if (!data.session) {
    throw new Error('Session refresh failed: No session returned')
  }

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at || 0,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
  }
}

/**
 * Logout user using Supabase Auth
 * Signs out the current user and invalidates the session
 *
 * @throws Error if logout fails
 *
 * @example
 * await logoutUser();
 */
export async function logoutUser(): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(`Logout error: ${error.message}`)
  }
}

/**
 * Get the currently authenticated user with profile data
 * Retrieves session and joins with users table for full profile
 *
 * @returns Combined auth user and profile data, or null if not authenticated
 * @throws Error if profile fetch fails
 *
 * @example
 * const currentUser = await getUser();
 * if (currentUser) {
 *   console.log(`Welcome, ${currentUser.firstName}!`);
 * }
 */
export async function getUser(): Promise<SupabaseUser | null> {
  const supabase = await createClient()

  // 1. Get current session
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) {
    throw new Error(`Session error: ${sessionError.message}`)
  }

  if (!session || !session.user) {
    return null
  }

  // 2. Fetch user profile from users table
  type UserProfile = {
    id: string
    gym_id: string
    email: string
    first_name: string
    last_name: string
    role: 'gym_owner' | 'admin' | 'trainer' | 'front_desk'
    is_active: boolean
    created_at: string
    updated_at: string
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single<UserProfile>()

  if (profileError) {
    throw new Error(`Profile fetch error: ${profileError.message}`)
  }

  // 3. Combine auth user with profile data
  const supabaseUser: SupabaseUser = {
    id: profile.id,
    authId: session.user.id,
    gymId: profile.gym_id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    role: profile.role,
    isActive: profile.is_active,
    createdAt: new Date(profile.created_at),
    updatedAt: new Date(profile.updated_at),
  }

  return supabaseUser
}
