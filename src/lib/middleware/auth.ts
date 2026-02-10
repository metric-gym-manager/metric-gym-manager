import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Authentication payload returned by Supabase auth
 */
export interface AuthPayload {
  userId: string
  gymId: string
  role: 'gym_owner' | 'admin' | 'trainer' | 'front_desk'
  email: string
}

/**
 * Supabase authentication middleware for API routes
 * Authenticates user via Supabase session and fetches their profile
 *
 * @param request - Next.js request object
 * @returns AuthPayload with user details (userId, gymId, role, email)
 * @throws UnauthorizedError if user is not authenticated or profile not found
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const user = await authenticate(request)
 *   // user.userId, user.gymId, user.role, user.email
 * }
 * ```
 */
export async function authenticate(request: NextRequest): Promise<AuthPayload> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('Not authenticated')
  }

  // Fetch user profile from users table
  type UserProfile = {
    id: string
    gym_id: string
    email: string
    first_name: string
    last_name: string
    role: 'gym_owner' | 'admin' | 'trainer' | 'front_desk'
    is_active: boolean
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, gym_id, email, first_name, last_name, role, is_active')
    .eq('id', user.id)
    .single<UserProfile>()

  if (profileError || !profile) {
    throw new UnauthorizedError('User profile not found')
  }

  return {
    userId: user.id,
    gymId: profile.gym_id,
    role: profile.role,
    email: user.email || profile.email,
  }
}

/**
 * Role-based authorization middleware for Supabase auth
 * Returns a function that checks if the user has one of the allowed roles
 *
 * @param allowedRoles - Array of allowed role strings
 * @returns Async function that validates user role
 * @throws ForbiddenError if user doesn't have required role
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const user = await authenticate(request)
 *   await requireRole(['gym_owner', 'admin'])(user)
 *   // Proceed with protected logic
 * }
 * ```
 */
export function requireRole(allowedRoles: string[]) {
  return async (user: AuthPayload): Promise<void> => {
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`)
    }
  }
}

/**
 * Tenant isolation middleware for Supabase auth
 * Verifies that the authenticated user belongs to the requested gym
 *
 * @param gymId - The gym ID being accessed
 * @returns Async function that validates user's gym context
 * @throws ForbiddenError if user's gymId doesn't match requested gymId
 *
 * @example
 * ```typescript
 * export async function GET(
 *   request: NextRequest,
 *   { params }: { params: { gymId: string } }
 * ) {
 *   const user = await authenticate(request)
 *   await requireGymContext(params.gymId)(user)
 *   // Proceed with gym-specific logic
 * }
 * ```
 */
export function requireGymContext(gymId: string) {
  return async (user: AuthPayload): Promise<void> => {
    if (user.gymId !== gymId) {
      throw new ForbiddenError('Access denied to this gym resource')
    }
  }
}

// Error classes
export class UnauthorizedError extends Error {
  statusCode = 401
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  statusCode = 403
  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
  }
}
