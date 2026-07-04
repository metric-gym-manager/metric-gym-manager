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
} from '@/core/utils/constants/SubscriptionConfig';

export { saasTierSchema, saasStatusSchema, recurringFailureClassSchema };

/**
 * Checkout customer body. Everything except city has a server-side default
 * derived from the gym profile; explicit values override.
 */
export const checkoutCustomerSchema = z.object({
  city: z.string().min(1).max(100),
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
