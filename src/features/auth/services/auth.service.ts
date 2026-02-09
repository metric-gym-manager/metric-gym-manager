import { query, transaction, setUserContext } from '@/lib/db/client'
import { generateTokenPair, hashToken, TokenPair } from '@/lib/jwt/service'
import { hashPassword, verifyPassword } from './password.service'
import { RegisterUserInput, LoginInput } from '../schemas/auth.schemas'
import { User } from '../types'

/**
 * Register a new user
 */
export async function registerUser(input: RegisterUserInput): Promise<User> {
  return transaction(async (client) => {
    // Check if email already exists in this gym
    const existingUser = await client.query(
      'SELECT id FROM users WHERE gym_id = $1 AND email = $2',
      [input.gymId, input.email]
    )

    if (existingUser.rowCount && existingUser.rowCount > 0) {
      throw new Error('Email already registered in this gym')
    }

    // Hash password
    const passwordHash = await hashPassword(input.password)

    // Insert user
    const result = await client.query<User>(
      `INSERT INTO users (gym_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, gym_id as "gymId", email, first_name as "firstName",
                 last_name as "lastName", role, is_active as "isActive",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [input.gymId, input.email, passwordHash, input.firstName, input.lastName, input.role]
    )

    return result.rows[0]
  })
}

/**
 * Login user and generate tokens
 */
export async function loginUser(input: LoginInput): Promise<{
  user: User
  tokens: TokenPair
}> {
  return transaction(async (client) => {
    // Find user by email
    const result = await client.query<User & { password_hash: string }>(
      `SELECT id, gym_id as "gymId", email, password_hash, first_name as "firstName",
              last_name as "lastName", role, is_active as "isActive",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users
       WHERE email = $1`,
      [input.email]
    )

    if (result.rowCount === 0) {
      throw new Error('Invalid email or password')
    }

    const user = result.rows[0]

    // Verify password
    const isValidPassword = await verifyPassword(input.password, user.password_hash)
    if (!isValidPassword) {
      throw new Error('Invalid email or password')
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated')
    }

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.id,
      gymId: user.gymId,
      role: user.role,
      email: user.email,
    })

    // Store refresh token
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashToken(tokens.refreshToken), tokens.refreshTokenExpiresAt]
    )

    // Update last login
    await client.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id])

    // Remove password_hash from response
    const { password_hash, ...userWithoutPassword } = user

    return {
      user: userWithoutPassword,
      tokens,
    }
  })
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  return transaction(async (client) => {
    const tokenHash = hashToken(refreshToken)

    // Find refresh token
    const result = await client.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at,
              u.gym_id, u.role, u.email, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [tokenHash]
    )

    if (result.rowCount === 0) {
      throw new Error('Invalid refresh token')
    }

    const tokenData = result.rows[0]

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error('Refresh token expired')
    }

    // Check if token is revoked
    if (tokenData.revoked_at) {
      throw new Error('Refresh token has been revoked')
    }

    // Check if user is active
    if (!tokenData.is_active) {
      throw new Error('Account is deactivated')
    }

    // Generate new token pair
    const tokens = generateTokenPair({
      userId: tokenData.user_id,
      gymId: tokenData.gym_id,
      role: tokenData.role,
      email: tokenData.email,
    })

    // Revoke old refresh token
    await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [
      tokenData.id,
    ])

    // Store new refresh token
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenData.user_id, hashToken(tokens.refreshToken), tokens.refreshTokenExpiresAt]
    )

    return tokens
  })
}

/**
 * Logout user by revoking refresh token
 */
export async function logoutUser(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken)

  await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
    [tokenHash]
  )
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT id, gym_id as "gymId", email, first_name as "firstName",
            last_name as "lastName", role, is_active as "isActive",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM users
     WHERE id = $1`,
    [userId]
  )

  return result.rowCount && result.rowCount > 0 ? result.rows[0] : null
}
