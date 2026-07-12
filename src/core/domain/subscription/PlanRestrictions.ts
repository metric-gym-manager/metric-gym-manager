/**
 * Plan restrictions — THE single source of truth for what each SaaS tier may
 * do. Every enforcement point (API routes, cron use cases, the subscription
 * serializer, UI gates) consumes this module; tier conditionals must never be
 * written anywhere else.
 *
 * Tier differentiators reduce to two axes:
 *   - member cap: Lite is capped (LITE_TIER_MEMBER_LIMIT); Pro/Enterprise
 *     are unlimited.
 *   - access-control hardware support: Enterprise only.
 *
 * `automatedReminders` and `announcements` are `true` for EVERY tier — the
 * keys are retained for forward-compat (future re-gating breaks compilation
 * here first), but no live branch gates on them anymore. Billing-status
 * gating (suspended accounts, expired trials) is a Subscription/status
 * concern, not a tier capability.
 *
 * Scope note: the Lite member CAP is ultimately enforced by the
 * FOR UPDATE-locked `assert_gym_can_add_active_member` SQL function (the
 * quota authority); `maxMembers` here mirrors it for display logic and
 * remaining-slot math, in lock-step via LITE_TIER_MEMBER_LIMIT.
 *
 * Pure domain: no I/O, no framework imports — unit-testable in isolation.
 */

import { SaasTier, LITE_TIER_MEMBER_LIMIT } from '@/core/utils/constants/SubscriptionConfig';

/** Feature keys that plans can switch off. Extend here — never with ad-hoc ifs. */
export type RestrictedFeature = 'automatedReminders' | 'announcements' | 'accessControlHardware';

export interface PlanCapabilities {
  /** Member cap (`null` = unlimited). Mirror of the SQL quota authority. */
  readonly maxMembers: number | null;
  /** Automated payment-reminder SMS (daily cron). Universal — kept for forward-compat. */
  readonly automatedReminders: boolean;
  /** Bulk SMS announcements (/make-announcement + POST /api/announcements). Universal — kept for forward-compat. */
  readonly announcements: boolean;
  /** Door/turnstile access-control hardware integration (Enterprise only). */
  readonly accessControlHardware: boolean;
}

/**
 * The capability matrix. `Record<SaasTier, ...>` on purpose: adding a tier to
 * the enum breaks compilation here until the matrix is extended.
 */
export const PLAN_CAPABILITIES: Record<SaasTier, PlanCapabilities> = {
  [SaasTier.Lite]: {
    maxMembers: LITE_TIER_MEMBER_LIMIT,
    automatedReminders: true,
    announcements: true,
    accessControlHardware: false,
  },
  [SaasTier.Pro]: {
    maxMembers: null,
    automatedReminders: true,
    announcements: true,
    accessControlHardware: false,
  },
  [SaasTier.Enterprise]: {
    maxMembers: null,
    automatedReminders: true,
    announcements: true,
    accessControlHardware: true,
  },
};

export function getPlanCapabilities(tier: SaasTier): PlanCapabilities {
  return PLAN_CAPABILITIES[tier];
}

export function isFeatureEnabled(tier: SaasTier, feature: RestrictedFeature): boolean {
  return PLAN_CAPABILITIES[tier][feature];
}

/**
 * Remaining member slots for display ("X of 100 member slots left").
 * `null` = unlimited (Pro/Enterprise). Clamped at zero: over-limit gyms
 * (e.g. grandfathered above the cap) keep their members but have no free
 * slots.
 */
export function remainingMemberSlots(tier: SaasTier, memberCount: number): number | null {
  const max = PLAN_CAPABILITIES[tier].maxMembers;
  if (max === null) return null;
  return Math.max(0, max - memberCount);
}
