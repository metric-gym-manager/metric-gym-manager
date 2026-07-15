import {
  PLAN_BADGE_COLORS,
  STATUS_BADGE_COLORS,
  getPlanBadgeColor,
  getStatusBadgeColor,
} from '../badge-colors';

describe('Badge Color Utilities', () => {
  describe('PLAN_BADGE_COLORS', () => {
    it('should have WCAG AA-compliant colors for all plan types', () => {
      expect(PLAN_BADGE_COLORS.daily).toContain('bg-orange');
      expect(PLAN_BADGE_COLORS.weekly).toContain('bg-yellow');
      expect(PLAN_BADGE_COLORS.monthly).toContain('bg-blue');
      expect(PLAN_BADGE_COLORS['3-months']).toContain('bg-indigo');
      expect(PLAN_BADGE_COLORS['6-months']).toContain('bg-purple');
      expect(PLAN_BADGE_COLORS.annual).toContain('bg-green');
    });

    it('should include text and border colors for all plan types', () => {
      Object.values(PLAN_BADGE_COLORS).forEach((colorClass) => {
        expect(colorClass).toMatch(/bg-\w+-100/);
        expect(colorClass).toMatch(/text-\w+-800/);
        expect(colorClass).toMatch(/border-\w+-200/);
      });
    });
  });

  describe('STATUS_BADGE_COLORS', () => {
    it('should have semantic colors for all status types', () => {
      expect(STATUS_BADGE_COLORS.active).toContain('bg-green');
      expect(STATUS_BADGE_COLORS.expired).toContain('bg-red');
      expect(STATUS_BADGE_COLORS.suspended).toContain('bg-yellow');
      expect(STATUS_BADGE_COLORS.cancelled).toContain('bg-orange');
    });

    it('should include text and border colors for all status types', () => {
      Object.values(STATUS_BADGE_COLORS).forEach((colorClass) => {
        expect(colorClass).toMatch(/bg-\w+-100/);
        expect(colorClass).toMatch(/text-\w+-800/);
        expect(colorClass).toMatch(/border-\w+-200/);
      });
    });
  });

  describe('getPlanBadgeColor', () => {
    it('should return correct color class for valid plan types', () => {
      expect(getPlanBadgeColor('daily')).toBe(PLAN_BADGE_COLORS.daily);
      expect(getPlanBadgeColor('monthly')).toBe(PLAN_BADGE_COLORS.monthly);
      expect(getPlanBadgeColor('annual')).toBe(PLAN_BADGE_COLORS.annual);
    });

    it('should return default gray color for unknown plan types', () => {
      expect(getPlanBadgeColor('unknown' as never)).toBe(
        'bg-gray-100 text-gray-800 border-gray-200'
      );
      expect(getPlanBadgeColor(null as never)).toBe(
        'bg-gray-100 text-gray-800 border-gray-200'
      );
      expect(getPlanBadgeColor(undefined as never)).toBe(
        'bg-gray-100 text-gray-800 border-gray-200'
      );
    });
  });

  describe('getStatusBadgeColor', () => {
    it('should return correct color class for valid status types', () => {
      expect(getStatusBadgeColor('active')).toBe(STATUS_BADGE_COLORS.active);
      expect(getStatusBadgeColor('expired')).toBe(STATUS_BADGE_COLORS.expired);
      expect(getStatusBadgeColor('suspended')).toBe(STATUS_BADGE_COLORS.suspended);
      expect(getStatusBadgeColor('cancelled')).toBe(STATUS_BADGE_COLORS.cancelled);
    });

    it('should return default gray color for unknown status types', () => {
      expect(getStatusBadgeColor('unknown' as never)).toBe(
        'bg-gray-100 text-gray-800 border-gray-200'
      );
      expect(getStatusBadgeColor(null as never)).toBe(
        'bg-gray-100 text-gray-800 border-gray-200'
      );
    });
  });
});
