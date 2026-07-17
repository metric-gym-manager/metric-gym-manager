-- Migration: Remove frozen status from member_status ENUM
-- Date: 2026-03-26
--
-- This migration:
-- 1. Converts all frozen members to suspended status
-- 2. Removes 'frozen' from the member_status ENUM type
--
-- Rationale: Frozen status is redundant; suspended will be the sole state
-- for inactive, non-expired memberships.

-- ============================================================
-- PART 1: DATA CONVERSION
-- ============================================================

-- Convert all frozen members to suspended
UPDATE members
SET
  status = 'suspended',
  updated_at = NOW()
WHERE status = 'frozen';

-- Log the conversion for audit trail
DO $$
DECLARE
  converted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO converted_count
  FROM members
  WHERE status = 'suspended'
    AND updated_at >= NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'Converted % frozen members to suspended', converted_count;
END $$;

-- ============================================================
-- PART 2: REMOVE 'frozen' FROM member_status ENUM
-- ============================================================

-- Step 1: Rename the old ENUM type
ALTER TYPE member_status RENAME TO member_status_old;

-- Step 2: Create new ENUM type without 'frozen'
CREATE TYPE member_status AS ENUM (
  'active',
  'expired',
  'suspended',
  'cancelled'
);

-- Step 3: Detach everything bound to the old type, then swap the column.
-- (Replay-hardened: the column DEFAULT cannot be auto-cast across an enum
-- change, the partial index predicate binds the enum type, and the two
-- helper functions return member_status in their signatures — any of these
-- blocks the swap or the DROP TYPE on a fresh database. All are restored
-- below with definitions identical to before.)
DROP INDEX IF EXISTS idx_members_overdue;
DROP FUNCTION IF EXISTS get_overdue_members(UUID);
DROP FUNCTION IF EXISTS get_upcoming_due_members(UUID, INTEGER);
ALTER TABLE members ALTER COLUMN status DROP DEFAULT;

ALTER TABLE members
  ALTER COLUMN status TYPE member_status
  USING status::text::member_status;

ALTER TABLE members ALTER COLUMN status SET DEFAULT 'active';

-- Step 4: Drop the old type
DROP TYPE member_status_old;

-- Step 5: Restore the index and helper functions against the new type
-- (definitions unchanged from 20260211000002 / 20260211000006)
CREATE INDEX idx_members_overdue ON members(gym_id, status, next_due_date)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION get_overdue_members(p_gym_id UUID)
RETURNS TABLE (
  member_id UUID,
  member_name TEXT,
  phone_number TEXT,
  plan_type member_plan_type,
  plan_amount DECIMAL,
  next_due_date DATE,
  days_overdue INTEGER,
  status member_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS member_id,
    m.name AS member_name,
    m.phone_number,
    m.plan_type,
    m.plan_amount,
    m.next_due_date,
    (CURRENT_DATE - m.next_due_date)::INTEGER AS days_overdue,
    m.status
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    AND m.next_due_date < CURRENT_DATE - INTERVAL '7 days'
  ORDER BY m.next_due_date ASC; -- Most overdue first
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_upcoming_due_members(
  p_gym_id UUID,
  p_days_ahead INTEGER DEFAULT 7
)
RETURNS TABLE (
  member_id UUID,
  member_name TEXT,
  phone_number TEXT,
  plan_type member_plan_type,
  plan_amount DECIMAL,
  next_due_date DATE,
  days_until_due INTEGER,
  status member_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS member_id,
    m.name AS member_name,
    m.phone_number,
    m.plan_type,
    m.plan_amount,
    m.next_due_date,
    (m.next_due_date - CURRENT_DATE)::INTEGER AS days_until_due,
    m.status
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    AND m.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL
  ORDER BY m.next_due_date ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Verify no frozen members remain
DO $$
DECLARE
  remaining_frozen INTEGER;
BEGIN
  -- This query should return 0 (frozen no longer exists in ENUM)
  -- Including it as a safety check
  SELECT COUNT(*) INTO remaining_frozen
  FROM members
  WHERE status::text = 'frozen';

  IF remaining_frozen > 0 THEN
    RAISE EXCEPTION 'Migration failed: % frozen members still exist', remaining_frozen;
  END IF;

  RAISE NOTICE 'Verification complete: No frozen members remain';
END $$;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TYPE member_status IS 'Member status: active, expired, suspended, cancelled (frozen removed 2026-03-26)';

-- ============================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================

-- To rollback this migration, you would need to:
-- 1. ALTER TYPE member_status ADD VALUE 'frozen';
-- 2. Optionally restore frozen members from backup
--
-- Note: PostgreSQL does not support removing ENUM values easily,
-- so rollback requires recreating the type with 'frozen' included.
