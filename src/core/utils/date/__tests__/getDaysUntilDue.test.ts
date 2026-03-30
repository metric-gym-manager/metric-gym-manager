/**
 * Unit Tests for getDaysUntilDue
 *
 * Tests the calculation of days remaining until a due date
 */

import { getDaysUntilDue } from '../getDaysUntilDue';

describe('getDaysUntilDue', () => {
  // Mock current date for consistent testing
  const mockToday = new Date('2024-01-15T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockToday);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Future Dates', () => {
    it('should return 0 when due date is today', () => {
      const dueDate = new Date('2024-01-15T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(0);
    });

    it('should return 1 when due date is tomorrow', () => {
      const dueDate = new Date('2024-01-16T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(1);
    });

    it('should return 7 for 7-day reminder', () => {
      const dueDate = new Date('2024-01-22T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(7);
    });

    it('should return 3 for 3-day reminder', () => {
      const dueDate = new Date('2024-01-18T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(3);
    });

    it('should return 30 for a month away', () => {
      const dueDate = new Date('2024-02-14T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(30);
    });
  });

  describe('Past Dates (Overdue)', () => {
    it('should return -1 when due date was yesterday', () => {
      const dueDate = new Date('2024-01-14T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(-1);
    });

    it('should return -7 when 7 days overdue', () => {
      const dueDate = new Date('2024-01-08T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(-7);
    });

    it('should return -45 when 45 days overdue (cancellation threshold)', () => {
      const dueDate = new Date('2023-12-01T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(-45);
    });

    it('should return -100 for very old due dates', () => {
      const dueDate = new Date('2023-10-07T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(-100);
    });
  });

  describe('Time Independence', () => {
    it('should ignore time of day - midnight', () => {
      const dueDateMidnight = new Date('2024-01-20T00:00:00.000Z');
      expect(getDaysUntilDue(dueDateMidnight)).toBe(5);
    });

    it('should ignore time of day - noon', () => {
      const dueDateNoon = new Date('2024-01-20T12:00:00.000Z');
      expect(getDaysUntilDue(dueDateNoon)).toBe(5);
    });

    it('should ignore time of day - end of day', () => {
      // Use local date to avoid timezone issues
      const dueDateEndOfDay = new Date(2024, 0, 20, 23, 59, 59, 999);
      const expectedDays = getDaysUntilDue(dueDateEndOfDay);
      // Due date has same day as dueDateMidnight and dueDateNoon
      const dueDateMidnight = new Date(2024, 0, 20, 0, 0, 0, 0);
      expect(expectedDays).toBe(getDaysUntilDue(dueDateMidnight));
    });

    it('should treat same calendar day as 0 regardless of time', () => {
      // Set system time to a specific local date/time
      const today = new Date(2024, 0, 15, 1, 0, 0);
      jest.setSystemTime(today);
      // Due date is same calendar day but different time
      const dueDateEvening = new Date(2024, 0, 15, 23, 0, 0);
      expect(getDaysUntilDue(dueDateEvening)).toBe(0);
    });
  });

  describe('Month Boundaries', () => {
    it('should handle end of month correctly', () => {
      jest.setSystemTime(new Date('2024-01-31T00:00:00.000Z'));
      const dueDate = new Date('2024-02-01T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(1);
    });

    it('should handle leap year February correctly', () => {
      jest.setSystemTime(new Date('2024-02-28T00:00:00.000Z'));
      const dueDate = new Date('2024-02-29T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(1);
    });

    it('should handle year boundary correctly', () => {
      jest.setSystemTime(new Date('2024-12-31T00:00:00.000Z'));
      const dueDate = new Date('2025-01-01T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(1);
    });
  });

  describe('Input Format Variations', () => {
    it('should handle Date object', () => {
      const dueDate = new Date('2024-01-18T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(3);
    });

    it('should handle ISO string date', () => {
      const dueDate = new Date('2024-01-18');
      expect(getDaysUntilDue(dueDate)).toBe(3);
    });

    it('should handle date constructed from parts', () => {
      const dueDate = new Date(2024, 0, 18); // Month is 0-indexed
      expect(getDaysUntilDue(dueDate)).toBe(3);
    });
  });

  describe('Reminder Thresholds', () => {
    it('should correctly identify 7-day reminder threshold', () => {
      const dueDate = new Date('2024-01-22T00:00:00.000Z');
      const days = getDaysUntilDue(dueDate);
      expect(days).toBe(7);
      expect(days === 7).toBe(true); // Reminder should be sent
    });

    it('should correctly identify 3-day reminder threshold', () => {
      const dueDate = new Date('2024-01-18T00:00:00.000Z');
      const days = getDaysUntilDue(dueDate);
      expect(days).toBe(3);
      expect(days === 3).toBe(true); // Reminder should be sent
    });

    it('should correctly identify due-today threshold', () => {
      const dueDate = new Date('2024-01-15T00:00:00.000Z');
      const days = getDaysUntilDue(dueDate);
      expect(days).toBe(0);
      expect(days === 0).toBe(true); // Reminder should be sent
    });

    it('should not match reminder thresholds for other days', () => {
      const dueDate = new Date('2024-01-20T00:00:00.000Z');
      const days = getDaysUntilDue(dueDate);
      expect(days).toBe(5);
      expect(days === 7 || days === 3 || days === 0).toBe(false);
    });
  });

  describe('Use Case Scenarios', () => {
    it('should detect overdue members (negative days)', () => {
      const dueDate = new Date('2024-01-10T00:00:00.000Z');
      const days = getDaysUntilDue(dueDate);
      expect(days).toBe(-5);
      expect(days < 0).toBe(true); // Member is overdue
    });

    it('should detect members eligible for cancellation (-45 days)', () => {
      const dueDate = new Date('2023-12-01T00:00:00.000Z');
      const days = getDaysUntilDue(dueDate);
      expect(days).toBeLessThanOrEqual(-45);
    });

    it('should detect active members with future due dates', () => {
      const dueDate = new Date('2024-01-25T00:00:00.000Z');
      const days = getDaysUntilDue(dueDate);
      expect(days).toBe(10);
      expect(days > 0).toBe(true); // Member is active
    });
  });

  describe('Performance', () => {
    it('should handle 10,000 calculations efficiently', () => {
      const start = Date.now();

      for (let i = 0; i < 10000; i++) {
        const dueDate = new Date('2024-02-01T00:00:00.000Z');
        getDaysUntilDue(dueDate);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
    });
  });

  describe('Real-World Examples', () => {
    it('Example 1: Member paid on time, due in 25 days', () => {
      const dueDate = new Date('2024-02-09T00:00:00.000Z');
      expect(getDaysUntilDue(dueDate)).toBe(25);
    });

    it('Example 2: Member due today, should send reminder', () => {
      const dueDate = new Date('2024-01-15T00:00:00.000Z');
      const days = getDaysUntilDue(dueDate);
      expect(days).toBe(0);
      expect([0, 3, 7].includes(days)).toBe(true); // Reminder day
    });

    it('Example 3: Member 3 days overdue, should be marked expired', () => {
      const dueDate = new Date('2024-01-12T00:00:00.000Z');
      const days = getDaysUntilDue(dueDate);
      expect(days).toBe(-3);
      expect(days < 0).toBe(true); // Should be expired
    });

    it('Example 4: Member 50 days overdue, should be cancelled', () => {
      const dueDate = new Date('2023-11-26T00:00:00.000Z');
      const days = getDaysUntilDue(dueDate);
      expect(days).toBe(-50);
      expect(days <= -45).toBe(true); // Should be cancelled
    });
  });
});
