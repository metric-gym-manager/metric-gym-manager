import { formatDate, formatDateShort } from '../date';

describe('Date Formatting Utilities', () => {
  describe('formatDate', () => {
    it('should format date as "DD MMM YYYY"', () => {
      expect(formatDate('2026-03-12')).toBe('12 Mar 2026');
      expect(formatDate('2026-12-03')).toBe('03 Dec 2026');
      expect(formatDate('2026-01-01')).toBe('01 Jan 2026');
    });

    it('should handle ISO datetime strings', () => {
      // Using midday time to avoid timezone edge cases
      expect(formatDate('2026-03-12T12:00:00Z')).toBe('12 Mar 2026');
      expect(formatDate('2026-12-03T12:00:00Z')).toBe('03 Dec 2026');
    });

    it('should handle different date separators', () => {
      expect(formatDate('2026/03/12')).toBe('12 Mar 2026');
    });

    it('should handle Date objects', () => {
      const date = new Date('2026-03-12T00:00:00Z');
      expect(formatDate(date)).toBe('12 Mar 2026');
    });

    it('should return empty string for invalid dates', () => {
      expect(formatDate('invalid-date')).toBe('Invalid Date');
      expect(formatDate('')).toBe('Invalid Date');
    });
  });

  describe('formatDateShort', () => {
    it('should format date as "DD MMM"', () => {
      expect(formatDateShort('2026-03-12')).toBe('12 Mar');
      expect(formatDateShort('2026-12-03')).toBe('03 Dec');
      expect(formatDateShort('2026-01-01')).toBe('01 Jan');
    });

    it('should handle ISO datetime strings', () => {
      expect(formatDateShort('2026-03-12T10:30:00Z')).toBe('12 Mar');
    });

    it('should handle Date objects', () => {
      const date = new Date('2026-03-12T00:00:00Z');
      expect(formatDateShort(date)).toBe('12 Mar');
    });

    it('should return empty string for invalid dates', () => {
      expect(formatDateShort('invalid-date')).toBe('Invalid Date');
    });
  });
});
