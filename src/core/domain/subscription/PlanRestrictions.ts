/**
 * Plan restrictions — THE single source of truth for what each SaaS tier may
 * do. Every enforcement point (API routes, cron use cases, the subscription
 * serializer, UI gates) consumes this module; tier conditionals must never be
 * written anywhere else.
 *
 * Scope note: the Starter member CAP is ultimately enforced by the
 * FOR UPDATE-locked `register_member_guarded` SQL function (the quota
 * authority); `maxMembers` here mirrors it for display logic and remaining-
 * slot math, in lock-step via STARTER_TIER_MEMBER_LIMIT. Feature switches
 * (`automatedReminders`, `announcements`) are enforced server-side at their
 * API/cron entry points using this matrix.
 *
 * Pure domain: no I/O, no framework imports — unit-testable in isolation.
 */

import { SaasTier, STARTER_TIER_MEMBER_LIMIT } from '@/core/utils/constants/SubscriptionConfig';

/** Feature keys that plans can switch off. Extend here — never with ad-hoc ifs. */
export type RestrictedFeature = 'automatedReminders' | 'announcements';

export interface PlanCapabilities {
  /** Member cap (`null` = unlimited). Mirror of the SQL quota authority. */
  readonly maxMembers: number | null;
  /** Automated payment-reminder SMS (daily cron). */
  readonly automatedReminders: boolean;
  /** Bulk SMS announcements (/make-announcement + POST /api/announcements). */
  readonly announcements: boolean;
}

/**
 * The capability matrix. `Record<SaasTier, ...>` on purpose: adding a tier to
 * the enum breaks compilation here until the matrix is extended.
 */
export const PLAN_CAPABILITIES: Record<SaasTier, PlanCapabilities> = {
  [SaasTier.Starter]: {
    maxMembers: STARTER_TIER_MEMBER_LIMIT,
    automatedReminders: false,
    announcements: false,
  },
  [SaasTier.Growth]: {
    maxMembers: null,
    automatedReminders: true,
    announcements: true,
  },
};

export function getPlanCapabilities(tier: SaasTier): PlanCapabilities {
  return PLAN_CAPABILITIES[tier];
}

export function isFeatureEnabled(tier: SaasTier, feature: RestrictedFeature): boolean {
  return PLAN_CAPABILITIES[tier][feature];
}

/**
 * Remaining member slots for display ("X of 40 member slots left").
 * `null` = unlimited (Growth). Clamped at zero: over-limit Starter gyms
 * (post-downgrade) keep their members but have no free slots.
 */
export function remainingMemberSlots(tier: SaasTier, memberCount: number): number | null {
  const max = PLAN_CAPABILITIES[tier].maxMembers;
  if (max === null) return null;
  return Math.max(0, max - memberCount);
}
