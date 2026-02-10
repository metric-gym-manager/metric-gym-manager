export interface User {
  id: string
  gymId: string
  email: string
  firstName: string
  lastName: string
  role: 'gym_owner' | 'admin' | 'trainer' | 'front_desk'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AuthResponse {
  user: User
  tokens: {
    accessToken: string
    refreshToken: string
    accessTokenExpiresAt: Date
    refreshTokenExpiresAt: Date
  }
}

/**
 * Supabase authentication types
 */
export interface SupabaseUser extends User {
  authId: string // ID from auth.users
}

export interface SupabaseAuthResponse {
  user: SupabaseUser
  session: {
    access_token: string
    refresh_token: string
    expires_at: number
    expires_in: number
    token_type: string
  } | null
}

export interface SupabaseSession {
  access_token: string
  refresh_token: string
  expires_at: number
  expires_in: number
  token_type: string
}
