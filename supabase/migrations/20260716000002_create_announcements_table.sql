-- Capture schema drift: the announcements table (SMS broadcast feature) was
-- created directly in the production database and never captured as a
-- migration, so the chain could not rebuild it on a fresh project (the
-- announcements API failed with "table public.announcements not found").
--
-- This migration reproduces the exact production shape (verified against the
-- pre-refactor schema snapshot). Every statement is idempotent, so it is a
-- no-op on the existing production database and only fills the gap on a
-- from-scratch replay.

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  message text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'completed', 'failed')),
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  session_failures jsonb DEFAULT '[]'::jsonb
);

COMMENT ON TABLE announcements IS 'Gym-wide SMS broadcasts with per-recipient send/failure tracking';

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_announcements_gym_id ON announcements USING btree (gym_id);
CREATE INDEX IF NOT EXISTS idx_announcements_sent_at ON announcements USING btree (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements USING btree (status);
CREATE INDEX IF NOT EXISTS idx_announcements_session_failures
  ON announcements USING gin (session_failures)
  WHERE (session_failures <> '[]'::jsonb);

-- ============================================================
-- ROW LEVEL SECURITY (multi-tenant isolation by gym owner)
-- ============================================================

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gym owners can view own announcements" ON announcements;
CREATE POLICY "Gym owners can view own announcements"
  ON announcements FOR SELECT
  USING (gym_id IN (SELECT gyms.id FROM gyms WHERE gyms.user_id = auth.uid()));

DROP POLICY IF EXISTS "Gym owners can create announcements" ON announcements;
CREATE POLICY "Gym owners can create announcements"
  ON announcements FOR INSERT
  WITH CHECK (gym_id IN (SELECT gyms.id FROM gyms WHERE gyms.user_id = auth.uid()));

-- ============================================================
-- MAINTENANCE FUNCTION (clears stale per-session failure payloads)
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_announcement_failures()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE announcements
  SET session_failures = '[]'::jsonb
  WHERE sent_at < NOW() - INTERVAL '24 hours'
    AND session_failures != '[]'::jsonb;
END;
$$;
