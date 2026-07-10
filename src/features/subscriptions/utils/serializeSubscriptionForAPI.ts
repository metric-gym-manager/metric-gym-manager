/**
 * Subscription serialization for HTTP responses (architecture §2.11).
 *
 * Dates as YYYY-MM-DD, dual camelCase + snake_case keys — same convention as
 * serializeMemberForAPI. Gateway identifiers (payhere_subscription_id,
 * payhere_customer_id) are DELIBERATELY excluded: the client has no use for
 * them and they must never leak (plan C-24). Raw status_message never reaches
 * gym clients — only the sanitized RecurringFailureClass token (plan C-22).
 */

import { Subscription } from '@/core/domain/subscription/Subscription';
import {
  getPlanCapabilities,
  remainingMemberSlots,
  type RestrictedFeature,
} from '@/core/domain/subscription/PlanRestrictions';
import {
  SaasTier,
  SaasStatus,
  RecurringFailureClass,
} from '@/core/utils/constants/SubscriptionConfig';

export interface SerializedSubscription {
  subscriptionTier: SaasTier;
  subscription_tier: SaasTier;
  subscriptionStatus: SaasStatus;
  subscription_status: SaasStatus;
  memberCount: number;
  member_count: number;
  memberLimit: number | null;
  member_limit: number | null;
  currentPeriodEnd: string | null;
  current_period_end: string | null;
  /** Trial-window boundary; non-null only while trialing. */
  trialEndsAt: string | null;
  trial_ends_at: string | null;
  graceEndsAt: string | null;
  grace_ends_at: string | null;
  pastDueReason: RecurringFailureClass | null;
  past_due_reason: RecurringFailureClass | null;
  canAddMember: boolean;
  /** Feature switches from the PlanRestrictions matrix — UI gates read these, never local tier math. */
  capabilities: Record<RestrictedFeature, boolean>;
  remainingMemberSlots: number | null;
  remaining_member_slots: number | null;
  /** Lifetime/complimentary subscription — platform-managed; self-service billing controls are disabled. */
  isComplimentary: boolean;
  is_complimentary: boolean;
}

const toDateString = (d: Date | null): string | null =>
  d ? d.toISOString().split('T')[0] : null;

/**
 * Serialize a Subscription for API responses.
 *
 * @param sub - Subscription domain entity
 * @param pastDueReason - Sanitized failure class (only meaningful when past_due)
 * @param now - Clock for the canAddMember display flag (server time)
 */
export function serializeSubscriptionForAPI(
  sub: Subscription,
  pastDueReason: RecurringFailureClass | null = null,
  now: Date = new Date()
): SerializedSubscription {
  const capabilities = getPlanCapabilities(sub.tier);
  const memberLimit = capabilities.maxMembers;
  const remaining = remainingMemberSlots(sub.tier, sub.memberCount);
  const graceEndsAt = toDateString(sub.graceEndsAt());
  const currentPeriodEnd = toDateString(sub.currentPeriodEnd);
  // Like pastDueReason, the trial clock is only meaningful in its status.
  const trialEndsAt =
    sub.status === SaasStatus.Trialing ? toDateString(sub.trialEndsAt) : null;
  const reason = sub.status === SaasStatus.PastDue ? pastDueReason : null;

  return {
    subscriptionTier: sub.tier,
    subscription_tier: sub.tier,
    subscriptionStatus: sub.status,
    subscription_status: sub.status,
    memberCount: sub.memberCount,
    member_count: sub.memberCount,
    memberLimit,
    member_limit: memberLimit,
    currentPeriodEnd,
    current_period_end: currentPeriodEnd,
    trialEndsAt,
    trial_ends_at: trialEndsAt,
    graceEndsAt,
    grace_ends_at: graceEndsAt,
    pastDueReason: reason,
    past_due_reason: reason,
    // Display-only flag: the FOR UPDATE-locked RPC is the real authority
    canAddMember: sub.canAddMember(now),
    capabilities: {
      automatedReminders: capabilities.automatedReminders,
      announcements: capabilities.announcements,
      accessControlHardware: capabilities.accessControlHardware,
    },
    remainingMemberSlots: remaining,
    remaining_member_slots: remaining,
    isComplimentary: sub.isComplimentary(),
    is_complimentary: sub.isComplimentary(),
  };
}
