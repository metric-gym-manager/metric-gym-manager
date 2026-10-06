-- Outreach becomes a four-email series, one a week (owner request,
-- 2026-10-06, the same day the one-off table was made; it held no rows).
--
-- Each address gets emails 1 to 4 in order and then no more:
--   step          emails of the series sent so far (0 to 4)
--   last_sent_at  when the last one went (the next waits at least 6 days)
--   failures      sends that failed in a row (3 stop the address)
--   status 'active'        still receiving the series
--          'done'          all four sent
--          'unsubscribed'  opted out, or taken out on request; never again
--          'failed'        sends kept failing; given up
--
-- The next step is CLAIMED with a conditional update (step must still be
-- the one read) before the send, so two runs cannot send the same email.
-- RLS stays on with no policies; the end state is asserted. Idempotent (R11).

ALTER TABLE outreach_recipients
  ADD COLUMN IF NOT EXISTS step int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS failures int NOT NULL DEFAULT 0;

ALTER TABLE outreach_recipients
  DROP CONSTRAINT IF EXISTS outreach_recipients_status_check;

UPDATE outreach_recipients
SET status = CASE status
  WHEN 'pending' THEN 'active'
  WHEN 'sent' THEN 'active'
  WHEN 'skipped' THEN 'unsubscribed'
  ELSE status
END
WHERE status IN ('pending', 'sent', 'skipped');

ALTER TABLE outreach_recipients ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE outreach_recipients
  ADD CONSTRAINT outreach_recipients_status_check
  CHECK (status IN ('active', 'done', 'unsubscribed', 'failed'));

ALTER TABLE outreach_recipients
  DROP CONSTRAINT IF EXISTS outreach_recipients_step_check;
ALTER TABLE outreach_recipients
  ADD CONSTRAINT outreach_recipients_step_check CHECK (step BETWEEN 0 AND 4);

DROP INDEX IF EXISTS idx_outreach_recipients_pending;
CREATE INDEX IF NOT EXISTS idx_outreach_recipients_due
  ON outreach_recipients (campaign, created_at)
  WHERE status = 'active';

COMMENT ON COLUMN outreach_recipients.step IS
  'Emails of the four-email series sent so far (0 to 4)';
COMMENT ON COLUMN outreach_recipients.last_sent_at IS
  'When the last email of the series went; the next waits at least 6 days';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outreach_recipients_campaign_email_key'
      AND conrelid = 'public.outreach_recipients'::regclass
  ) THEN
    RAISE EXCEPTION 'outreach_recipients has no unique (campaign, email)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outreach_recipients_status_check'
      AND conrelid = 'public.outreach_recipients'::regclass
      AND pg_get_constraintdef(oid) LIKE '%unsubscribed%'
  ) THEN
    RAISE EXCEPTION 'outreach_recipients status check is not the series one';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.outreach_recipients'::regclass) THEN
    RAISE EXCEPTION 'outreach_recipients does not have RLS enabled';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'outreach_recipients') THEN
    RAISE EXCEPTION 'outreach_recipients must have no policies (service role only)';
  END IF;
END $$;
