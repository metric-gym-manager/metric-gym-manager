// ============================================================
// MEMBER ANALYTICS FEATURE — PUBLIC API
// ============================================================

// Service composition (routes call the factory — R7)
export { createMemberAnalytics } from './services/factory'
export { MemberAnalyticsService } from './services/analytics.service'

// Pure aggregation (exported for reuse/testing)
export { computeMemberAnalytics } from './utils/aggregate'

// Query validation
export {
  memberAnalyticsQuerySchema,
  type MemberAnalyticsQuery,
} from './schemas/analytics.schemas'

// Vocabulary (single source of truth — R5)
export { ANALYTICS_RANGES, ANALYTICS_METRICS } from './config/AnalyticsConfig'

// Types
export type {
  AnalyticsRange,
  AnalyticsMetric,
  Granularity,
  MemberAnalyticsResponse,
  AnalyticsSummary,
  TimeSeriesPoint,
  YoyRegistrationPoint,
  CohortRetentionRow,
  AtRiskBucket,
} from './types'
