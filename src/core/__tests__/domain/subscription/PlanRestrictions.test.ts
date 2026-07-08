import {
  PLAN_CAPABILITIES,
  getPlanCapabilities,
  isFeatureEnabled,
  remainingMemberSlots,
} from '@/core/domain/subscription/PlanRestrictions';
import { SaasTier, STARTER_TIER_MEMBER_LIMIT, GROWTH_TIER_MEMBER_LIMIT } from '@/core/utils/constants/SubscriptionConfig';

describe('PlanRestrictions (the single source of Starter restriction rules)', () => {
  describe('capability matrix', () => {
    it('Starter: capped members, no automated reminders, no announcements', () => {
      expect(PLAN_CAPABILITIES[SaasTier.Starter]).toEqual({
        maxMembers: STARTER_TIER_MEMBER_LIMIT,
        automatedReminders: false,
        announcements: false,
      });
    });

    it('Growth: capped members (150), everything else enabled', () => {
      expect(PLAN_CAPABILITIES[SaasTier.Growth]).toEqual({
        maxMembers: GROWTH_TIER_MEMBER_LIMIT,
        automatedReminders: true,
        announcements: true,
      });
    });

    it('Enterprise: unlimited members, everything enabled', () => {
      expect(PLAN_CAPABILITIES[SaasTier.Enterprise]).toEqual({
        maxMembers: null,
        automatedReminders: true,
        announcements: true,
      });
    });

    it('covers every tier in the SaasTier enum (adding a tier must extend the matrix)', () => {
      for (const tier of Object.values(SaasTier)) {
        expect(PLAN_CAPABILITIES[tier]).toBeDefined();
      }
    });
  });

  describe('getPlanCapabilities', () => {
    it('returns the matrix row for a tier', () => {
      expect(getPlanCapabilities(SaasTier.Starter).announcements).toBe(false);
      expect(getPlanCapabilities(SaasTier.Growth).announcements).toBe(true);
    });
  });

  describe('isFeatureEnabled', () => {
    it.each([
      [SaasTier.Starter, 'automatedReminders', false],
      [SaasTier.Starter, 'announcements', false],
      [SaasTier.Growth, 'automatedReminders', true],
      [SaasTier.Enterprise, 'announcements', true],
      [SaasTier.Growth, 'announcements', true],
    ] as const)('%s / %s -> %s', (tier, feature, expected) => {
      expect(isFeatureEnabled(tier, feature)).toBe(expected);
    });
  });

  describe('remainingMemberSlots', () => {
    it('Starter: limit minus current count', () => {
      expect(remainingMemberSlots(SaasTier.Starter, 0)).toBe(STARTER_TIER_MEMBER_LIMIT);
      expect(remainingMemberSlots(SaasTier.Starter, 33)).toBe(STARTER_TIER_MEMBER_LIMIT - 33);
    });

    it('Starter at/over the limit: clamps to zero (over-limit gyms keep members but add none)', () => {
      expect(remainingMemberSlots(SaasTier.Starter, STARTER_TIER_MEMBER_LIMIT)).toBe(0);
      expect(remainingMemberSlots(SaasTier.Starter, 218)).toBe(0);
    });

    it('Growth: capped at 150; Enterprise: null (unlimited)', () => {
      expect(remainingMemberSlots(SaasTier.Growth, 100)).toBe(GROWTH_TIER_MEMBER_LIMIT - 100);
      expect(remainingMemberSlots(SaasTier.Growth, 250)).toBe(0);
      expect(remainingMemberSlots(SaasTier.Enterprise, 999)).toBeNull();
    });
  });
});
