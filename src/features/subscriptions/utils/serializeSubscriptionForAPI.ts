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
  SaasTier,
  SaasStatus,
  FREE_TIER_MEMBER_LIMIT,
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
  graceEndsAt: string | null;
  grace_ends_at: string | null;
  pastDueReason: RecurringFailureClass | null;
  past_due_reason: RecurringFailureClass | null;
  canAddMember: boolean;
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
  const memberLimit = sub.tier === SaasTier.Free ? FREE_TIER_MEMBER_LIMIT : null;
  const graceEndsAt = toDateString(sub.graceEndsAt());
  const currentPeriodEnd = toDateString(sub.currentPeriodEnd);
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
    graceEndsAt,
    grace_ends_at: graceEndsAt,
    pastDueReason: reason,
    past_due_reason: reason,
    // Display-only flag: the FOR UPDATE-locked RPC is the real authority
    canAddMember: sub.canAddMember(now),
  };
}
