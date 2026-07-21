/**
 * Auth Feature - Public API
 *
 * Gym-owner authentication: registration, login/logout, password + email
 * changes, password reset, and email-change confirmation. External code
 * should import from this file; reach into internal subfolders only from
 * within this feature.
 */

// ============================================================
// COMPONENTS
// ============================================================

export { AuthRecovery } from './components/AuthRecovery'

// ============================================================
// SERVICES
// ============================================================

export {
  registerGym,
  loginWithPassword,
  getCurrentSession,
  logout,
  sendPasswordResetEmail,
  resetPassword,
  updateGymInfo,
  updatePassword,
  updateEmail,
} from './services/auth.service'

export {
  logEmailConfirmationSent,
  markEmailConfirmed,
  resendEmailConfirmation,
  getEmailConfirmationStatus,
  verifyEmailChange,
  type VerifyEmailChangeResult,
} from './services/email-confirmation.service'

// ============================================================
// SCHEMAS
// ============================================================

export {
  registrationSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateGymInfoSchema,
  updateEmailSchema,
  updatePasswordSchema,
  type RegistrationInput,
  type LoginInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type UpdateGymInfoInput,
  type UpdateEmailInput,
  type UpdatePasswordInput,
} from './schemas/auth.schemas'

// ============================================================
// TYPES
// ============================================================

export type {
  AuthUser,
  GymProfile,
  SessionData,
  AuthResponse,
  LoginResponse,
  RegistrationResponse,
} from './types'
