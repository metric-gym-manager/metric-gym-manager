/**
 * SaaS Subscription Configuration — Lite/Pro/Enterprise tiers (PayHere billing)
 *
 * Single source of truth for the SaaS billing domain enums and limits.
 * SQL literals in supabase/migrations/20260708000004_* (quota authority) and
 * 20260708000005/6 (dunning suspend, trial expiry) carry comments pointing
 * back to the constants here — keep them in lock-step.
 *
 * Tier history: launched as free/pro (migrations 20260704*), renamed to
 * starter/growth in 20260706000002, enterprise added in 20260707000001,
 * re-anchored to the PAID-ONLY Lite/Pro/Enterprise ladder in 20260708000003
 * (starter removed — onboarding is a trial STATUS now, not a free tier; the
 * string 'pro' is REUSED for the unlimited mid tier: the free-era 'pro' rows
 * were all renamed to 'growth' in 20260706000002, so the reuse is
 * collision-free).
 *
 * Every tier is paid: there is no free tier, no PAID_TIERS subset and no
 * isPaidTier() — dunning SUSPENDS (status change, tier preserved) instead of
 * downgrading to a free landing tier.
 *
 * Plan: docs/Payhere_subscritption_integration/payhere-subscription-execution-plan.md
 */

import { z } from 'zod';

/**
 * SaaS billing tier of a gym (tenant). All tiers are paid.
 * DB mirror: gyms.subscription_tier (text + CHECK, migration 20260708000003)
 */
export enum SaasTier {
  /**
   * Lite tier: up to LITE_TIER_MEMBER_LIMIT active members, billed monthly
   * via PayHere Recurring. The only capped tier.
   */
  Lite = 'lite',

  /**
   * Pro tier: unlimited active members, billed monthly via PayHere Recurring.
   */
  Pro = 'pro',

  /**
   * Enterprise tier: unlimited active members + access-control hardware
   * support, billed monthly via PayHere Recurring. May also be granted
   * complimentary (lifetime): no gateway subscription and no period end —
   * see Subscription.isComplimentary().
   */
  Enterprise = 'enterprise',
}

/**
 * SaaS billing status of a gym.
 * DB mirror: gyms.subscription_status (text + CHECK, migration 20260708000003)
 */
export enum SaasStatus {
  /**
   * New-gym onboarding window: full features for TRIAL_PERIOD_DAYS, no
   * gateway subscription yet. Checkout into any tier converts to active;
   * the trial-expiry cron suspends trials that never check out.
   */
  Trialing = 'trialing',

  /**
   * Billing in good standing
   */
  Active = 'active',

  /**
   * A recurring charge failed; grace period running
   */
  PastDue = 'past_due',

  /**
   * Account gated pending payment: set by the dunning cron (grace expired or
   * voluntary cancel lapsed) or the trial-expiry cron. Tier is PRESERVED —
   * there is no free landing tier. Repayment/checkout reactivates.
   */
  Suspended = 'suspended',

  /**
   * Voluntarily canceled: paid-through until period end, then the dunning
   * cron suspends.
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

/** Human display names for the tiers — the ONLY place UI copy derives them. */
export const TIER_DISPLAY_NAME: Record<SaasTier, string> = {
  [SaasTier.Lite]: 'Lite',
  [SaasTier.Pro]: 'Pro',
  [SaasTier.Enterprise]: 'Enterprise',
};

/** Lite-tier ACTIVE-member cap. SQL mirror: assert_gym_can_add_active_member (literal 100, migration 20260708000004). */
export const LITE_TIER_MEMBER_LIMIT = 100;

/** New-gym trial window. SQL mirror: trial_ends_at DEFAULT now() + 14 days (migration 20260708000003). */
export const TRIAL_PERIOD_DAYS = 14;

/** Days of paid access after a failed charge before dunning SUSPENDS. SQL mirror: literal 7. */
export const GRACE_PERIOD_DAYS = 7;

/** PayHere Recurring API `recurrence` param. SQL mirror: interval '1 month'. */
export const BILLING_RECURRENCE = '1 Month';

/** PayHere Recurring API `duration` param. */
export const BILLING_DURATION = 'Forever';

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
