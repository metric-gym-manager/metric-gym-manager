import { serializeSubscriptionForAPI } from '@/features/subscriptions/utils/serializeSubscriptionForAPI';
import { Subscription } from '@/features/subscriptions/domain/Subscription';
import {
  SaasTier,
  SaasStatus,
  LITE_TIER_MEMBER_LIMIT,
  GRACE_PERIOD_DAYS,
  RecurringFailureClass,
} from '@/features/subscriptions/config/SubscriptionConfig';

function make(overrides: Partial<Parameters<typeof Subscription.create>[0]> = {}) {
  return Subscription.create({
    gymId: 'gym-1',
    tier: SaasTier.Lite,
    status: SaasStatus.Active,
    memberCount: 10,
    currentPeriodEnd: null,
    trialEndsAt: null,
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
    expect(out.trialEndsAt).toBe(out.trial_ends_at);
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

  it('exposes the member limit per tier (Lite 100, Pro null, Enterprise null)', () => {
    expect(serializeSubscriptionForAPI(make()).memberLimit).toBe(LITE_TIER_MEMBER_LIMIT);
    expect(
      serializeSubscriptionForAPI(make({ tier: SaasTier.Pro, status: SaasStatus.Active }))
        .memberLimit
    ).toBeNull();
    expect(
      serializeSubscriptionForAPI(make({ tier: SaasTier.Enterprise, status: SaasStatus.Active }))
        .memberLimit
    ).toBeNull();
  });

  it('exposes plan capabilities from the PlanRestrictions matrix (incl. accessControlHardware)', () => {
    const lite = serializeSubscriptionForAPI(make());
    expect(lite.capabilities).toEqual({
      automatedReminders: true,
      announcements: true,
      accessControlHardware: false,
    });

    const enterprise = serializeSubscriptionForAPI(
      make({ tier: SaasTier.Enterprise, status: SaasStatus.Active })
    );
    expect(enterprise.capabilities).toEqual({
      automatedReminders: true,
      announcements: true,
      accessControlHardware: true,
    });
  });

  it('exposes remaining member slots (dual-key), clamped at zero, null for Pro/Enterprise', () => {
    const lite = serializeSubscriptionForAPI(make({ memberCount: 33 }));
    expect(lite.remainingMemberSlots).toBe(LITE_TIER_MEMBER_LIMIT - 33);
    expect(lite.remaining_member_slots).toBe(lite.remainingMemberSlots);

    const overLimit = serializeSubscriptionForAPI(make({ memberCount: 218 }));
    expect(overLimit.remainingMemberSlots).toBe(0);

    const pro = serializeSubscriptionForAPI(
      make({ tier: SaasTier.Pro, status: SaasStatus.Active, memberCount: 100 })
    );
    expect(pro.remainingMemberSlots).toBeNull();

    const enterprise = serializeSubscriptionForAPI(
      make({ tier: SaasTier.Enterprise, status: SaasStatus.Active, memberCount: 999 })
    );
    expect(enterprise.remainingMemberSlots).toBeNull();
  });

  it('exposes trialEndsAt only while trialing', () => {
    const clock = new Date('2026-07-20T10:00:00Z');
    const trialing = serializeSubscriptionForAPI(
      make({ status: SaasStatus.Trialing, trialEndsAt: clock })
    );
    expect(trialing.trialEndsAt).toBe('2026-07-20');
    expect(trialing.trial_ends_at).toBe('2026-07-20');

    // Stale clock on a converted (active) account must be dropped.
    const active = serializeSubscriptionForAPI(
      make({ status: SaasStatus.Active, trialEndsAt: clock })
    );
    expect(active.trialEndsAt).toBeNull();
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

  it('exposes hasSavedCard as a boolean only (token itself never serialized)', () => {
    const withToken = serializeSubscriptionForAPI(make());
    expect(withToken.hasSavedCard).toBe(true);
    expect(withToken.has_saved_card).toBe(true);

    const without = serializeSubscriptionForAPI(make({ payhereCustomerId: null }));
    expect(without.hasSavedCard).toBe(false);
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
      serializeSubscriptionForAPI(make({ memberCount: LITE_TIER_MEMBER_LIMIT }), null, now)
        .canAddMember
    ).toBe(false);
    expect(
      serializeSubscriptionForAPI(make({ memberCount: 0 }), null, now).canAddMember
    ).toBe(true);
    // Suspended: blocked regardless of count
    expect(
      serializeSubscriptionForAPI(make({ status: SaasStatus.Suspended, memberCount: 0 }), null, now)
        .canAddMember
    ).toBe(false);
  });
});
