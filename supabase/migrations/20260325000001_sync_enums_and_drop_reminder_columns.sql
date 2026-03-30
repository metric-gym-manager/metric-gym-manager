-- Migration: Synchronize ENUMs with TypeScript schemas and drop reminder tracking columns
-- Date: 2026-03-25
--
-- This migration:
-- 1. Adds missing ENUM values to align database with TypeScript code
-- 2. Drops deprecated reminder tracking columns (replaced with temporal queries)

-- ============================================================
-- PART 1: ADD MISSING ENUM VALUES
-- ============================================================

-- Add missing plan types to member_plan_type ENUM
-- These align with PlanType enum in src/core/utils/constants/PlanConfig.ts
ALTER TYPE member_plan_type ADD VALUE IF NOT EXISTS 'weekly';
ALTER TYPE member_plan_type ADD VALUE IF NOT EXISTS '3-months';
ALTER TYPE member_plan_type ADD VALUE IF NOT EXISTS '6-months';
ALTER TYPE member_plan_type ADD VALUE IF NOT EXISTS 'custom';

-- Add missing status to member_status ENUM
-- This aligns with MemberStatus enum in src/core/utils/constants/StatusConfig.ts
ALTER TYPE member_status ADD VALUE IF NOT EXISTS 'frozen';

-- ============================================================
-- PART 2: DROP REMINDER TRACKING COLUMNS
-- ============================================================

-- Drop the index first (dependent on columns)
DROP INDEX IF EXISTS idx_members_reminder_flags;

-- Drop reminder tracking boolean flags from members table
-- These are replaced by temporal queries on sms_logs table for proper idempotency
ALTER TABLE members
DROP COLUMN IF EXISTS reminder_7day_sent_this_period,
DROP COLUMN IF EXISTS reminder_3day_sent_this_period,
DROP COLUMN IF EXISTS due_today_sent_this_period,
DROP COLUMN IF EXISTS overdue_sent_this_period;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TYPE member_plan_type IS 'Membership plan types: daily, weekly, monthly, 3-months, 6-months, annual, custom';
COMMENT ON TYPE member_status IS 'Member status: active, expired, frozen, suspended, cancelled';
