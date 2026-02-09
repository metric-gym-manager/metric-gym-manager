import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'
import crypto from 'crypto'

export interface TokenPayload {
  userId: string
  gymId: string
  role: string
  email: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
}

const JWT_SECRET: string = process.env.JWT_SECRET || ''
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET || ''
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '15m'
const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT secrets must be defined in environment variables')
}

/**
 * Generate access and refresh token pair
 */
export function generateTokenPair(payload: TokenPayload): TokenPair {
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
    issuer: 'gym-management',
  })

  const refreshToken = jwt.sign({ userId: payload.userId, type: 'refresh' }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN as any,
    issuer: 'gym-management',
  })

  // Calculate expiration dates
  const accessTokenExpiresAt = new Date()
  accessTokenExpiresAt.setMinutes(accessTokenExpiresAt.getMinutes() + 15)

  const refreshTokenExpiresAt = new Date()
  refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 7)

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  }
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'gym-management',
    }) as TokenPayload & JwtPayload

    return {
      userId: decoded.userId,
      gymId: decoded.gymId,
      role: decoded.role,
      email: decoded.email,
    }
  } catch (error) {
    throw new Error('Invalid or expired access token')
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): { userId: string } {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'gym-management',
    }) as { userId: string; type: string } & JwtPayload

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type')
    }

    return { userId: decoded.userId }
  } catch (error) {
    throw new Error('Invalid or expired refresh token')
  }
}

/**
 * Hash refresh token for storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}
