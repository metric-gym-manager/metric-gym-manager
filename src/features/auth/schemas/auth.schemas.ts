import { z } from 'zod'

export const RegisterUserSchema = z.object({
  gymId: z.string().uuid('Invalid gym ID'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  role: z.enum(['gym_owner', 'admin', 'trainer', 'front_desk']),
})

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export type RegisterUserInput = z.infer<typeof RegisterUserSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>
