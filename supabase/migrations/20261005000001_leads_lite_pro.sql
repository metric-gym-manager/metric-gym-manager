-- Leads: name the tiers Lite and Pro, and record whether each lead was emailed.
--
-- 1. Lite and Pro. A visitor who picked Lite or Pro in the demo form was
--    stored as 'starter' / 'growth', the tier names retired in July 2026.
--    Existing rows are renamed, and during the switchover the check accepts
--    both the old and the new names, so the live form (still sending the old
--    ones until the deploy) never fails. 20261005000002 removes the old names
--    once the new code is live.
--
-- 2. Notification. Each demo request is now emailed to hello@metricgymos.com
--    (SubmitLead). `notified_at` records a sent email; `notification_error`
--    records why one was not sent. A lead with neither was stored before this
--    change.
--
-- Idempotent: every statement can run twice, and on an empty database.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS notified_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notification_error text;

COMMENT ON COLUMN leads.notified_at IS 'When the lead was emailed to hello@metricgymos.com (null: not emailed)';
COMMENT ON COLUMN leads.notification_error IS 'Why the lead email was not sent, when it was not';

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_interest_check;

UPDATE leads SET interest = 'lite' WHERE interest = 'starter';
UPDATE leads SET interest = 'pro' WHERE interest = 'growth';

-- Switchover only: the old names stay valid until 20261005000002.
ALTER TABLE leads ADD CONSTRAINT leads_interest_check
  CHECK (interest IN ('demo', 'sales', 'lite', 'pro', 'enterprise', 'starter', 'growth'));

-- End state.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM leads WHERE interest IN ('starter', 'growth')) THEN
    RAISE EXCEPTION 'leads still carry a retired tier name';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'notified_at'
  ) THEN
    RAISE EXCEPTION 'leads.notified_at is missing';
  END IF;
END $$;
