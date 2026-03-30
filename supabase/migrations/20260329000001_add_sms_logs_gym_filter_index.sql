-- ============================================================
-- Migration: Add Composite Index for SaaS Admin Gym-Specific SMS Failure Drilldown
-- Created: 2026-03-29
-- ============================================================
-- Purpose: Optimize queries filtering SMS failures by gym_id for the
-- SaaS admin system health dashboard. This index supports efficient
-- gym-specific drilldown queries on the /api/admin/system-health/sms-failures endpoint.
--
-- Query Pattern Optimized:
--   SELECT * FROM sms_logs
--   WHERE gym_id = $1
--     AND delivery_status = 'failed'
--   ORDER BY sent_at DESC
--   LIMIT 50;
--
-- Performance Impact:
--   - Without index: Full table scan + filter + sort (O(n log n))
--   - With index: Index-only scan (O(log n))
--   - Expected speedup: 10-100x for large datasets (10k+ SMS logs)
-- ============================================================

-- Create composite index for gym-filtered SMS failure queries
CREATE INDEX IF NOT EXISTS idx_sms_logs_gym_failures
  ON sms_logs (gym_id, delivery_status, sent_at DESC)
  WHERE delivery_status = 'failed';

-- Add comment for documentation
COMMENT ON INDEX idx_sms_logs_gym_failures IS
  'Composite index for SaaS admin gym-specific SMS failure drilldown. Optimizes queries filtering by gym_id and delivery_status with sent_at ordering. Used by /api/admin/system-health/sms-failures?gymId=<uuid> endpoint.';

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- DROP INDEX IF EXISTS idx_sms_logs_gym_failures;
