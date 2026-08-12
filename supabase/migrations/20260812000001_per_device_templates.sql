-- Access control: track fingerprint templates PER READER, not per member.
--
-- Design: docs/architecture/access-control-integration.md
--
-- ## The defect this fixes
--
-- `member_access_subjects.on_device` was a single boolean: "this member's
-- template is on the reader". But a gym can have more than one reader, and a
-- template lives on each of them independently.
--
-- The consequence was silent and total. A gym opens a second entrance and
-- registers the reader. Every existing member already has `on_device = TRUE`,
-- so the command derivation concludes there is nothing to push — and the new
-- door never opens for anyone who joined before it was installed. No error, no
-- failed job, nothing on the health view. The only evidence is members
-- standing at a door that ignores them.
--
-- The same bug made `recount_device_templates` meaningless with two readers:
-- it counted `on_device` across the whole gym, so every reader reported the
-- same number regardless of what it actually held.
--
-- ## The shape of the fix
--
-- `synced_device_serials` is now the single source of truth: exactly which
-- readers hold this member. `on_device` is kept as a GENERATED column so the
-- eviction and capacity queries keep reading a cheap boolean, but it can no
-- longer disagree with the array — the database derives it.

-- ============================================================
-- 1. The array
-- ============================================================
ALTER TABLE member_access_subjects
  ADD COLUMN IF NOT EXISTS synced_device_serials TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN member_access_subjects.synced_device_serials IS
  'Serials of the readers currently holding this member''s fingerprint template. The authority for whether a push is needed; on_device is derived from it.';

-- ============================================================
-- 2. Backfill
-- ============================================================
-- A member marked on_device under the old boolean was pushed to whatever
-- readers the gym had at the time. The gym's currently active serials are the
-- best available reconstruction, and any error resolves itself: a serial
-- listed here that the reader does not actually hold is corrected the first
-- time that member is refused and re-synced, while a serial MISSING here only
-- causes an extra idempotent push.
UPDATE member_access_subjects s
SET synced_device_serials = COALESCE(
  (
    SELECT ARRAY_AGG(d.device_serial)
    FROM access_devices d
    WHERE d.gym_id = s.gym_id
      AND d.is_active = TRUE
  ),
  '{}'
)
WHERE s.on_device = TRUE
  AND s.synced_device_serials = '{}';

-- ============================================================
-- 3. on_device becomes derived
-- ============================================================
-- Dropped and re-added rather than backfilled in application code, because two
-- independently-written columns describing the same fact is exactly how the
-- original defect became invisible: nothing could ever catch them disagreeing.
ALTER TABLE member_access_subjects DROP COLUMN IF EXISTS on_device;

ALTER TABLE member_access_subjects
  ADD COLUMN on_device BOOLEAN
  GENERATED ALWAYS AS (CARDINALITY(synced_device_serials) > 0) STORED;

COMMENT ON COLUMN member_access_subjects.on_device IS
  'DERIVED: whether any reader holds this member''s template. Never written directly — update synced_device_serials instead.';

CREATE INDEX IF NOT EXISTS idx_member_access_subjects_on_device
  ON member_access_subjects(gym_id, on_device);

-- ============================================================
-- 4. Per-reader template count
-- ============================================================
-- Now counts what THIS reader holds. The previous version counted the gym's
-- on_device subjects, so a two-reader gym saw both readers report the same
-- number and the capacity trigger fired on the wrong one.
CREATE OR REPLACE FUNCTION recount_device_templates(p_device_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gym_id UUID;
  v_serial TEXT;
  v_count INTEGER;
BEGIN
  SELECT gym_id, device_serial INTO v_gym_id, v_serial
  FROM access_devices
  WHERE id = p_device_id;

  IF v_gym_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM member_access_subjects s
  WHERE s.gym_id = v_gym_id
    AND v_serial = ANY(s.synced_device_serials);

  UPDATE access_devices
  SET template_count = v_count, updated_at = NOW()
  WHERE id = p_device_id;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION recount_device_templates(UUID) IS
  'Recomputes how many templates THIS reader holds, from the subjects listing its serial. Per-reader: a member may be on one reader and not another.';
