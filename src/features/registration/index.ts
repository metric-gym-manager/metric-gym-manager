/**
 * Registration Feature - Public API
 *
 * QR-based member self-registration: per-gym join links, the public join
 * form, and the gym-facing QR management card.
 */

// ============================================================
// COMPONENTS
// ============================================================

export { default as JoinForm } from './components/JoinForm';
export { default as RegistrationQRCard } from './components/RegistrationQRCard';

// ============================================================
// SCHEMAS
// ============================================================

export {
  publicRegistrationSchema,
  type PublicRegistrationInput,
} from './schemas/registration.schemas';

// ============================================================
// TYPES
// ============================================================

export type {
  RegistrationLink,
  PublicPlanOption,
  PublicGymInfo,
  PublicRegistrationResult,
} from './types';
