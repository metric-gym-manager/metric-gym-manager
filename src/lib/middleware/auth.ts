import { NextRequest } from 'next/server'
import { verifyAccessToken, extractBearerToken, TokenPayload } from '@/lib/jwt/service'

export interface AuthenticatedRequest extends NextRequest {
  user: TokenPayload
}

/**
 * Authentication middleware for API routes
 */
export async function authenticate(request: NextRequest): Promise<TokenPayload> {
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader || '')

  if (!token) {
    throw new UnauthorizedError('No authentication token provided')
  }

  try {
    const payload = verifyAccessToken(token)
    return payload
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token')
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(allowedRoles: string[]) {
  return async (user: TokenPayload): Promise<void> => {
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`)
    }
  }
}

/**
 * Tenant isolation middleware
 */
export async function requireGymContext(user: TokenPayload, gymId: string): Promise<void> {
  if (user.gymId !== gymId) {
    throw new ForbiddenError('Access denied to this gym resource')
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
