import { z } from 'zod'

// ============================================================
// REVENUE QUERY VALIDATION SCHEMAS
// ============================================================

/**
 * Validation schema for monthly revenue query parameters
 */
export const monthlyRevenueQuerySchema = z.object({
  year: z
    .number()
    .int('Year must be an integer')
    .min(2000, 'Year must be 2000 or later')
    .max(2100, 'Year must be 2100 or earlier'),

  month: z
    .number()
    .int('Month must be an integer')
    .min(1, 'Month must be between 1 and 12')
    .max(12, 'Month must be between 1 and 12'),
})

export type MonthlyRevenueQuery = z.infer<typeof monthlyRevenueQuerySchema>
