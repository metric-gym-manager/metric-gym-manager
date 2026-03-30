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

-- Step 3: Alter the column to use the new type
-- This requires casting, which is safe now that all frozen→suspended
ALTER TABLE members
  ALTER COLUMN status TYPE member_status
  USING status::text::member_status;

-- Step 4: Drop the old type
DROP TYPE member_status_old;

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
