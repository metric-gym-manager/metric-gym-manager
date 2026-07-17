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
} from '@/features/subscriptions/config/SubscriptionConfig';

export { saasTierSchema, saasStatusSchema, recurringFailureClassSchema };

/**
 * Checkout customer body. Everything except city has a server-side default
 * derived from the gym profile; explicit values override.
 *
 * `targetTier` selects WHICH plan is bought (domain enum per §2.2 — every
 * tier is paid and checkoutable) — the PRICE is always resolved server-side
 * from config (amount-authority invariant). Defaults to Lite.
 */
export const checkoutCustomerSchema = z.object({
  city: z.string().min(1).max(100),
  targetTier: saasTierSchema.default(SaasTier.Lite),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  address: z.string().min(1).max(200).optional(),
});

export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>;

/**
 * One-click plan change body (POST /api/billing/change-plan). Only the
 * target tier — the price is resolved server-side (amount authority) and the
 * charge goes to the stored card token.
 */
export const changePlanSchema = z.object({
  targetTier: saasTierSchema,
});

export type ChangePlanInputBody = z.infer<typeof changePlanSchema>;

/**
 * Billing-history query params.
 */
export const billingHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type BillingHistoryQuery = z.infer<typeof billingHistoryQuerySchema>;
