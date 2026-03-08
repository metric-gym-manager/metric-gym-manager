-- ============================================================
-- Migration: Cleanup Old Seeded Plan Types
-- Date: 2026-03-08
-- Purpose: Remove auto-seeded plan types from gym creation
--          so gyms can configure their own pricing
-- ============================================================

-- This migration provides two options for cleaning up old seeded plan types:
-- Option 1 (RECOMMENDED): Mark old seeded plans as inactive
-- Option 2: Delete unused seeded plans

-- ============================================================
-- OPTION 1: Mark old seeded plans as INACTIVE
-- ============================================================
-- This approach keeps historical data intact and is SAFER.
-- Gyms can manually delete or reactivate these plans via Settings → Plans.

-- Mark seeded plans as inactive if they have the exact default amounts
UPDATE plan_types
SET
  is_active = false,
  updated_at = NOW()
WHERE
  (plan_type = 'monthly' AND default_amount = 5000.0)
  OR (plan_type = 'daily' AND default_amount IN (200.0, 300.0))
  OR (plan_type = 'annual' AND default_amount = 50000.0);

-- ============================================================
-- OPTION 2: DELETE unused seeded plans (DESTRUCTIVE - Use with caution)
-- ============================================================
-- ONLY run this if you're certain these plans are not in use by any members.
-- Uncomment the following block ONLY if you want to delete them permanently:

/*
-- Delete seeded plans that are NOT in use by any members
DELETE FROM plan_types
WHERE
  (
    (plan_type = 'monthly' AND default_amount = 5000.0)
    OR (plan_type = 'daily' AND default_amount IN (200.0, 300.0))
    OR (plan_type = 'annual' AND default_amount = 50000.0)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM members m
    WHERE m.gym_id = plan_types.gym_id
      AND m.plan_type = plan_types.plan_type
  );
*/

-- ============================================================
-- Verification Query
-- ============================================================
-- Run this to see which plan types remain after cleanup:
-- SELECT
--   g.gym_name,
--   pt.plan_type,
--   pt.default_amount,
--   pt.is_active,
--   COUNT(m.id) as member_count
-- FROM plan_types pt
-- JOIN gyms g ON g.id = pt.gym_id
-- LEFT JOIN members m ON m.gym_id = pt.gym_id AND m.plan_type = pt.plan_type
-- GROUP BY g.gym_name, pt.plan_type, pt.default_amount, pt.is_active
-- ORDER BY g.gym_name, pt.plan_type;
