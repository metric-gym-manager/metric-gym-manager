-- Access control: SQL functions the PostgREST client cannot express.
--
-- Companion to 20260810000001_create_access_control.sql.
-- Design: docs/architecture/access-control-integration.md
--
-- Both functions below exist because the JS client has no way to write them,
-- and in both cases doing the work in application code would be racy rather
-- than merely inconvenient.

-- ============================================================
-- DEVICE CAPACITY (added here so the base migration stays as released)
-- ============================================================
ALTER TABLE access_devices
  ADD COLUMN IF NOT EXISTS template_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS template_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN access_devices.template_capacity IS
  'Fingerprint templates this reader holds (typically 1,000-3,000). NULL until an operator sets it or a -18 "device storage full" reveals it.';
COMMENT ON COLUMN access_devices.template_count IS
  'Templates currently loaded. Drives the capacity warning and the eviction threshold.';

-- ============================================================
-- SUBJECT ID ALLOCATION
-- ============================================================
-- The device identifier comes from a sequence whose MAXVALUE mirrors the
-- ZKTeco Personnel ID ceiling. That MAXVALUE is the only thing standing
-- between us and an id the hardware would silently truncate — and a truncated
-- id can collide with another member's, which opens a door for the wrong
-- person.
--
-- PostgREST cannot call nextval, hence this wrapper. It also turns sequence
-- exhaustion into a named error, because the raw Postgres message ("nextval:
-- reached maximum value of sequence") would tell an operator nothing about
-- what to do next.
CREATE OR REPLACE FUNCTION allocate_access_subject_id()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  BEGIN
    v_id := nextval('access_subject_id_seq');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'ACCESS_SUBJECT_ID_EXHAUSTED: the device identifier range is fully allocated. Recycle ids from purged members or move to per-gym vendor accounts.'
        USING ERRCODE = 'P0001';
  END;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION allocate_access_subject_id() IS
  'Allocates the next ZKTeco Pin. Wraps nextval because PostgREST cannot call it, and names the exhaustion case so an operator knows what to do.';

-- ============================================================
-- OUTBOX CLAIM
-- ============================================================
-- Two properties, both correctness requirements rather than optimisations:
--
--   FOR UPDATE SKIP LOCKED — two overlapping cron invocations must not work
--   the same job. Without it, a command could be sent to the hardware twice.
--
--   DISTINCT ON (member_id) — a member's commands have a mandatory order (the
--   subject must reach the device before a validity period will bind to it).
--   Allowing two of one member's jobs to run concurrently can land them
--   backwards, which fails silently and leaves a member enrolled with no
--   window: refused at a door our records call open.
--
-- Jobs with no member (device-level operations) are not constrained by the
-- DISTINCT, since they have no ordering requirement between them.
CREATE OR REPLACE FUNCTION claim_access_sync_jobs(p_limit INTEGER DEFAULT 20)
RETURNS SETOF access_sync_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    -- One job per member, oldest first. NULL member_id rows each stand alone,
    -- which DISTINCT ON gives us for free since NULLs are not equal.
    SELECT DISTINCT ON (COALESCE(member_id::TEXT, id::TEXT))
      j.id
    FROM access_sync_jobs j
    WHERE j.status IN ('pending', 'failed')
      AND j.next_attempt_at <= NOW()
    ORDER BY COALESCE(member_id::TEXT, id::TEXT), j.created_at
  ),
  locked AS (
    SELECT j.id
    FROM access_sync_jobs j
    WHERE j.id IN (SELECT id FROM claimable)
      -- Re-check under the lock: another worker may have taken this row
      -- between the scan above and the update below.
      AND j.status IN ('pending', 'failed')
      AND j.next_attempt_at <= NOW()
    ORDER BY j.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE access_sync_jobs j
  SET status = 'in_flight',
      attempts = j.attempts + 1,
      updated_at = NOW()
  FROM locked
  WHERE j.id = locked.id
  RETURNING j.*;
END;
$$;

COMMENT ON FUNCTION claim_access_sync_jobs(INTEGER) IS
  'Atomically claims due outbox jobs, at most one in flight per member. SKIP LOCKED prevents double-sending across overlapping cron runs; DISTINCT ON preserves the hardware ordering requirement.';

-- ============================================================
-- DEVICE TEMPLATE COUNT
-- ============================================================
-- Kept in the database rather than recomputed in the application so the
-- capacity check is one read, and so it cannot drift between the eviction
-- decision and the eviction itself.
CREATE OR REPLACE FUNCTION recount_device_templates(p_device_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gym_id UUID;
  v_count INTEGER;
BEGIN
  SELECT gym_id INTO v_gym_id FROM access_devices WHERE id = p_device_id;

  IF v_gym_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM member_access_subjects s
  WHERE s.gym_id = v_gym_id
    AND s.on_device = TRUE;

  UPDATE access_devices
  SET template_count = v_count, updated_at = NOW()
  WHERE id = p_device_id;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION recount_device_templates(UUID) IS
  'Recomputes how many templates a reader holds, from the subjects marked on_device for its gym.';
