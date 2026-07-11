import { Subscription, SubscriptionProps } from '@/core/domain/subscription/Subscription';
import {
  SaasTier,
  SaasStatus,
  LITE_TIER_MEMBER_LIMIT,
  GRACE_PERIOD_DAYS,
} from '@/core/utils/constants/SubscriptionConfig';
import { InvalidStatusTransitionError } from '@/core/utils/errors';

const base: SubscriptionProps = {
  gymId: 'gym-1',
  tier: SaasTier.Lite,
  status: SaasStatus.Active,
  memberCount: 0,
  currentPeriodEnd: null,
  trialEndsAt: null,
  payhereCustomerId: null,
  payhereSubscriptionId: null,
};

function sub(overrides: Partial<SubscriptionProps> = {}): Subscription {
  return Subscription.create({ ...base, ...overrides });
}

function daysFrom(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

describe('Subscription entity', () => {
  const periodEnd = new Date('2026-07-01T00:00:00Z');

  describe('activate (tier-agnostic; every tier is paid)', () => {
    it.each([
      ['lite/trialing', SaasTier.Lite, SaasStatus.Trialing, SaasTier.Pro],
      ['lite/suspended', SaasTier.Lite, SaasStatus.Suspended, SaasTier.Lite],
      ['pro/suspended', SaasTier.Pro, SaasStatus.Suspended, SaasTier.Pro],
      ['pro/canceled (re-subscribe)', SaasTier.Pro, SaasStatus.Canceled, SaasTier.Pro],
      ['enterprise/canceled (downgrade after cancel)', SaasTier.Enterprise, SaasStatus.Canceled, SaasTier.Lite],
    ])('activates from %s', (_label, tier, status, target) => {
      const next = sub({ tier, status }).activate(target, {
        subscriptionId: 'SUB-B',
        customerId: 'CUST-1',
      });
      expect(next.tier).toBe(target);
      expect(next.status).toBe(SaasStatus.Active);
      expect(next.payhereSubscriptionId).toBe('SUB-B');
      expect(next.payhereCustomerId).toBe('CUST-1');
    });

    it('replaces the old subscription id on re-subscribe after voluntary cancel', () => {
      const next = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.Canceled,
        payhereSubscriptionId: 'SUB-A',
      }).activate(SaasTier.Pro, { subscriptionId: 'SUB-B', customerId: null });
      expect(next.payhereSubscriptionId).toBe('SUB-B');
    });

    it('keeps existing ids when input ids are null', () => {
      const next = sub({
        tier: SaasTier.Lite,
        status: SaasStatus.Canceled,
        payhereSubscriptionId: 'SUB-A',
        payhereCustomerId: 'CUST-A',
      }).activate(SaasTier.Pro, { subscriptionId: null, customerId: null });
      expect(next.payhereSubscriptionId).toBe('SUB-A');
      expect(next.payhereCustomerId).toBe('CUST-A');
    });

    it.each([
      ['lite/active', SaasStatus.Active],
      ['lite/past_due', SaasStatus.PastDue],
    ])('rejects from %s (already subscribed)', (_label, status) => {
      expect(() =>
        sub({ tier: SaasTier.Lite, status }).activate(SaasTier.Pro, { subscriptionId: 'X', customerId: null })
      ).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('convertTrialToPaid', () => {
    it('converts a trialing account into the bought tier', () => {
      const next = sub({
        tier: SaasTier.Lite,
        status: SaasStatus.Trialing,
        trialEndsAt: daysFrom(periodEnd, 10),
      }).convertTrialToPaid(SaasTier.Enterprise, { subscriptionId: 'SUB-T', customerId: 'C-1' });
      expect(next.tier).toBe(SaasTier.Enterprise);
      expect(next.status).toBe(SaasStatus.Active);
      expect(next.payhereSubscriptionId).toBe('SUB-T');
    });

    it.each([
      ['active', SaasStatus.Active],
      ['suspended', SaasStatus.Suspended],
      ['canceled', SaasStatus.Canceled],
    ])('rejects from %s (only trialing converts)', (_label, status) => {
      expect(() =>
        sub({ status }).convertTrialToPaid(SaasTier.Lite, { subscriptionId: 'X', customerId: null })
      ).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('startTrial (platform re-trial)', () => {
    it.each([
      ['suspended', SaasStatus.Suspended],
      ['canceled', SaasStatus.Canceled],
    ])('starts a fresh trial clock from %s', (_label, status) => {
      const clock = new Date('2026-08-01T00:00:00Z');
      const next = sub({ status }).startTrial(clock);
      expect(next.status).toBe(SaasStatus.Trialing);
      expect(next.trialEndsAt).toEqual(clock);
    });

    it.each([
      ['active', SaasStatus.Active],
      ['past_due', SaasStatus.PastDue],
      ['trialing', SaasStatus.Trialing],
    ])('rejects from %s', (_label, status) => {
      expect(() => sub({ status }).startTrial(new Date())).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('renew (non-transition, §2.5.1)', () => {
    it('keeps active on on-time renewal', () => {
      const next = sub({ tier: SaasTier.Pro, status: SaasStatus.Active }).renew();
      expect(next.status).toBe(SaasStatus.Active);
      expect(next.tier).toBe(SaasTier.Pro);
    });

    it('recovers past_due to active', () => {
      const next = sub({ tier: SaasTier.Lite, status: SaasStatus.PastDue }).renew();
      expect(next.status).toBe(SaasStatus.Active);
    });

    it('rejects on canceled — a stale installment must never un-cancel', () => {
      expect(() => sub({ tier: SaasTier.Pro, status: SaasStatus.Canceled }).renew()).toThrow(
        InvalidStatusTransitionError
      );
    });

    it('rejects on trialing and suspended (those go through convert/activate/reactivate)', () => {
      expect(() => sub({ status: SaasStatus.Trialing }).renew()).toThrow(
        InvalidStatusTransitionError
      );
      expect(() => sub({ status: SaasStatus.Suspended }).renew()).toThrow(
        InvalidStatusTransitionError
      );
    });
  });

  describe('markPastDue', () => {
    it.each([SaasTier.Lite, SaasTier.Pro, SaasTier.Enterprise])(
      'transitions %s/active to past_due',
      (tier) => {
        const next = sub({ tier, status: SaasStatus.Active }).markPastDue();
        expect(next.status).toBe(SaasStatus.PastDue);
        expect(next.tier).toBe(tier);
      }
    );

    it.each([
      ['past_due', SaasStatus.PastDue],
      ['canceled', SaasStatus.Canceled],
      ['trialing', SaasStatus.Trialing],
      ['suspended', SaasStatus.Suspended],
    ])('rejects from %s', (_label, status) => {
      expect(() => sub({ status }).markPastDue()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('cancelPaid', () => {
    it('cancels from active, keeping tier, period end and ids', () => {
      const next = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.Active,
        currentPeriodEnd: periodEnd,
        payhereSubscriptionId: 'SUB-A',
      }).cancelPaid();
      expect(next.status).toBe(SaasStatus.Canceled);
      expect(next.tier).toBe(SaasTier.Pro);
      expect(next.currentPeriodEnd).toEqual(periodEnd);
      expect(next.payhereSubscriptionId).toBe('SUB-A');
    });

    it('cancels from past_due', () => {
      const next = sub({ tier: SaasTier.Lite, status: SaasStatus.PastDue }).cancelPaid();
      expect(next.status).toBe(SaasStatus.Canceled);
    });

    it.each([
      ['trialing', SaasStatus.Trialing],
      ['suspended', SaasStatus.Suspended],
      ['canceled (idempotence handled by use case)', SaasStatus.Canceled],
    ])('rejects from %s', (_label, status) => {
      expect(() => sub({ status }).cancelPaid()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('switchPlan (in-place tier change, §2.5.1 non-transition)', () => {
    it('changes the tier on an active subscription, keeping status, ids and period', () => {
      const next = sub({
        tier: SaasTier.Lite,
        status: SaasStatus.Active,
        currentPeriodEnd: periodEnd,
        payhereCustomerId: 'TOKEN-1',
      }).switchPlan(SaasTier.Pro);
      expect(next.tier).toBe(SaasTier.Pro);
      expect(next.status).toBe(SaasStatus.Active);
      expect(next.currentPeriodEnd).toEqual(periodEnd);
      expect(next.payhereCustomerId).toBe('TOKEN-1');
    });

    it('allows downgrades too (Pro -> Lite)', () => {
      const next = sub({ tier: SaasTier.Pro, status: SaasStatus.Active }).switchPlan(SaasTier.Lite);
      expect(next.tier).toBe(SaasTier.Lite);
    });

    it('rejects a no-op change to the same tier', () => {
      expect(() =>
        sub({ tier: SaasTier.Pro, status: SaasStatus.Active }).switchPlan(SaasTier.Pro)
      ).toThrow(InvalidStatusTransitionError);
    });

    it.each([
      ['trialing', SaasStatus.Trialing],
      ['past_due', SaasStatus.PastDue],
      ['suspended', SaasStatus.Suspended],
      ['canceled', SaasStatus.Canceled],
    ])('rejects from %s (only active switches in place)', (_label, status) => {
      expect(() => sub({ status }).switchPlan(SaasTier.Pro)).toThrow(
        InvalidStatusTransitionError
      );
    });
  });

  describe('suspend (tier PRESERVED — no landing tier)', () => {
    it.each([
      ['past_due (grace expired)', SaasStatus.PastDue],
      ['canceled (period ended)', SaasStatus.Canceled],
      ['trialing (trial expired)', SaasStatus.Trialing],
    ])('suspends from %s keeping tier and gateway id', (_label, status) => {
      const next = sub({
        tier: SaasTier.Pro,
        status,
        payhereSubscriptionId: 'SUB-A',
      }).suspend();
      expect(next.tier).toBe(SaasTier.Pro); // NO landing tier — tier preserved
      expect(next.status).toBe(SaasStatus.Suspended);
      expect(next.payhereSubscriptionId).toBe('SUB-A'); // retained for late-recovery reactivation
    });

    it.each([
      ['active', SaasStatus.Active],
      ['suspended', SaasStatus.Suspended],
    ])('rejects from %s', (_label, status) => {
      expect(() => sub({ status }).suspend()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('reactivate', () => {
    it('lifts a suspension back to active (tier preserved)', () => {
      const next = sub({ tier: SaasTier.Enterprise, status: SaasStatus.Suspended }).reactivate();
      expect(next.status).toBe(SaasStatus.Active);
      expect(next.tier).toBe(SaasTier.Enterprise);
    });

    it.each([
      ['active', SaasStatus.Active],
      ['past_due', SaasStatus.PastDue],
      ['canceled', SaasStatus.Canceled],
      ['trialing', SaasStatus.Trialing],
    ])('rejects from %s', (_label, status) => {
      expect(() => sub({ status }).reactivate()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('canAddMember (mirror of assert_gym_can_add_active_member)', () => {
    const now = new Date('2026-07-04T12:00:00Z');

    it('lite/active below limit: allowed', () => {
      expect(sub({ memberCount: LITE_TIER_MEMBER_LIMIT - 1 }).canAddMember(now)).toBe(true);
    });

    it('lite/active at limit: blocked', () => {
      expect(sub({ memberCount: LITE_TIER_MEMBER_LIMIT }).canAddMember(now)).toBe(false);
    });

    it('lite/trialing: allowed within cap, blocked at cap (full features during trial)', () => {
      expect(
        sub({ status: SaasStatus.Trialing, memberCount: LITE_TIER_MEMBER_LIMIT - 1 }).canAddMember(now)
      ).toBe(true);
      expect(
        sub({ status: SaasStatus.Trialing, memberCount: LITE_TIER_MEMBER_LIMIT }).canAddMember(now)
      ).toBe(false);
    });

    it('pro/active and enterprise/active: always allowed (unlimited)', () => {
      expect(
        sub({ tier: SaasTier.Pro, status: SaasStatus.Active, memberCount: 5000 }).canAddMember(now)
      ).toBe(true);
      expect(
        sub({
          tier: SaasTier.Enterprise,
          status: SaasStatus.Active,
          memberCount: 5000,
        }).canAddMember(now)
      ).toBe(true);
    });

    it('suspended: blocked on every tier regardless of count', () => {
      for (const tier of [SaasTier.Lite, SaasTier.Pro, SaasTier.Enterprise]) {
        expect(sub({ tier, status: SaasStatus.Suspended, memberCount: 0 }).canAddMember(now)).toBe(
          false
        );
      }
    });

    it('canceled: allowed within cap while paid-through, blocked after period end (no grace)', () => {
      const paidThrough = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.Canceled,
        currentPeriodEnd: daysFrom(now, 3),
      });
      expect(paidThrough.canAddMember(now)).toBe(true);

      const lapsed = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.Canceled,
        currentPeriodEnd: daysFrom(now, -1),
      });
      expect(lapsed.canAddMember(now)).toBe(false);

      const noPeriod = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.Canceled,
        currentPeriodEnd: null,
      });
      expect(noPeriod.canAddMember(now)).toBe(false);

      // The tier cap still applies inside the paid-through window
      expect(
        sub({
          tier: SaasTier.Lite,
          status: SaasStatus.Canceled,
          memberCount: LITE_TIER_MEMBER_LIMIT,
          currentPeriodEnd: daysFrom(now, 3),
        }).canAddMember(now)
      ).toBe(false);
    });

    it('complimentary enterprise (no gateway id, no period end): allowed and detected', () => {
      const comped = sub({
        tier: SaasTier.Enterprise,
        status: SaasStatus.Active,
        memberCount: 999,
        currentPeriodEnd: null,
        payhereSubscriptionId: null,
      });
      expect(comped.isComplimentary()).toBe(true);
      expect(comped.canAddMember(now)).toBe(true);
    });

    it('billed and trialing subscriptions are NOT complimentary', () => {
      expect(
        sub({
          tier: SaasTier.Enterprise,
          status: SaasStatus.Active,
          payhereSubscriptionId: 'PHSUB-1',
          currentPeriodEnd: new Date('2099-01-01'),
        }).isComplimentary()
      ).toBe(false);
      // Trialing rows also have no gateway id/period end — status keeps them out.
      expect(sub({ status: SaasStatus.Trialing }).isComplimentary()).toBe(false);
    });

    it('past_due inside grace (day 6): allowed within cap', () => {
      const s = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.PastDue,
        currentPeriodEnd: daysFrom(now, -6),
      });
      expect(s.canAddMember(now)).toBe(true);
    });

    it('past_due past grace (day GRACE+1): blocked', () => {
      const s = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.PastDue,
        currentPeriodEnd: daysFrom(now, -(GRACE_PERIOD_DAYS + 1)),
      });
      expect(s.canAddMember(now)).toBe(false);
    });

    it('past_due with null period end: blocked', () => {
      const s = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.PastDue,
        currentPeriodEnd: null,
      });
      expect(s.canAddMember(now)).toBe(false);
    });
  });

  describe('hasAccessControlHardware (Enterprise-only feature gate)', () => {
    it.each([
      [SaasTier.Lite, false],
      [SaasTier.Pro, false],
      [SaasTier.Enterprise, true],
    ])('%s -> %s', (tier, expected) => {
      expect(sub({ tier }).hasAccessControlHardware()).toBe(expected);
    });
  });

  describe('grace and trial helpers', () => {
    const now = new Date('2026-07-04T12:00:00Z');

    it('graceEndsAt = periodEnd + GRACE_PERIOD_DAYS when past_due', () => {
      const s = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.PastDue,
        currentPeriodEnd: periodEnd,
      });
      expect(s.graceEndsAt()).toEqual(daysFrom(periodEnd, GRACE_PERIOD_DAYS));
    });

    it('graceEndsAt handles month boundaries', () => {
      const endOfMonth = new Date('2026-01-28T00:00:00Z');
      const s = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.PastDue,
        currentPeriodEnd: endOfMonth,
      });
      expect(s.graceEndsAt()).toEqual(new Date('2026-02-04T00:00:00Z'));
    });

    it('graceEndsAt is null when not past_due', () => {
      expect(
        sub({ tier: SaasTier.Pro, status: SaasStatus.Active, currentPeriodEnd: periodEnd }).graceEndsAt()
      ).toBeNull();
    });

    it('isGraceExpired only past the grace boundary', () => {
      const inGrace = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.PastDue,
        currentPeriodEnd: daysFrom(now, -6),
      });
      expect(inGrace.isGraceExpired(now)).toBe(false);

      const expired = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.PastDue,
        currentPeriodEnd: daysFrom(now, -(GRACE_PERIOD_DAYS + 1)),
      });
      expect(expired.isGraceExpired(now)).toBe(true);
    });

    it('isTrialExpired tracks the trial clock while trialing', () => {
      expect(
        sub({ status: SaasStatus.Trialing, trialEndsAt: daysFrom(now, 1) }).isTrialExpired(now)
      ).toBe(false);
      expect(
        sub({ status: SaasStatus.Trialing, trialEndsAt: daysFrom(now, -1) }).isTrialExpired(now)
      ).toBe(true);
      // Only meaningful while trialing
      expect(
        sub({ status: SaasStatus.Active, trialEndsAt: daysFrom(now, -1) }).isTrialExpired(now)
      ).toBe(false);
      expect(sub({ status: SaasStatus.Trialing, trialEndsAt: null }).isTrialExpired(now)).toBe(
        false
      );
    });

    it('isPaidThrough tracks the period boundary', () => {
      const s = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.Canceled,
        currentPeriodEnd: daysFrom(now, 1),
      });
      expect(s.isPaidThrough(now)).toBe(true);
      expect(s.isPaidThrough(daysFrom(now, 2))).toBe(false);
    });
  });

  describe('immutability', () => {
    it('transition methods return new instances; the source is untouched', () => {
      const original = sub({ tier: SaasTier.Pro, status: SaasStatus.Active });
      const next = original.markPastDue();
      expect(next).not.toBe(original);
      expect(original.status).toBe(SaasStatus.Active);
      expect(next.status).toBe(SaasStatus.PastDue);
    });

    it('toProps returns a defensive copy (mutating it does not affect the entity)', () => {
      const s = sub({
        tier: SaasTier.Pro,
        status: SaasStatus.Active,
        currentPeriodEnd: periodEnd,
        trialEndsAt: periodEnd,
      });
      const props = s.toProps();
      props.currentPeriodEnd!.setFullYear(2099);
      props.trialEndsAt!.setFullYear(2099);
      expect(s.currentPeriodEnd).toEqual(periodEnd);
      expect(s.trialEndsAt).toEqual(periodEnd);
    });
  });
});
