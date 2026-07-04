import { serializeSubscriptionForAPI } from '@/features/subscriptions/utils/serializeSubscriptionForAPI';
import { Subscription } from '@/core/domain/subscription/Subscription';
import {
  SaasTier,
  SaasStatus,
  FREE_TIER_MEMBER_LIMIT,
  GRACE_PERIOD_DAYS,
  RecurringFailureClass,
} from '@/core/utils/constants/SubscriptionConfig';

function make(overrides: Partial<Parameters<typeof Subscription.create>[0]> = {}) {
  return Subscription.create({
    gymId: 'gym-1',
    tier: SaasTier.Free,
    status: SaasStatus.Active,
    memberCount: 10,
    currentPeriodEnd: null,
    payhereCustomerId: 'CUST-SECRET',
    payhereSubscriptionId: 'PHSUB-SECRET',
    ...overrides,
  });
}

describe('serializeSubscriptionForAPI', () => {
  it('emits dual camelCase + snake_case keys with equal values', () => {
    const out = serializeSubscriptionForAPI(make());
    expect(out.subscriptionTier).toBe(out.subscription_tier);
    expect(out.subscriptionStatus).toBe(out.subscription_status);
    expect(out.memberCount).toBe(out.member_count);
    expect(out.memberLimit).toBe(out.member_limit);
    expect(out.currentPeriodEnd).toBe(out.current_period_end);
    expect(out.graceEndsAt).toBe(out.grace_ends_at);
    expect(out.pastDueReason).toBe(out.past_due_reason);
  });

  it('formats dates as YYYY-MM-DD', () => {
    const out = serializeSubscriptionForAPI(
      make({
        tier: SaasTier.Pro,
        status: SaasStatus.Active,
        currentPeriodEnd: new Date('2026-08-15T13:45:00Z'),
      })
    );
    expect(out.currentPeriodEnd).toBe('2026-08-15');
  });

  it('exposes the member limit for Free and null for Pro', () => {
    expect(serializeSubscriptionForAPI(make()).memberLimit).toBe(FREE_TIER_MEMBER_LIMIT);
    expect(
      serializeSubscriptionForAPI(make({ tier: SaasTier.Pro, status: SaasStatus.Active }))
        .memberLimit
    ).toBeNull();
  });

  it('computes graceEndsAt only when past_due', () => {
    const periodEnd = new Date('2026-07-01T00:00:00Z');
    const pastDue = serializeSubscriptionForAPI(
      make({ tier: SaasTier.Pro, status: SaasStatus.PastDue, currentPeriodEnd: periodEnd })
    );
    expect(pastDue.graceEndsAt).toBe(`2026-07-0${1 + GRACE_PERIOD_DAYS}`);

    const active = serializeSubscriptionForAPI(
      make({ tier: SaasTier.Pro, status: SaasStatus.Active, currentPeriodEnd: periodEnd })
    );
    expect(active.graceEndsAt).toBeNull();
  });

  it('passes the sanitized failure class only when past_due', () => {
    const pastDue = serializeSubscriptionForAPI(
      make({
        tier: SaasTier.Pro,
        status: SaasStatus.PastDue,
        currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
      }),
      RecurringFailureClass.Retriable
    );
    expect(pastDue.pastDueReason).toBe(RecurringFailureClass.Retriable);

    const active = serializeSubscriptionForAPI(
      make({ tier: SaasTier.Pro, status: SaasStatus.Active }),
      RecurringFailureClass.Retriable // stale input must be dropped
    );
    expect(active.pastDueReason).toBeNull();
  });

  it('NEVER serializes gateway identifiers (C-24)', () => {
    const json = JSON.stringify(serializeSubscriptionForAPI(make()));
    expect(json).not.toContain('PHSUB-SECRET');
    expect(json).not.toContain('CUST-SECRET');
    expect(json).not.toContain('payhere');
  });

  it('computes the display-only canAddMember flag', () => {
    const now = new Date('2026-07-04T00:00:00Z');
    expect(
      serializeSubscriptionForAPI(make({ memberCount: FREE_TIER_MEMBER_LIMIT }), null, now)
        .canAddMember
    ).toBe(false);
    expect(
      serializeSubscriptionForAPI(make({ memberCount: 0 }), null, now).canAddMember
    ).toBe(true);
  });
});
