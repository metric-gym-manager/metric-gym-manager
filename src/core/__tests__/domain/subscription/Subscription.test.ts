import { Subscription, SubscriptionProps } from '@/core/domain/subscription/Subscription';
import {
  SaasTier,
  SaasStatus,
  STARTER_TIER_MEMBER_LIMIT,
  GROWTH_TIER_MEMBER_LIMIT,
  GRACE_PERIOD_DAYS,
} from '@/core/utils/constants/SubscriptionConfig';
import { InvalidStatusTransitionError } from '@/core/utils/errors';

const base: SubscriptionProps = {
  gymId: 'gym-1',
  tier: SaasTier.Starter,
  status: SaasStatus.Active,
  memberCount: 0,
  currentPeriodEnd: null,
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

  describe('activateGrowth', () => {
    it.each([
      ['free/active', SaasTier.Starter, SaasStatus.Active],
      ['free/canceled', SaasTier.Starter, SaasStatus.Canceled],
      ['pro/canceled (re-subscribe)', SaasTier.Growth, SaasStatus.Canceled],
    ])('activates from %s', (_label, tier, status) => {
      const next = sub({ tier, status }).activatePaid(SaasTier.Growth, {
        subscriptionId: 'SUB-B',
        customerId: 'CUST-1',
      });
      expect(next.tier).toBe(SaasTier.Growth);
      expect(next.status).toBe(SaasStatus.Active);
      expect(next.payhereSubscriptionId).toBe('SUB-B');
      expect(next.payhereCustomerId).toBe('CUST-1');
    });

    it('replaces the old subscription id on re-subscribe after voluntary cancel', () => {
      const next = sub({
        tier: SaasTier.Growth,
        status: SaasStatus.Canceled,
        payhereSubscriptionId: 'SUB-A',
      }).activatePaid(SaasTier.Growth, { subscriptionId: 'SUB-B', customerId: null });
      expect(next.payhereSubscriptionId).toBe('SUB-B');
    });

    it('keeps existing ids when input ids are null', () => {
      const next = sub({
        tier: SaasTier.Starter,
        status: SaasStatus.Canceled,
        payhereSubscriptionId: 'SUB-A',
        payhereCustomerId: 'CUST-A',
      }).activatePaid(SaasTier.Growth, { subscriptionId: null, customerId: null });
      expect(next.payhereSubscriptionId).toBe('SUB-A');
      expect(next.payhereCustomerId).toBe('CUST-A');
    });

    it.each([
      ['pro/active', SaasStatus.Active],
      ['pro/past_due', SaasStatus.PastDue],
    ])('rejects from %s (already subscribed)', (_label, status) => {
      expect(() =>
        sub({ tier: SaasTier.Growth, status }).activatePaid(SaasTier.Growth, { subscriptionId: 'X', customerId: null })
      ).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('renew (non-transition, §2.5.1)', () => {
    it('keeps active on on-time renewal', () => {
      const next = sub({ tier: SaasTier.Growth, status: SaasStatus.Active }).renew();
      expect(next.status).toBe(SaasStatus.Active);
      expect(next.tier).toBe(SaasTier.Growth);
    });

    it('recovers past_due to active', () => {
      const next = sub({ tier: SaasTier.Growth, status: SaasStatus.PastDue }).renew();
      expect(next.status).toBe(SaasStatus.Active);
    });

    it('rejects on pro/canceled — a stale installment must never un-cancel', () => {
      expect(() => sub({ tier: SaasTier.Growth, status: SaasStatus.Canceled }).renew()).toThrow(
        InvalidStatusTransitionError
      );
    });

    it('rejects on free tiers', () => {
      expect(() => sub().renew()).toThrow(InvalidStatusTransitionError);
      expect(() => sub({ status: SaasStatus.Canceled }).renew()).toThrow(
        InvalidStatusTransitionError
      );
    });
  });

  describe('markPastDue', () => {
    it('transitions pro/active to pro/past_due', () => {
      const next = sub({ tier: SaasTier.Growth, status: SaasStatus.Active }).markPastDue();
      expect(next.status).toBe(SaasStatus.PastDue);
      expect(next.tier).toBe(SaasTier.Growth);
    });

    it.each([
      ['pro/past_due', SaasTier.Growth, SaasStatus.PastDue],
      ['pro/canceled', SaasTier.Growth, SaasStatus.Canceled],
      ['free/active', SaasTier.Starter, SaasStatus.Active],
    ])('rejects from %s', (_label, tier, status) => {
      expect(() => sub({ tier, status }).markPastDue()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('cancelGrowth', () => {
    it('cancels from pro/active, keeping tier, period end and ids', () => {
      const next = sub({
        tier: SaasTier.Growth,
        status: SaasStatus.Active,
        currentPeriodEnd: periodEnd,
        payhereSubscriptionId: 'SUB-A',
      }).cancelPaid();
      expect(next.status).toBe(SaasStatus.Canceled);
      expect(next.tier).toBe(SaasTier.Growth);
      expect(next.currentPeriodEnd).toEqual(periodEnd);
      expect(next.payhereSubscriptionId).toBe('SUB-A');
    });

    it('cancels from pro/past_due', () => {
      const next = sub({ tier: SaasTier.Growth, status: SaasStatus.PastDue }).cancelPaid();
      expect(next.status).toBe(SaasStatus.Canceled);
    });

    it.each([
      ['free/active', SaasTier.Starter, SaasStatus.Active],
      ['pro/canceled (idempotence handled by use case)', SaasTier.Growth, SaasStatus.Canceled],
    ])('rejects from %s', (_label, tier, status) => {
      expect(() => sub({ tier, status }).cancelPaid()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('downgradeToStarter', () => {
    it.each([
      ['pro/past_due (grace expired)', SaasStatus.PastDue],
      ['pro/canceled (period ended)', SaasStatus.Canceled],
    ])('downgrades from %s and clears the subscription id', (_label, status) => {
      const next = sub({
        tier: SaasTier.Growth,
        status,
        payhereSubscriptionId: 'SUB-A',
      }).downgradeToStarter();
      expect(next.tier).toBe(SaasTier.Starter);
      expect(next.status).toBe(SaasStatus.Canceled);
      expect(next.payhereSubscriptionId).toBeNull();
    });

    it('rejects from pro/active', () => {
      expect(() =>
        sub({ tier: SaasTier.Growth, status: SaasStatus.Active }).downgradeToStarter()
      ).toThrow(InvalidStatusTransitionError);
    });

    it('rejects from free tiers', () => {
      expect(() => sub().downgradeToStarter()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('canAddMember (mirror of register_member_guarded)', () => {
    const now = new Date('2026-07-04T12:00:00Z');

    it('free below limit: allowed', () => {
      expect(sub({ memberCount: STARTER_TIER_MEMBER_LIMIT - 1 }).canAddMember(now)).toBe(true);
    });

    it('free at limit: blocked', () => {
      expect(sub({ memberCount: STARTER_TIER_MEMBER_LIMIT }).canAddMember(now)).toBe(false);
    });

    it('free far over limit (post-downgrade, e.g. 500): blocked', () => {
      expect(
        sub({ memberCount: 500, status: SaasStatus.Canceled }).canAddMember(now)
      ).toBe(false);
    });

    it('growth/active: allowed below the 190 cap, blocked at/over it', () => {
      expect(
        sub({ tier: SaasTier.Growth, status: SaasStatus.Active, memberCount: 189 }).canAddMember(now)
      ).toBe(true);
      expect(
        sub({
          tier: SaasTier.Growth,
          status: SaasStatus.Active,
          memberCount: GROWTH_TIER_MEMBER_LIMIT,
        }).canAddMember(now)
      ).toBe(false);
      expect(
        sub({ tier: SaasTier.Growth, status: SaasStatus.Active, memberCount: 5000 }).canAddMember(now)
      ).toBe(false);
    });

    it('enterprise/active: always allowed (unlimited)', () => {
      expect(
        sub({
          tier: SaasTier.Enterprise,
          status: SaasStatus.Active,
          memberCount: 5000,
        }).canAddMember(now)
      ).toBe(true);
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

    it('billed subscriptions are NOT complimentary', () => {
      expect(
        sub({
          tier: SaasTier.Enterprise,
          status: SaasStatus.Active,
          payhereSubscriptionId: 'PHSUB-1',
          currentPeriodEnd: new Date('2099-01-01'),
        }).isComplimentary()
      ).toBe(false);
      expect(sub({ tier: SaasTier.Starter }).isComplimentary()).toBe(false);
    });

    it('pro/past_due inside grace (day 6): allowed', () => {
      const s = sub({
        tier: SaasTier.Growth,
        status: SaasStatus.PastDue,
        currentPeriodEnd: daysFrom(now, -6),
      });
      expect(s.canAddMember(now)).toBe(true);
    });

    it('pro/past_due past grace (day GRACE+1): blocked', () => {
      const s = sub({
        tier: SaasTier.Growth,
        status: SaasStatus.PastDue,
        currentPeriodEnd: daysFrom(now, -(GRACE_PERIOD_DAYS + 1)),
      });
      expect(s.canAddMember(now)).toBe(false);
    });

    it('pro/past_due with null period end: blocked', () => {
      const s = sub({
        tier: SaasTier.Growth,
        status: SaasStatus.PastDue,
        currentPeriodEnd: null,
      });
      expect(s.canAddMember(now)).toBe(false);
    });

    it('pro/canceled paid-through: allowed until period end, no grace', () => {
      const paidThrough = sub({
        tier: SaasTier.Growth,
        status: SaasStatus.Canceled,
        currentPeriodEnd: daysFrom(now, 3),
      });
      expect(paidThrough.canAddMember(now)).toBe(true);

      const lapsed = sub({
        tier: SaasTier.Growth,
        status: SaasStatus.Canceled,
        currentPeriodEnd: daysFrom(now, -1),
      });
      expect(lapsed.canAddMember(now)).toBe(false);
    });
  });

  describe('grace helpers', () => {
    const now = new Date('2026-07-04T12:00:00Z');

    it('graceEndsAt = periodEnd + GRACE_PERIOD_DAYS when past_due', () => {
      const s = sub({
        tier: SaasTier.Growth,
        status: SaasStatus.PastDue,
        currentPeriodEnd: periodEnd,
      });
      expect(s.graceEndsAt()).toEqual(daysFrom(periodEnd, GRACE_PERIOD_DAYS));
    });

    it('graceEndsAt handles month boundaries', () => {
      const endOfMonth = new Date('2026-01-28T00:00:00Z');
      const s = sub({
        tier: SaasTier.Growth,
        status: SaasStatus.PastDue,
        currentPeriodEnd: endOfMonth,
      });
      expect(s.graceEndsAt()).toEqual(new Date('2026-02-04T00:00:00Z'));
    });

    it('graceEndsAt is null when not past_due', () => {
      expect(
        sub({ tier: SaasTier.Growth, status: SaasStatus.Active, currentPeriodEnd: periodEnd }).graceEndsAt()
      ).toBeNull();
    });

    it('isGraceExpired only past the grace boundary', () => {
      const inGrace = sub({
        tier: SaasTier.Growth,
        status: SaasStatus.PastDue,
        currentPeriodEnd: daysFrom(now, -6),
      });
      expect(inGrace.isGraceExpired(now)).toBe(false);

      const expired = sub({
        tier: SaasTier.Growth,
        status: SaasStatus.PastDue,
        currentPeriodEnd: daysFrom(now, -(GRACE_PERIOD_DAYS + 1)),
      });
      expect(expired.isGraceExpired(now)).toBe(true);
    });

    it('isPaidThrough tracks the period boundary', () => {
      const s = sub({
        tier: SaasTier.Growth,
        status: SaasStatus.Canceled,
        currentPeriodEnd: daysFrom(now, 1),
      });
      expect(s.isPaidThrough(now)).toBe(true);
      expect(s.isPaidThrough(daysFrom(now, 2))).toBe(false);
    });
  });

  describe('immutability', () => {
    it('transition methods return new instances; the source is untouched', () => {
      const original = sub({ tier: SaasTier.Growth, status: SaasStatus.Active });
      const next = original.markPastDue();
      expect(next).not.toBe(original);
      expect(original.status).toBe(SaasStatus.Active);
      expect(next.status).toBe(SaasStatus.PastDue);
    });

    it('toProps returns a defensive copy (mutating it does not affect the entity)', () => {
      const s = sub({ tier: SaasTier.Growth, status: SaasStatus.Active, currentPeriodEnd: periodEnd });
      const props = s.toProps();
      props.currentPeriodEnd!.setFullYear(2099);
      expect(s.currentPeriodEnd).toEqual(periodEnd);
    });
  });
});
