import { z } from 'zod'
import { ANALYTICS_METRICS, ANALYTICS_RANGES } from '../config/AnalyticsConfig'

// ============================================================
// MEMBER ANALYTICS QUERY VALIDATION
// ============================================================

/**
 * Query params for GET /api/analytics/members.
 *
 * `range`/`metric` are validated against the const tuples that own the analytics
 * vocabulary (AnalyticsConfig) — the same single source the TS unions derive
 * from, so this is not a duplicated enum set (R5/R13).
 */
export const memberAnalyticsQuerySchema = z.object({
  range: z.enum(ANALYTICS_RANGES),
  year: z
    .number()
    .int('Year must be an integer')
    .min(2000, 'Year must be 2000 or later')
    .max(2100, 'Year must be 2100 or earlier'),
  metric: z.enum(ANALYTICS_METRICS).optional(),
})

export type MemberAnalyticsQuery = z.infer<typeof memberAnalyticsQuerySchema>
