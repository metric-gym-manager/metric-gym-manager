/**
 * Payments Feature - Public API
 *
 * Gym-member payment collection and day passes. (SaaS platform billing lives
 * in features/subscriptions.)
 */

// Factories (compose use-cases for routes; wiring mirrors the old DI container)
export {
  createPaymentRepository,
  createCollectPayment,
  createIssueDayPass,
} from './services/factory';

// Use cases
export { CollectPayment } from './services/CollectPayment';
export { IssueDayPass } from './services/IssueDayPass';

// Domain
export { Payment, PaymentType } from './domain/Payment';
export { PaymentCalculator, type DiscountInfo } from './domain/PaymentCalculator';

// Port
export type { IPaymentRepository } from './services/IPaymentRepository';
