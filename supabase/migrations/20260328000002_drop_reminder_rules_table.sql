-- Migration: Drop unused reminder_rules table
-- Date: 2026-03-28
--
-- This migration:
-- 1. Drops the reminder_rules table which is no longer used
-- 2. The application relies entirely on the static REMINDER_RULES constant
--    in src/core/utils/constants/ReminderConfig.ts
--
-- Rationale:
-- - The reminder_rules table was originally designed for dynamic rule configuration
-- - In practice, the application uses hardcoded reminder rules via REMINDER_RULES constant
-- - Database table is unused and creates maintenance overhead
-- - Removing it eliminates database bloat and potential confusion

-- ============================================================
-- DROP REMINDER_RULES TABLE
-- ============================================================

DROP TABLE IF EXISTS reminder_rules;

-- Note: If this table had foreign key references, they would need to be
-- dropped first. In this codebase, reminder_rules has no dependents.
