-- Access control (VFT GYM API / ZKTeco PUSH) — Enterprise-tier hardware integration.
--
-- Design: docs/architecture/access-control-integration.md
-- Assumptions and their evidence grades: docs/integrations/vft/vft-api-assumptions.md
--
-- Core idea: we push each member's paid-through window to the terminal as a
-- validity period and let the terminal enforce entry from its own clock. Our
-- servers never gate a door in real time, so our downtime cannot lock a gym out
-- of its building, and an expired member is refused even with the network down.
--
-- Idempotent and replayable from an empty database (R11).

-- ============================================================
-- SUBJECT ID SEQUENCE
-- ============================================================
-- ZKTeco Personnel ID (`Pin`) is numeric, max 9 characters, documented valid
-- range 1..79,999,999. members.member_number is per-gym and therefore collides
-- on the flat device namespace: two gyms both have a member #1, and pushing
-- both would have one silently overwrite the other. Hence one global sequence.
CREATE SEQUENCE IF NOT EXISTS access_subject_id_seq
  START WITH 100000
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 79999999
  NO CYCLE;

COMMENT ON SEQUENCE access_subject_id_seq IS
  'Global ZKTeco Pin allocation. MAXVALUE mirrors the documented Personnel ID ceiling (79,999,999). Never derive subject ids from members.member_number — it is per-gym and collides on the device''s flat namespace.';

-- ============================================================
-- ACCOUNTS (non-secret half — gym-readable)
-- ============================================================
CREATE TABLE IF NOT EXISTS access_control_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL UNIQUE REFERENCES gyms(id) ON DELETE CASCADE,

  base_url TEXT NOT NULL,

  -- The gym's AreaID on the VFT side. Treated as an organisational label, NOT
  -- as an authorization boundary: the API token can reach every area on the
  -- account, so tenant isolation rests entirely on our own scoping.
  area_id INTEGER,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE access_control_accounts IS 'Per-gym VFT account, non-secret half. Credentials live in access_control_secrets.';
COMMENT ON COLUMN access_control_accounts.area_id IS 'VFT AreaID for this gym. Organisational only — NOT a security boundary.';

-- ============================================================
-- SECRETS (service-role only — deliberately no gym-side policies)
-- ============================================================
CREATE TABLE IF NOT EXISTS access_control_secrets (
  account_id UUID PRIMARY KEY REFERENCES access_control_accounts(id) ON DELETE CASCADE,

  -- AES-256-GCM under ACCESS_CONTROL_ENCRYPTION_KEY, encrypted in server code.
  email_ciphertext TEXT NOT NULL,
  password_ciphertext TEXT NOT NULL,

  api_token_ciphertext TEXT,
  token_expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE access_control_secrets IS 'VFT credentials, AES-256-GCM. RLS enabled with NO policies: service-role access only. A gym owner must never be able to read these back — the token reaches every gym on a shared account.';

-- ============================================================
-- DEVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS access_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,

  -- Hardware serial, globally unique. This is how inbound webhook events are
  -- routed back to a gym, since the callback URL is account-wide.
  device_serial TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,

  area_id INTEGER,

  -- Minutes from UTC as the device reports it (e.g. 330 = UTC+5:30).
  timezone_offset_minutes INTEGER NOT NULL DEFAULT 330,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  last_seen_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,

  -- Inferred from (event AttTime normalised) - (our receipt time). The PUSH API
  -- exposes no way to read a device clock, but the expiry boundary is enforced
  -- against that clock, so drift is worth monitoring.
  clock_skew_seconds INTEGER,
  clock_skew_measured_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_devices_gym ON access_devices(gym_id);

COMMENT ON COLUMN access_devices.clock_skew_seconds IS 'Inferred device clock drift. The validity cutover happens on the device RTC, so drift moves the lockout boundary.';

-- ============================================================
-- SUBJECTS (member -> device identity)
-- ============================================================
CREATE TABLE IF NOT EXISTS member_access_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,

  -- Allocated from access_subject_id_seq at first provisioning, not at
  -- registration: ids are a finite resource and most members never need one.
  subject_id BIGINT NOT NULL UNIQUE
    CHECK (subject_id > 0 AND subject_id <= 79999999),

  -- Single fingerprint per member (local gym practice). fingerId 0-9 records
  -- which finger was used, when known.
  finger_enrolled BOOLEAN NOT NULL DEFAULT FALSE,
  finger_id SMALLINT CHECK (finger_id IS NULL OR (finger_id >= 0 AND finger_id <= 9)),
  enrolled_at TIMESTAMPTZ,

  provisioned_at TIMESTAMPTZ,

  -- Whether the reader currently holds this member's template. Separate from
  -- provisioned_at (vendor-side) and finger_enrolled (a template exists at
  -- all): cancellation and capacity eviction clear this one only, via
  -- DELETE /api/template/fromdev/{EmpId}, so the vendor keeps its central copy
  -- and a returning member never has to re-enrol.
  on_device BOOLEAN NOT NULL DEFAULT FALSE,
  device_removed_at TIMESTAMPTZ,

  last_synced_at TIMESTAMPTZ,

  -- Last state we believe the device holds. The reconciler diffs the resolved
  -- decision against these and enqueues only differences — there is no bulk
  -- validity endpoint, so re-asserting every member nightly would be pure churn.
  last_synced_valid_from DATE,
  last_synced_valid_to DATE,
  last_synced_blocked BOOLEAN,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_access_subjects_gym ON member_access_subjects(gym_id);

COMMENT ON TABLE member_access_subjects IS 'Maps a member to their ZKTeco Pin and records the last state pushed to the terminal.';

-- ============================================================
-- SYNC OUTBOX
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_sync_status') THEN
    CREATE TYPE access_sync_status AS ENUM ('pending', 'in_flight', 'succeeded', 'failed', 'dead');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS access_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  device_id UUID REFERENCES access_devices(id) ON DELETE CASCADE,

  -- 'provision' | 'sync_to_device' | 'set_valid_period' | 'block' | 'grant'
  -- | 'revoke_biometric' | 'remove_subject'
  intent TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  status access_sync_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,

  -- Vendor command id, when the wrapper returns one, so a return code can be
  -- matched back to the job.
  provider_command_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drain order: oldest first, and serialized per member (provisioning has a
-- required sequence — the profile must exist on the device before a validity
-- period will bind to it).
CREATE INDEX IF NOT EXISTS idx_access_sync_jobs_drain
  ON access_sync_jobs(status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_access_sync_jobs_member
  ON access_sync_jobs(member_id, created_at)
  WHERE status IN ('pending', 'in_flight', 'failed');

COMMENT ON TABLE access_sync_jobs IS 'Outbox of intents to push to the access-control hardware. Drained oldest-first, serialized per member.';

-- ============================================================
-- EVENTS (successful entries; denials are not pushed by the device)
-- ============================================================
CREATE TABLE IF NOT EXISTS access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,

  device_serial TEXT NOT NULL,
  subject_id BIGINT NOT NULL,

  occurred_at TIMESTAMPTZ NOT NULL,

  -- 0 Password, 1 Fingerprint, 2 Card, 15 Face
  verify_type SMALLINT,
  -- 0 CheckIn, 1 CheckOut, 2 BreakOut, 3 BreakIn, 4 OTIn, 5 OTOut.
  -- ADVISORY ONLY: one reader serving entry and exit reports its configured
  -- mode, not actual direction. Modelled as visits, never paired sessions.
  checking_status SMALLINT,
  -- Left unmapped on purpose: only one sample value is attested.
  event_code TEXT,

  raw JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT access_events_unique_scan
    UNIQUE (gym_id, device_serial, subject_id, occurred_at)
);

CREATE INDEX IF NOT EXISTS idx_access_events_gym_time
  ON access_events(gym_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_events_member_time
  ON access_events(member_id, occurred_at DESC);

COMMENT ON TABLE access_events IS 'Successful entries pushed by the terminal. Refused scans are NOT delivered by the device and are deliberately not polled — our own records already explain why a member was refused.';

-- ============================================================
-- OUTBOX ENQUEUE TRIGGER
-- ============================================================
-- Enqueue on the members table rather than from the use-cases, so no code path
-- can bypass the outbox. The trigger ONLY enqueues: it never calls out and
-- never writes members.status (migration 20260727000002 removed a SQL function
-- that did, and it must not come back).
CREATE OR REPLACE FUNCTION enqueue_access_sync_for_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_account BOOLEAN;
BEGIN
  -- Inert for every gym without access control configured, which is all of them
  -- until an Enterprise gym opts in. Keeps the trigger free for everyone else.
  SELECT EXISTS (
    SELECT 1 FROM access_control_accounts a
    WHERE a.gym_id = NEW.gym_id AND a.is_active
  ) INTO v_has_account;

  IF NOT v_has_account THEN
    RETURN NEW;
  END IF;

  -- Only enqueue when something access-relevant actually changed.
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.next_due_date IS NOT DISTINCT FROM OLD.next_due_date
     AND NEW.membership_start_date IS NOT DISTINCT FROM OLD.membership_start_date
     AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at THEN
    RETURN NEW;
  END IF;

  INSERT INTO access_sync_jobs (gym_id, member_id, intent, payload)
  VALUES (
    NEW.gym_id,
    NEW.id,
    'reconcile_member',
    jsonb_build_object('reason', TG_OP)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_access_sync ON members;
CREATE TRIGGER trg_enqueue_access_sync
  AFTER INSERT OR UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_access_sync_for_member();

COMMENT ON FUNCTION enqueue_access_sync_for_member() IS 'Enqueues an access-sync intent when a member''s access-relevant fields change. Enqueue only — never calls out, never writes members.status.';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE access_control_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_access_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_events ENABLE ROW LEVEL SECURITY;

-- access_control_secrets deliberately gets NO policies: service-role only.

DROP POLICY IF EXISTS "Gym owners view own access account" ON access_control_accounts;
CREATE POLICY "Gym owners view own access account"
  ON access_control_accounts FOR SELECT
  USING (EXISTS (SELECT 1 FROM gyms WHERE gyms.id = access_control_accounts.gym_id AND gyms.user_id = auth.uid()));

DROP POLICY IF EXISTS "Gym owners view own devices" ON access_devices;
CREATE POLICY "Gym owners view own devices"
  ON access_devices FOR SELECT
  USING (EXISTS (SELECT 1 FROM gyms WHERE gyms.id = access_devices.gym_id AND gyms.user_id = auth.uid()));

DROP POLICY IF EXISTS "Gym owners view own subjects" ON member_access_subjects;
CREATE POLICY "Gym owners view own subjects"
  ON member_access_subjects FOR SELECT
  USING (EXISTS (SELECT 1 FROM gyms WHERE gyms.id = member_access_subjects.gym_id AND gyms.user_id = auth.uid()));

DROP POLICY IF EXISTS "Gym owners view own access events" ON access_events;
CREATE POLICY "Gym owners view own access events"
  ON access_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM gyms WHERE gyms.id = access_events.gym_id AND gyms.user_id = auth.uid()));

-- Sync jobs carry vendor error text, so gym owners do not read them directly;
-- the UI surfaces a sanitized status instead (rules 2.8 / 2.9).
