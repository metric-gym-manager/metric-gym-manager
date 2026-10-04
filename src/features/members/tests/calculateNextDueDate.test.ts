/**
 * Unit Tests for calculateNextDueDate
 *
 * Tests the centralized date calculation logic that was previously
 * duplicated across member.service.ts, payment.service.ts, and PaymentCollectionModal.tsx
 */

import {
  calculateNextDueDate,
  calculateNextDueDateFromPayment,
} from '../utils/calculateNextDueDate'
import { PlanType } from '../config/PlanConfig'

describe('calculateNextDueDate', () => {
  const baseDate = new Date('2024-01-15T00:00:00.000Z')

  describe('Daily Plan', () => {
    it('should add 1 day for daily plan', () => {
      const result = calculateNextDueDate(baseDate, PlanType.Daily)
      expect(result).toEqual(new Date('2024-01-16T00:00:00.000Z'))
    })

    it('should handle month boundary correctly', () => {
      const endOfMonth = new Date('2024-01-31T00:00:00.000Z')
      const result = calculateNextDueDate(endOfMonth, PlanType.Daily)
      expect(result).toEqual(new Date('2024-02-01T00:00:00.000Z'))
    })

    it('should handle year boundary correctly', () => {
      const endOfYear = new Date('2024-12-31T00:00:00.000Z')
      const result = calculateNextDueDate(endOfYear, PlanType.Daily)
      expect(result).toEqual(new Date('2025-01-01T00:00:00.000Z'))
    })
  })

  describe('Weekly Plan', () => {
    it('should add 7 days for weekly plan', () => {
      const result = calculateNextDueDate(baseDate, PlanType.Weekly)
      expect(result).toEqual(new Date('2024-01-22T00:00:00.000Z'))
    })

    it('should handle month boundary correctly', () => {
      const nearEndOfMonth = new Date('2024-01-28T00:00:00.000Z')
      const result = calculateNextDueDate(nearEndOfMonth, PlanType.Weekly)
      expect(result).toEqual(new Date('2024-02-04T00:00:00.000Z'))
    })
  })

  describe('Monthly Plan', () => {
    it('should add 1 month for monthly plan', () => {
      const result = calculateNextDueDate(baseDate, PlanType.Monthly)
      expect(result).toEqual(new Date('2024-02-15T00:00:00.000Z'))
    })

    it('should handle year boundary correctly', () => {
      const december = new Date('2024-12-15T00:00:00.000Z')
      const result = calculateNextDueDate(december, PlanType.Monthly)
      expect(result).toEqual(new Date('2025-01-15T00:00:00.000Z'))
    })

    it('should handle months with different days correctly', () => {
      // January (31 days) → February (29 days in 2024)
      const jan31 = new Date('2024-01-31T00:00:00.000Z')
      const result = calculateNextDueDate(jan31, PlanType.Monthly)
      // Should be Feb 29 (last day of Feb in leap year)
      expect(result).toEqual(new Date('2024-02-29T00:00:00.000Z'))
    })

    it('should handle non-leap year February correctly', () => {
      // January 31, 2023 → February 28, 2023 (non-leap year)
      const jan31 = new Date('2023-01-31T00:00:00.000Z')
      const result = calculateNextDueDate(jan31, PlanType.Monthly)
      expect(result).toEqual(new Date('2023-02-28T00:00:00.000Z'))
    })

    it('should handle end of long month → short month → long month', () => {
      // May 31 → June 30 → July 30 (not July 31!)
      const may31 = new Date('2024-05-31T00:00:00.000Z')
      const june = calculateNextDueDate(may31, PlanType.Monthly)
      expect(june).toEqual(new Date('2024-06-30T00:00:00.000Z'))

      const july = calculateNextDueDate(june, PlanType.Monthly)
      expect(july).toEqual(new Date('2024-07-30T00:00:00.000Z'))
    })
  })

  describe('3-Months Plan', () => {
    it('should add 3 months for 3-months plan', () => {
      const result = calculateNextDueDate(baseDate, PlanType.ThreeMonths)
      expect(result).toEqual(new Date('2024-04-15T00:00:00.000Z'))
    })

    it('should handle year boundary correctly', () => {
      const november = new Date('2024-11-15T00:00:00.000Z')
      const result = calculateNextDueDate(november, PlanType.ThreeMonths)
      expect(result).toEqual(new Date('2025-02-15T00:00:00.000Z'))
    })

    it('should handle month day variations correctly', () => {
      // Nov 30 → Feb 29 (leap year)
      const nov30 = new Date('2023-11-30T00:00:00.000Z')
      const result = calculateNextDueDate(nov30, PlanType.ThreeMonths)
      expect(result).toEqual(new Date('2024-02-29T00:00:00.000Z'))
    })
  })

  describe('6-Months Plan', () => {
    it('should add 6 months for 6-months plan', () => {
      const result = calculateNextDueDate(baseDate, PlanType.SixMonths)
      expect(result).toEqual(new Date('2024-07-15T00:00:00.000Z'))
    })

    it('should handle year boundary correctly', () => {
      const august = new Date('2024-08-15T00:00:00.000Z')
      const result = calculateNextDueDate(august, PlanType.SixMonths)
      expect(result).toEqual(new Date('2025-02-15T00:00:00.000Z'))
    })
  })

  describe('Annual Plan', () => {
    it('should add 1 year for annual plan', () => {
      const result = calculateNextDueDate(baseDate, PlanType.Annual)
      expect(result).toEqual(new Date('2025-01-15T00:00:00.000Z'))
    })

    it('should handle leap year → non-leap year correctly', () => {
      // Feb 29, 2024 (leap) → Feb 28, 2025 (non-leap)
      const leapDay = new Date('2024-02-29T00:00:00.000Z')
      const result = calculateNextDueDate(leapDay, PlanType.Annual)
      expect(result).toEqual(new Date('2025-02-28T00:00:00.000Z'))
    })

    it('should handle multiple years correctly', () => {
      let date = new Date('2024-01-15T00:00:00.000Z')
      date = calculateNextDueDate(date, PlanType.Annual)
      expect(date).toEqual(new Date('2025-01-15T00:00:00.000Z'))

      date = calculateNextDueDate(date, PlanType.Annual)
      expect(date).toEqual(new Date('2026-01-15T00:00:00.000Z'))
    })
  })

  describe('Custom Plan', () => {
    it('should add 1 month for custom plan (default behavior)', () => {
      const result = calculateNextDueDate(baseDate, PlanType.Custom)
      expect(result).toEqual(new Date('2024-02-15T00:00:00.000Z'))
    })
  })

  describe('Options: deductOverduePeriod', () => {
    it('should use payment date as base when deductOverduePeriod is true', () => {
      const paymentDate = new Date('2024-02-01T00:00:00.000Z')
      const result = calculateNextDueDate(paymentDate, PlanType.Monthly, {
        deductOverduePeriod: true,
      })
      expect(result).toEqual(new Date('2024-03-01T00:00:00.000Z'))
    })

    it('should maintain same behavior when deductOverduePeriod is false', () => {
      // This option doesn't affect the calculation in the utility itself
      // It's used by the use case to determine which date to pass
      const result = calculateNextDueDate(baseDate, PlanType.Monthly, {
        deductOverduePeriod: false,
      })
      expect(result).toEqual(new Date('2024-02-15T00:00:00.000Z'))
    })
  })

  /**
   * Which date a payment's new period starts from. A late payer's period
   * starts on the payment day (the overdue days are not billed); an early
   * payer keeps their due date, so paying three days early never costs them
   * three days. Owner decision, 2026-10-04.
   */
  describe('calculateNextDueDateFromPayment', () => {
    const due = new Date('2024-02-15T00:00:00.000Z')

    it('extends an early payment from the current due date', () => {
      const result = calculateNextDueDateFromPayment(
        new Date('2024-02-12T00:00:00.000Z'),
        due,
        PlanType.Monthly
      )
      expect(result).toEqual(new Date('2024-03-15T00:00:00.000Z'))
    })

    it('dates a late payment from the payment day', () => {
      const result = calculateNextDueDateFromPayment(
        new Date('2024-02-20T00:00:00.000Z'),
        due,
        PlanType.Monthly
      )
      expect(result).toEqual(new Date('2024-03-20T00:00:00.000Z'))
    })

    it('treats a payment on the due date like either', () => {
      const result = calculateNextDueDateFromPayment(due, due, PlanType.Monthly)
      expect(result).toEqual(new Date('2024-03-15T00:00:00.000Z'))
    })

    it('extends an early weekly payment by a week from the due date', () => {
      const result = calculateNextDueDateFromPayment(
        new Date('2024-02-13T00:00:00.000Z'),
        due,
        PlanType.Weekly
      )
      expect(result).toEqual(new Date('2024-02-22T00:00:00.000Z'))
    })

    it('clamps an early payment against a month-end due date', () => {
      const result = calculateNextDueDateFromPayment(
        // Dated from the payment this would be Feb 28; from the due date, Feb
        // 31 clamps to the leap day.
        new Date('2024-01-28T00:00:00.000Z'),
        new Date('2024-01-31T00:00:00.000Z'),
        PlanType.Monthly
      )
      expect(result).toEqual(new Date('2024-02-29T00:00:00.000Z'))
    })

    it('keeps the due date for a late payment when deductOverduePeriod is false', () => {
      const result = calculateNextDueDateFromPayment(
        new Date('2024-02-20T00:00:00.000Z'),
        due,
        PlanType.Monthly,
        false
      )
      expect(result).toEqual(new Date('2024-03-15T00:00:00.000Z'))
    })
  })

  describe('Edge Cases', () => {
    it('should handle midnight time correctly', () => {
      const midnight = new Date('2024-01-15T00:00:00.000Z')
      const result = calculateNextDueDate(midnight, PlanType.Monthly)
      // Use UTC methods since input is UTC
      expect(result.getUTCHours()).toBe(0)
      expect(result.getUTCMinutes()).toBe(0)
      expect(result.getUTCSeconds()).toBe(0)
    })

    it('should handle time during the day correctly', () => {
      const afternoon = new Date('2024-01-15T14:30:45.123Z')
      const result = calculateNextDueDate(afternoon, PlanType.Monthly)
      // Time should be preserved (use UTC methods since input is UTC)
      expect(result.getUTCHours()).toBe(14)
      expect(result.getUTCMinutes()).toBe(30)
      expect(result.getUTCSeconds()).toBe(45)
    })

    it('should not mutate the original date', () => {
      const originalDate = new Date('2024-01-15T00:00:00.000Z')
      const originalTime = originalDate.getTime()

      calculateNextDueDate(originalDate, PlanType.Monthly)

      expect(originalDate.getTime()).toBe(originalTime)
    })

    it('should handle string date inputs', () => {
      const dateString = '2024-01-15'
      const result = calculateNextDueDate(
        new Date(dateString),
        PlanType.Monthly
      )
      expect(result.getMonth()).toBe(1) // February (0-indexed)
      expect(result.getDate()).toBe(15)
    })
  })

  describe('Regression Test: PaymentCollectionModal Bug Fix', () => {
    it('should use setMonth() not setDate() for monthly plans', () => {
      // Original bug: PaymentCollectionModal used setDate(date + 30)
      // This would fail on months with 31 days

      const jan15 = new Date('2024-01-15T00:00:00.000Z')
      const result = calculateNextDueDate(jan15, PlanType.Monthly)

      // Correct: Feb 15 (using setMonth)
      expect(result).toEqual(new Date('2024-02-15T00:00:00.000Z'))

      // Bug would have produced: Feb 14 (15 + 30 = 45, which overflows to Feb 14)
      const buggyResult = new Date(jan15)
      buggyResult.setDate(buggyResult.getDate() + 30)
      expect(result).not.toEqual(buggyResult)
    })

    it('should handle end-of-month edge case that caused the bug', () => {
      // Jan 31 + 30 days = March 1 or 2 depending on timezone (wrong!)
      // Jan 31 + 1 month = Feb 29 (correct in leap year)

      const jan31 = new Date('2024-01-31T00:00:00.000Z')
      const result = calculateNextDueDate(jan31, PlanType.Monthly)

      expect(result).toEqual(new Date('2024-02-29T00:00:00.000Z'))

      // Bug would have produced March 1 or 2 depending on timezone
      const buggyResult = new Date(jan31)
      buggyResult.setDate(buggyResult.getDate() + 30)
      expect(buggyResult.getUTCMonth()).toBe(2) // March
      // Date varies by timezone, but it's definitely in March (not Feb)

      // Our fix produces Feb 29
      expect(result.getUTCMonth()).toBe(1) // February
      expect(result.getUTCDate()).toBe(29)
    })
  })

  describe('Performance', () => {
    it('should handle 1000 consecutive calculations efficiently', () => {
      const start = Date.now()
      let date = new Date('2024-01-01T00:00:00.000Z')

      for (let i = 0; i < 1000; i++) {
        date = calculateNextDueDate(date, PlanType.Monthly)
      }

      const duration = Date.now() - start
      expect(duration).toBeLessThan(100) // Should complete in < 100ms

      // After 1000 months, should be around 2107
      expect(date.getFullYear()).toBeGreaterThanOrEqual(2107)
    })
  })
})
