-- Outreach campaigns (owner request, 2026-10-06).
--
-- An introduction email to gyms whose contact details are on public pages
-- (scripts/send-outreach.ts, docs/architecture/marketing-email.md
-- "Outreach"). One row per address per campaign, recorded BEFORE anything is
-- sent: the unique (campaign, email) is the guard against emailing anyone the
-- same campaign twice, and `source` is the record of where each address came
-- from.
--
--   status 'pending'  recorded, not yet sent (the next run sends it)
--          'sent'     the email went out (resend_email_id)
--          'skipped'  the address had unsubscribed
--          'failed'   Resend refused it (error)
--
-- Existing gyms and demo requests are never recorded here: the script leaves
-- them out. Opting out is recorded in Resend (Marketing topic), as for every
-- other marketing email.
--
-- RLS on with NO policies: only the service role reads or writes it. No
-- functions, so rule 2.18 has nothing to pin. Idempotent (R11).

CREATE TABLE IF NOT EXISTS outreach_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign text NOT NULL,
  email text NOT NULL CHECK (email = lower(email)),
  gym_name text,
  name text,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  resend_email_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_recipients_campaign_email_key UNIQUE (campaign, email)
);

CREATE INDEX IF NOT EXISTS idx_outreach_recipients_pending
  ON outreach_recipients (campaign, created_at)
  WHERE status = 'pending';

ALTER TABLE outreach_recipients ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE outreach_recipients IS
  'Outreach campaign recipients from public pages; unique (campaign, email) stops a second send. Service role only.';
COMMENT ON COLUMN outreach_recipients.source IS
  'Where the address was found, as given when the list was imported';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outreach_recipients_campaign_email_key'
      AND conrelid = 'public.outreach_recipients'::regclass
  ) THEN
    RAISE EXCEPTION 'outreach_recipients has no unique (campaign, email)';
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
