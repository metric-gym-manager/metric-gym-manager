import { serializeSubscriptionForAPI } from '@/features/subscriptions/utils/serializeSubscriptionForAPI';
import { Subscription } from '@/core/domain/subscription/Subscription';
import {
  SaasTier,
  SaasStatus,
  STARTER_TIER_MEMBER_LIMIT,
  GROWTH_TIER_MEMBER_LIMIT,
  GRACE_PERIOD_DAYS,
  RecurringFailureClass,
} from '@/core/utils/constants/SubscriptionConfig';

function make(overrides: Partial<Parameters<typeof Subscription.create>[0]> = {}) {
  return Subscription.create({
    gymId: 'gym-1',
    tier: SaasTier.Starter,
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
        tier: SaasTier.Growth,
        status: SaasStatus.Active,
        currentPeriodEnd: new Date('2026-08-15T13:45:00Z'),
      })
    );
    expect(out.currentPeriodEnd).toBe('2026-08-15');
  });

  it('exposes the member limit per tier (Starter 40, Growth 150, Enterprise null)', () => {
    expect(serializeSubscriptionForAPI(make()).memberLimit).toBe(STARTER_TIER_MEMBER_LIMIT);
    expect(
      serializeSubscriptionForAPI(make({ tier: SaasTier.Growth, status: SaasStatus.Active }))
        .memberLimit
    ).toBe(GROWTH_TIER_MEMBER_LIMIT);
    expect(
      serializeSubscriptionForAPI(make({ tier: SaasTier.Enterprise, status: SaasStatus.Active }))
        .memberLimit
    ).toBeNull();
  });

  it('exposes plan capabilities from the PlanRestrictions matrix', () => {
    const starter = serializeSubscriptionForAPI(make());
    expect(starter.capabilities).toEqual({ automatedReminders: false, announcements: false });

    const growth = serializeSubscriptionForAPI(
      make({ tier: SaasTier.Growth, status: SaasStatus.Active })
    );
    expect(growth.capabilities).toEqual({ automatedReminders: true, announcements: true });
  });

  it('exposes remaining member slots (dual-key), clamped at zero, null for Growth', () => {
    const starter = serializeSubscriptionForAPI(make({ memberCount: 33 }));
    expect(starter.remainingMemberSlots).toBe(STARTER_TIER_MEMBER_LIMIT - 33);
    expect(starter.remaining_member_slots).toBe(starter.remainingMemberSlots);

    const overLimit = serializeSubscriptionForAPI(make({ memberCount: 218 }));
    expect(overLimit.remainingMemberSlots).toBe(0);

    const growth = serializeSubscriptionForAPI(
      make({ tier: SaasTier.Growth, status: SaasStatus.Active, memberCount: 100 })
    );
    expect(growth.remainingMemberSlots).toBe(GROWTH_TIER_MEMBER_LIMIT - 100);

    const enterprise = serializeSubscriptionForAPI(
      make({ tier: SaasTier.Enterprise, status: SaasStatus.Active, memberCount: 999 })
    );
    expect(enterprise.remainingMemberSlots).toBeNull();
  });

  it('computes graceEndsAt only when past_due', () => {
    const periodEnd = new Date('2026-07-01T00:00:00Z');
    const pastDue = serializeSubscriptionForAPI(
      make({ tier: SaasTier.Growth, status: SaasStatus.PastDue, currentPeriodEnd: periodEnd })
    );
    expect(pastDue.graceEndsAt).toBe(`2026-07-0${1 + GRACE_PERIOD_DAYS}`);

    const active = serializeSubscriptionForAPI(
      make({ tier: SaasTier.Growth, status: SaasStatus.Active, currentPeriodEnd: periodEnd })
    );
    expect(active.graceEndsAt).toBeNull();
  });

  it('passes the sanitized failure class only when past_due', () => {
    const pastDue = serializeSubscriptionForAPI(
      make({
        tier: SaasTier.Growth,
        status: SaasStatus.PastDue,
        currentPeriodEnd: new Date('2026-07-01T00:00:00Z'),
      }),
      RecurringFailureClass.Retriable
    );
    expect(pastDue.pastDueReason).toBe(RecurringFailureClass.Retriable);

    const active = serializeSubscriptionForAPI(
      make({ tier: SaasTier.Growth, status: SaasStatus.Active }),
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
      serializeSubscriptionForAPI(make({ memberCount: STARTER_TIER_MEMBER_LIMIT }), null, now)
        .canAddMember
    ).toBe(false);
    expect(
      serializeSubscriptionForAPI(make({ memberCount: 0 }), null, now).canAddMember
    ).toBe(true);
  });
});
