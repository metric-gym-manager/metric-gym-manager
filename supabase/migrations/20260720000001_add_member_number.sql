-- Migration: per-gym sequential member number (human-friendly member ID, 0001..)
--
-- Every member gets a per-gym sequential number. The FIRST registered member of
-- each gym is 0001. Numbers are displayed zero-padded (e.g. #0001) in the UI but
-- stored as a plain 1-based integer.
--
-- Assignment is centralized in a BEFORE INSERT trigger so it covers EVERY insert
-- path (register_member_guarded RPC, direct repository insert, bulk registration).
-- The per-gym counter lives on gyms.member_number_seq; incrementing it with
-- UPDATE ... RETURNING takes a row lock on the gyms row, which serializes
-- concurrent registrations for the same gym and makes number collisions
-- impossible (mirrors the member_count trigger's locking model).

-- ============================================================
-- PART 1: PER-GYM COUNTER (drives assignment)
-- ============================================================

ALTER TABLE gyms ADD COLUMN IF NOT EXISTS member_number_seq INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- PART 2: MEMBER NUMBER COLUMN (nullable during backfill)
-- ============================================================

ALTER TABLE members ADD COLUMN IF NOT EXISTS member_number INTEGER;

-- ============================================================
-- PART 3: BACKFILL EXISTING MEMBERS — 0001.. per gym by registration order
-- ============================================================

WITH numbered AS (
  SELECT id,
         row_number() OVER (PARTITION BY gym_id ORDER BY created_at ASC, id ASC) AS rn
  FROM members
)
UPDATE members m
SET member_number = numbered.rn
FROM numbered
WHERE m.id = numbered.id;

-- Seed each gym's counter to its current highest assigned number so new
-- registrations continue the sequence.
UPDATE gyms g
SET member_number_seq = COALESCE(sub.max_num, 0)
FROM (
  SELECT gym_id, MAX(member_number) AS max_num
  FROM members
  GROUP BY gym_id
) sub
WHERE g.id = sub.gym_id;

-- ============================================================
-- PART 4: ENFORCE PRESENCE + PER-GYM UNIQUENESS
-- (the unique index also backs member-ID search lookups)
-- ============================================================

ALTER TABLE members ALTER COLUMN member_number SET NOT NULL;
-- DROP-then-ADD so the migration re-runs cleanly (Postgres has no
-- ADD CONSTRAINT IF NOT EXISTS).
ALTER TABLE members
  DROP CONSTRAINT IF EXISTS members_gym_member_number_unique;
ALTER TABLE members
  ADD CONSTRAINT members_gym_member_number_unique UNIQUE (gym_id, member_number);

-- ============================================================
-- PART 5: ASSIGNMENT TRIGGER
-- SECURITY DEFINER so it can update gyms regardless of the inserting role's RLS
-- (same pattern as sync_gym_member_count).
-- ============================================================

CREATE OR REPLACE FUNCTION assign_member_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.member_number IS NULL THEN
    UPDATE gyms
      SET member_number_seq = member_number_seq + 1
      WHERE id = NEW.gym_id
      RETURNING member_number_seq INTO NEW.member_number;

    IF NEW.member_number IS NULL THEN
      -- gym row did not exist: mirror register_member_guarded's error contract
      RAISE EXCEPTION 'GYM_NOT_FOUND';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Runs BEFORE the AFTER-INSERT member_count trigger; no ordering conflict.
DROP TRIGGER IF EXISTS trg_assign_member_number ON members;
CREATE TRIGGER trg_assign_member_number
  BEFORE INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION assign_member_number();

COMMENT ON COLUMN members.member_number IS 'Per-gym sequential member ID (1-based; first member of a gym = 1). Displayed zero-padded as #0001. Assigned by trg_assign_member_number.';
COMMENT ON COLUMN gyms.member_number_seq IS 'Monotonic per-gym counter backing members.member_number; incremented under row lock on each member insert.';
COMMENT ON FUNCTION assign_member_number IS 'BEFORE INSERT: assigns the next per-gym member_number via a row-locked counter increment on gyms. The single member-number authority for all insert paths.';
