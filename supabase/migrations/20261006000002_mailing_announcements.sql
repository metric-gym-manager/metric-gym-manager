-- Release and policy-change announcements (owner request, 2026-10-06).
--
-- The send-announcements cron emails the gyms when a new version reaches
-- production and when a legal page changes (docs/architecture/marketing-email.md,
-- "Announcements"). This table is its memory: one row per thing announced,
-- CLAIMED before anything reaches Resend. The unique (kind, ref) is the guard
-- against sending twice — a second run, or two at once, loses the insert.
--
--   kind   'release' (ref = the version, '1.2.0')
--          'policy'  (ref = page@date, 'privacy@2026-10-06')
--   status 'pending'   claimed; or interrupted, and reconciled by broadcast
--                      name once stale
--          'scheduled' waiting out the 24-hour hold the owner can cancel in
--          'sent' / 'canceled'  what Resend says happened
--          'skipped'   a release with nothing in it for the gyms
--
-- RLS on with NO policies: only the service role (createAdminClient) reads or
-- writes it, and gym owners never see it. No functions, so rule 2.18 has
-- nothing to pin. Idempotent (R11).

CREATE TABLE IF NOT EXISTS mailing_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('release', 'policy')),
  ref text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'sent', 'canceled', 'skipped')),
  broadcast_id text,
  preview_broadcast_id text,
  scheduled_for timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mailing_announcements_kind_ref_key UNIQUE (kind, ref)
);

ALTER TABLE mailing_announcements ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE mailing_announcements IS
  'One row per release or policy change emailed to the gyms; unique (kind, ref) stops a second send. Service role only.';
COMMENT ON COLUMN mailing_announcements.ref IS
  'The version (release) or page@date (policy) announced';
COMMENT ON COLUMN mailing_announcements.broadcast_id IS
  'The Resend broadcast to the gyms, scheduled after the hold';
COMMENT ON COLUMN mailing_announcements.preview_broadcast_id IS
  'The Resend broadcast previewed to the Test segment; set once, so a retry never previews twice';
COMMENT ON COLUMN mailing_announcements.updated_at IS
  'Written by the application on every change; a pending row older than 15 minutes is treated as interrupted';

-- The end state, asserted: replaying this on a database where the table was
-- made differently must fail loudly, not leave a table without its guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mailing_announcements_kind_ref_key'
      AND conrelid = 'public.mailing_announcements'::regclass
  ) THEN
    RAISE EXCEPTION 'mailing_announcements has no unique (kind, ref)';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.mailing_announcements'::regclass) THEN
    RAISE EXCEPTION 'mailing_announcements does not have RLS enabled';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'mailing_announcements') THEN
    RAISE EXCEPTION 'mailing_announcements must have no policies (service role only)';
  END IF;
END $$;
