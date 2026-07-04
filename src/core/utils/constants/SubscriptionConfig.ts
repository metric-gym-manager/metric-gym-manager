/**
 * SaaS Subscription Configuration — Free/Pro tiers (PayHere billing)
 *
 * Single source of truth for the SaaS billing domain enums and limits.
 * SQL literals in supabase/migrations/20260704000003_* carry comments
 * pointing back to the constants here — keep them in lock-step.
 *
 * Plan: docs/Payhere_subscritption_integration/payhere-subscription-execution-plan.md
 */

import { z } from 'zod';

/**
 * SaaS billing tier of a gym (tenant).
 * DB mirror: gyms.subscription_tier (text + CHECK, migration 20260704000001)
 */
export enum SaasTier {
  /**
   * Free tier: up to FREE_TIER_MEMBER_LIMIT members, no recurring billing
   */
  Free = 'free',

  /**
   * Pro tier: unlimited members, billed monthly via PayHere Recurring
   */
  Pro = 'pro',
}

/**
 * SaaS billing status of a gym.
 * DB mirror: gyms.subscription_status (text + CHECK, migration 20260704000001)
 */
export enum SaasStatus {
  /**
   * Billing in good standing (also the default state for Free gyms)
   */
  Active = 'active',

  /**
   * A recurring charge failed; grace period running (Pro only)
   */
  PastDue = 'past_due',

  /**
   * Voluntarily canceled (Pro: paid-through until period end) or
   * downgraded by dunning (Free: terminal record of the downgrade)
   */
  Canceled = 'canceled',
}

/**
 * Coarse decline classification (plan C-22).
 *
 * PayHere exposes no card-network decline codes — only status_code,
 * message_type and free-text status_message — so classification is
 * capture-first and deliberately two-valued until real gateway data
 * justifies more.
 */
export enum RecurringFailureClass {
  /**
   * -2 installment failed: PayHere retries automatically; UX = "ensure funds"
   */
  Retriable = 'retriable',

  /**
   * -3 chargedback, -1 canceled, RECURRING_STOPPED: no retry is coming
   */
  Hard = 'hard',
}

/** Free-tier member cap. SQL mirror: register_member_guarded (literal 50). */
export const FREE_TIER_MEMBER_LIMIT = 50;

/** Days of Pro access after a failed charge before dunning downgrades. SQL mirror: literal 7. */
export const GRACE_PERIOD_DAYS = 7;

/** PayHere Recurring API `recurrence` param. SQL mirror: interval '1 month'. */
export const PRO_BILLING_RECURRENCE = '1 Month';

/** PayHere Recurring API `duration` param. */
export const PRO_BILLING_DURATION = 'Forever';

/** Pending checkout intents older than this are expired by the dunning cron. */
export const CHECKOUT_INTENT_TTL_MINUTES = 30;

/** Post-redirect verification poll: total budget before PENDING_CONFIRMATION. */
export const PAYMENT_POLL_TIMEOUT_MS = 10_000;

/** Post-redirect verification poll: interval between polls. */
export const PAYMENT_POLL_INTERVAL_MS = 1_500;

/** Hourly bound on signature-invalid audit rows (plan C-20 write-amplification cap). */
export const INVALID_WEBHOOK_LOG_HOURLY_CAP = 100;

// §2.2: validation layer reuses the domain enums — never a duplicate z.enum list
export const saasTierSchema = z.nativeEnum(SaasTier);
export const saasStatusSchema = z.nativeEnum(SaasStatus);
export const recurringFailureClassSchema = z.nativeEnum(RecurringFailureClass);
