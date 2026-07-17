import {
  PLAN_CAPABILITIES,
  getPlanCapabilities,
  isFeatureEnabled,
  remainingMemberSlots,
} from '@/features/subscriptions/domain/PlanRestrictions';
import { SaasTier, LITE_TIER_MEMBER_LIMIT } from '@/features/subscriptions/config/SubscriptionConfig';

describe('PlanRestrictions (the single source of tier capability rules)', () => {
  describe('capability matrix', () => {
    it('Lite: capped members (100); reminders and announcements universal; no hardware', () => {
      expect(PLAN_CAPABILITIES[SaasTier.Lite]).toEqual({
        maxMembers: LITE_TIER_MEMBER_LIMIT,
        automatedReminders: true,
        announcements: true,
        accessControlHardware: false,
      });
    });

    it('Pro: unlimited members; no hardware', () => {
      expect(PLAN_CAPABILITIES[SaasTier.Pro]).toEqual({
        maxMembers: null,
        automatedReminders: true,
        announcements: true,
        accessControlHardware: false,
      });
    });

    it('Enterprise: unlimited members + access-control hardware', () => {
      expect(PLAN_CAPABILITIES[SaasTier.Enterprise]).toEqual({
        maxMembers: null,
        automatedReminders: true,
        announcements: true,
        accessControlHardware: true,
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
      expect(getPlanCapabilities(SaasTier.Lite).maxMembers).toBe(LITE_TIER_MEMBER_LIMIT);
      expect(getPlanCapabilities(SaasTier.Pro).maxMembers).toBeNull();
    });
  });

  describe('isFeatureEnabled', () => {
    it.each([
      // Reminders and announcements are universal on the paid-only ladder.
      [SaasTier.Lite, 'automatedReminders', true],
      [SaasTier.Lite, 'announcements', true],
      [SaasTier.Pro, 'automatedReminders', true],
      [SaasTier.Pro, 'announcements', true],
      [SaasTier.Enterprise, 'announcements', true],
      // Access-control hardware is the sole remaining tier gate.
      [SaasTier.Lite, 'accessControlHardware', false],
      [SaasTier.Pro, 'accessControlHardware', false],
      [SaasTier.Enterprise, 'accessControlHardware', true],
    ] as const)('%s / %s -> %s', (tier, feature, expected) => {
      expect(isFeatureEnabled(tier, feature)).toBe(expected);
    });
  });

  describe('remainingMemberSlots', () => {
    it('Lite: limit minus current count', () => {
      expect(remainingMemberSlots(SaasTier.Lite, 0)).toBe(LITE_TIER_MEMBER_LIMIT);
      expect(remainingMemberSlots(SaasTier.Lite, 33)).toBe(LITE_TIER_MEMBER_LIMIT - 33);
    });

    it('Lite at/over the limit: clamps to zero (over-limit gyms keep members but add none)', () => {
      expect(remainingMemberSlots(SaasTier.Lite, LITE_TIER_MEMBER_LIMIT)).toBe(0);
      expect(remainingMemberSlots(SaasTier.Lite, 218)).toBe(0);
    });

    it('Pro and Enterprise: null (unlimited)', () => {
      expect(remainingMemberSlots(SaasTier.Pro, 250)).toBeNull();
      expect(remainingMemberSlots(SaasTier.Enterprise, 999)).toBeNull();
    });
  });
});
