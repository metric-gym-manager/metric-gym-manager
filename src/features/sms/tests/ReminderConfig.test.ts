/**
 * Unit Tests for ReminderConfig
 *
 * Tests the centralized reminder business rules that determine
 * which reminders should be sent for each plan type
 */

import {
  shouldSendReminder,
  getReminderType,
  REMINDER_RULES,
  ReminderType,
} from '../config/ReminderConfig';
import { PlanType } from '@/features/members/config/PlanConfig';

describe('ReminderConfig', () => {
  describe('REMINDER_RULES Configuration', () => {
    it('should have rules defined for all plan types', () => {
      const planTypes = Object.values(PlanType);

      planTypes.forEach((planType) => {
        expect(REMINDER_RULES[planType]).toBeDefined();
        expect(REMINDER_RULES[planType].reminderDays).toBeDefined();
        expect(Array.isArray(REMINDER_RULES[planType].reminderDays)).toBe(true);
      });
    });

    it('should define no reminders for daily plans', () => {
      const rule = REMINDER_RULES[PlanType.Daily];
      expect(rule.reminderDays).toEqual([]);
      expect(rule.enabledReminders).toEqual([]);
    });

    it('should define 3-day and due-today reminders for monthly plans', () => {
      const rule = REMINDER_RULES[PlanType.Monthly];
      expect(rule.reminderDays).toContain(3);
      expect(rule.reminderDays).toContain(0);
      expect(rule.reminderDays).not.toContain(7); // Skip 7-day
      expect(rule.enabledReminders).toContain(ReminderType.ThreeDay);
      expect(rule.enabledReminders).toContain(ReminderType.DueToday);
      expect(rule.enabledReminders).not.toContain(ReminderType.SevenDay);
    });

    it('should define all reminders for weekly plans', () => {
      const rule = REMINDER_RULES[PlanType.Weekly];
      expect(rule.reminderDays).toContain(7);
      expect(rule.reminderDays).toContain(3);
      expect(rule.reminderDays).toContain(0);
      // 4 types: 7-day, 3-day, due-today, and overdue
      expect(rule.enabledReminders).toHaveLength(4);
    });

    it('should define all reminders for 3-month plans', () => {
      const rule = REMINDER_RULES[PlanType.ThreeMonths];
      expect(rule.reminderDays).toEqual([7, 3, 0]);
      // 4 types: 7-day, 3-day, due-today, and overdue
      expect(rule.enabledReminders).toHaveLength(4);
    });

    it('should define all reminders for 6-month plans', () => {
      const rule = REMINDER_RULES[PlanType.SixMonths];
      expect(rule.reminderDays).toEqual([7, 3, 0]);
      // 4 types: 7-day, 3-day, due-today, and overdue
      expect(rule.enabledReminders).toHaveLength(4);
    });

    it('should define all reminders for annual plans', () => {
      const rule = REMINDER_RULES[PlanType.Annual];
      expect(rule.reminderDays).toEqual([7, 3, 0]);
      // 4 types: 7-day, 3-day, due-today, and overdue
      expect(rule.enabledReminders).toHaveLength(4);
    });

    it('should define all reminders for custom plans', () => {
      const rule = REMINDER_RULES[PlanType.Custom];
      expect(rule.reminderDays).toEqual([7, 3, 0]);
      // 4 types: 7-day, 3-day, due-today, and overdue
      expect(rule.enabledReminders).toHaveLength(4);
    });
  });

  describe('shouldSendReminder', () => {
    describe('Daily Plans', () => {
      it('should not send reminder 7 days before', () => {
        expect(shouldSendReminder(PlanType.Daily, 7)).toBe(false);
      });

      it('should not send reminder 3 days before', () => {
        expect(shouldSendReminder(PlanType.Daily, 3)).toBe(false);
      });

      it('should not send reminder on due date', () => {
        expect(shouldSendReminder(PlanType.Daily, 0)).toBe(false);
      });

      it('should not send reminder for any days', () => {
        for (let days = 0; days <= 30; days++) {
          expect(shouldSendReminder(PlanType.Daily, days)).toBe(false);
        }
      });
    });

    describe('Monthly Plans', () => {
      it('should not send reminder 7 days before (skip 7-day)', () => {
        expect(shouldSendReminder(PlanType.Monthly, 7)).toBe(false);
      });

      it('should send reminder 3 days before', () => {
        expect(shouldSendReminder(PlanType.Monthly, 3)).toBe(true);
      });

      it('should send reminder on due date', () => {
        expect(shouldSendReminder(PlanType.Monthly, 0)).toBe(true);
      });

      it('should not send reminder on other days', () => {
        expect(shouldSendReminder(PlanType.Monthly, 1)).toBe(false);
        expect(shouldSendReminder(PlanType.Monthly, 2)).toBe(false);
        expect(shouldSendReminder(PlanType.Monthly, 4)).toBe(false);
        expect(shouldSendReminder(PlanType.Monthly, 5)).toBe(false);
        expect(shouldSendReminder(PlanType.Monthly, 6)).toBe(false);
        expect(shouldSendReminder(PlanType.Monthly, 8)).toBe(false);
      });
    });

    describe('Weekly Plans', () => {
      it('should send reminder 7 days before', () => {
        expect(shouldSendReminder(PlanType.Weekly, 7)).toBe(true);
      });

      it('should send reminder 3 days before', () => {
        expect(shouldSendReminder(PlanType.Weekly, 3)).toBe(true);
      });

      it('should send reminder on due date', () => {
        expect(shouldSendReminder(PlanType.Weekly, 0)).toBe(true);
      });

      it('should not send reminder on other days', () => {
        expect(shouldSendReminder(PlanType.Weekly, 1)).toBe(false);
        expect(shouldSendReminder(PlanType.Weekly, 2)).toBe(false);
        expect(shouldSendReminder(PlanType.Weekly, 4)).toBe(false);
        expect(shouldSendReminder(PlanType.Weekly, 5)).toBe(false);
        expect(shouldSendReminder(PlanType.Weekly, 6)).toBe(false);
      });
    });

    describe('Long-term Plans (3-month, 6-month, Annual, Custom)', () => {
      const longTermPlans = [
        PlanType.ThreeMonths,
        PlanType.SixMonths,
        PlanType.Annual,
        PlanType.Custom,
      ];

      longTermPlans.forEach((planType) => {
        describe(`${planType}`, () => {
          it('should send reminder 7 days before', () => {
            expect(shouldSendReminder(planType, 7)).toBe(true);
          });

          it('should send reminder 3 days before', () => {
            expect(shouldSendReminder(planType, 3)).toBe(true);
          });

          it('should send reminder on due date', () => {
            expect(shouldSendReminder(planType, 0)).toBe(true);
          });

          it('should not send reminder on other days', () => {
            expect(shouldSendReminder(planType, 1)).toBe(false);
            expect(shouldSendReminder(planType, 2)).toBe(false);
            expect(shouldSendReminder(planType, 4)).toBe(false);
            expect(shouldSendReminder(planType, 6)).toBe(false);
            expect(shouldSendReminder(planType, 10)).toBe(false);
          });
        });
      });
    });

    describe('Overdue Dates (Negative Days)', () => {
      it('should not send reminder for overdue daily plans', () => {
        expect(shouldSendReminder(PlanType.Daily, -1)).toBe(false);
        expect(shouldSendReminder(PlanType.Daily, -10)).toBe(false);
      });

      it('should send overdue reminder for monthly plans', () => {
        // Monthly plans have Overdue enabled
        expect(shouldSendReminder(PlanType.Monthly, -1)).toBe(true);
        expect(shouldSendReminder(PlanType.Monthly, -10)).toBe(true);
      });

      it('should send overdue reminder for weekly plans', () => {
        // Weekly plans have Overdue enabled
        expect(shouldSendReminder(PlanType.Weekly, -1)).toBe(true);
        expect(shouldSendReminder(PlanType.Weekly, -7)).toBe(true);
      });

      it('should NOT send overdue reminder for daily plans', () => {
        // Daily plans have no reminders enabled
        expect(shouldSendReminder(PlanType.Daily, -1)).toBe(false);
        expect(shouldSendReminder(PlanType.Daily, -7)).toBe(false);
      });
    });

    describe('Far Future Dates', () => {
      it('should not send reminder 30 days before for monthly plans', () => {
        expect(shouldSendReminder(PlanType.Monthly, 30)).toBe(false);
      });

      it('should not send reminder 90 days before for annual plans', () => {
        expect(shouldSendReminder(PlanType.Annual, 90)).toBe(false);
      });

      it('should not send reminder 365 days before', () => {
        expect(shouldSendReminder(PlanType.Annual, 365)).toBe(false);
      });
    });
  });

  describe('getReminderType', () => {
    it('should return 7-day reminder type for 7 days until due', () => {
      expect(getReminderType(7)).toBe(ReminderType.SevenDay);
    });

    it('should return 3-day reminder type for 3 days until due', () => {
      expect(getReminderType(3)).toBe(ReminderType.ThreeDay);
    });

    it('should return due-today reminder type for 0 days until due', () => {
      expect(getReminderType(0)).toBe(ReminderType.DueToday);
    });

    it('should return null for non-reminder days', () => {
      expect(getReminderType(1)).toBeNull();
      expect(getReminderType(2)).toBeNull();
      expect(getReminderType(4)).toBeNull();
      expect(getReminderType(5)).toBeNull();
      expect(getReminderType(6)).toBeNull();
      expect(getReminderType(8)).toBeNull();
      expect(getReminderType(10)).toBeNull();
    });

    it('should return overdue type for overdue dates', () => {
      expect(getReminderType(-1)).toBe(ReminderType.Overdue);
      expect(getReminderType(-7)).toBe(ReminderType.Overdue);
      expect(getReminderType(-30)).toBe(ReminderType.Overdue);
    });

    it('should return null for far future dates', () => {
      expect(getReminderType(30)).toBeNull();
      expect(getReminderType(90)).toBeNull();
      expect(getReminderType(365)).toBeNull();
    });
  });

  describe('Business Logic Scenarios', () => {
    it('Scenario 1: Daily plan member - no reminders ever', () => {
      // Daily plans don't get reminders (too frequent)
      const planType = PlanType.Daily;
      expect(shouldSendReminder(planType, 7)).toBe(false);
      expect(shouldSendReminder(planType, 3)).toBe(false);
      expect(shouldSendReminder(planType, 0)).toBe(false);
    });

    it('Scenario 2: Monthly plan member - only 3-day and due-today', () => {
      // Monthly plans skip 7-day reminder (cycle too short)
      const planType = PlanType.Monthly;
      expect(shouldSendReminder(planType, 7)).toBe(false);
      expect(shouldSendReminder(planType, 3)).toBe(true);
      expect(shouldSendReminder(planType, 0)).toBe(true);
    });

    it('Scenario 3: Annual plan member - all three reminders', () => {
      // Long-term plans get full reminder sequence
      const planType = PlanType.Annual;
      expect(shouldSendReminder(planType, 7)).toBe(true);
      expect(shouldSendReminder(planType, 3)).toBe(true);
      expect(shouldSendReminder(planType, 0)).toBe(true);
    });

    it('Scenario 4: Overdue member - overdue reminders sent', () => {
      // Overdue members get overdue reminders (for plans that have them)
      expect(shouldSendReminder(PlanType.Monthly, -1)).toBe(true);
      expect(shouldSendReminder(PlanType.Annual, -5)).toBe(true);
      // Daily plans don't have any reminders
      expect(shouldSendReminder(PlanType.Daily, -1)).toBe(false);
    });

    it('Scenario 5: Member with 10 days until due - no reminder yet', () => {
      // Wait until 7-day threshold
      expect(shouldSendReminder(PlanType.Annual, 10)).toBe(false);
      expect(shouldSendReminder(PlanType.Monthly, 10)).toBe(false);
    });
  });

  describe('Idempotency', () => {
    it('should return consistent results for same inputs', () => {
      const result1 = shouldSendReminder(PlanType.Monthly, 3);
      const result2 = shouldSendReminder(PlanType.Monthly, 3);
      const result3 = shouldSendReminder(PlanType.Monthly, 3);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      expect(result1).toBe(true);
    });

    it('should handle multiple rapid calls without side effects', () => {
      for (let i = 0; i < 1000; i++) {
        expect(shouldSendReminder(PlanType.Weekly, 7)).toBe(true);
      }
    });
  });

  describe('Integration with Use Cases', () => {
    it('should work with SendAutomatedReminders workflow', () => {
      // Simulate SendAutomatedReminders use case logic
      const activeMembers = [
        { planType: PlanType.Daily, daysUntilDue: 3 },
        { planType: PlanType.Monthly, daysUntilDue: 7 },
        { planType: PlanType.Monthly, daysUntilDue: 3 },
        { planType: PlanType.Annual, daysUntilDue: 7 },
        { planType: PlanType.Annual, daysUntilDue: 0 },
      ];

      const shouldSend = activeMembers.map((member) => ({
        ...member,
        shouldSend: shouldSendReminder(member.planType, member.daysUntilDue),
      }));

      // Expected results based on business rules
      expect(shouldSend[0].shouldSend).toBe(false); // Daily - never
      expect(shouldSend[1].shouldSend).toBe(false); // Monthly - skip 7-day
      expect(shouldSend[2].shouldSend).toBe(true);  // Monthly - 3-day ✓
      expect(shouldSend[3].shouldSend).toBe(true);  // Annual - 7-day ✓
      expect(shouldSend[4].shouldSend).toBe(true);  // Annual - due-today ✓

      const totalToSend = shouldSend.filter((m) => m.shouldSend).length;
      expect(totalToSend).toBe(3);
    });
  });

  describe('Performance', () => {
    it('should handle 10,000 checks efficiently', () => {
      const start = Date.now();

      for (let i = 0; i < 10000; i++) {
        shouldSendReminder(PlanType.Monthly, 3);
        shouldSendReminder(PlanType.Annual, 7);
        getReminderType(0);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50); // Should complete in < 50ms
    });
  });
});
