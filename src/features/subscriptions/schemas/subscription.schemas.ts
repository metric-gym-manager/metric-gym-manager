/**
 * Zod schemas for the subscriptions feature.
 *
 * Domain enums are validated with z.nativeEnum (architecture §2.2) — never a
 * duplicate z.enum list.
 */

import { z } from 'zod';
import {
  saasTierSchema,
  saasStatusSchema,
  recurringFailureClassSchema,
  SaasTier,
  isPaidTier,
  type PaidTier,
} from '@/core/utils/constants/SubscriptionConfig';

export { saasTierSchema, saasStatusSchema, recurringFailureClassSchema };

/**
 * Checkout customer body. Everything except city has a server-side default
 * derived from the gym profile; explicit values override.
 *
 * `targetTier` selects WHICH paid plan is bought (domain enum per §2.2,
 * narrowed to paid tiers) — the PRICE is always resolved server-side from
 * config (amount-authority invariant). Defaults to Growth.
 */
export const checkoutCustomerSchema = z.object({
  city: z.string().min(1).max(100),
  targetTier: saasTierSchema
    .default(SaasTier.Growth)
    .refine(isPaidTier, { message: 'targetTier must be a paid tier' })
    .transform((t): PaidTier => t as PaidTier),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  address: z.string().min(1).max(200).optional(),
});

export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>;

/**
 * Billing-history query params.
 */
export const billingHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type BillingHistoryQuery = z.infer<typeof billingHistoryQuerySchema>;
