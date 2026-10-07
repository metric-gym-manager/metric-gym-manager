-- Outreach looks after itself (owner request, 2026-10-06): what used to be
-- two owner tasks — removing whoever replied "unsubscribe", and checking
-- Resend for bounces and spam complaints after each send — now happen on
-- their own, from Resend's webhook (/api/webhooks/resend).
--
-- outreach_recipients.status gains two ways a series ends:
--   'bounced'     the address does not exist, or Resend will not deliver to it
--   'complained'  the recipient marked an email as spam
-- Neither is ever written to again, like 'unsubscribed'.
--
-- outreach_events: one row per email sent and per series stopped (sent,
-- unsubscribed, bounced, complained, suppressed). The safety brake reads it
-- (the share of sends that bounced, the number of complaints) and so does the
-- weekly summary. A row is written only when a recipient's status actually
-- changes, so a webhook delivered twice never counts twice.
--
-- outreach_campaigns: one row per campaign that has been paused or reported
-- on. `paused_at` stops every send; the brake sets it and the owner clears it
-- (`scripts/send-outreach.ts --resume`, which also sets `resumed_at`, so the
-- brake counts afresh from there). `pause_alerted_at` makes the owner's alert
-- at-least-once, and `last_summary_at` makes the weekly summary at-most-once.
--
-- RLS on with NO policies on both new tables: only the service role reads or
-- writes them. No functions, so rule 2.18 has nothing to pin. Idempotent (R11).

ALTER TABLE outreach_recipients
  DROP CONSTRAINT IF EXISTS outreach_recipients_status_check;
ALTER TABLE outreach_recipients
  ADD CONSTRAINT outreach_recipients_status_check
  CHECK (status IN (
    'active', 'done', 'unsubscribed', 'failed', 'bounced', 'complained'
  ));

CREATE TABLE IF NOT EXISTS outreach_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign text NOT NULL,
  email text NOT NULL CHECK (email = lower(email)),
  type text NOT NULL CHECK (type IN (
    'sent', 'unsubscribed', 'bounced', 'complained', 'suppressed'
  )),
  step int CHECK (step BETWEEN 0 AND 4),
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_events_campaign_created
  ON outreach_events (campaign, created_at);

ALTER TABLE outreach_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE outreach_events IS
  'Outreach sends and stops (bounce, complaint, unsubscribe), for the safety brake and the weekly summary. Service role only.';

CREATE TABLE IF NOT EXISTS outreach_campaigns (
  campaign text PRIMARY KEY,
  paused_at timestamptz,
  pause_reason text,
  pause_alerted_at timestamptz,
  resumed_at timestamptz,
  last_summary_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE outreach_campaigns ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE outreach_campaigns IS
  'Outreach campaign state: paused by the safety brake, resumed by the owner, last weekly summary. Service role only.';
COMMENT ON COLUMN outreach_campaigns.resumed_at IS
  'The brake counts bounces and complaints from here, so an old spike cannot pause a resumed campaign again';

DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outreach_recipients_status_check'
      AND conrelid = 'public.outreach_recipients'::regclass
      AND pg_get_constraintdef(oid) LIKE '%complained%'
  ) THEN
    RAISE EXCEPTION 'outreach_recipients status check does not allow bounced and complained';
  END IF;
  FOREACH t IN ARRAY ARRAY['outreach_recipients', 'outreach_events', 'outreach_campaigns']
  LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class
            WHERE oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION '% does not have RLS enabled', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = t) THEN
      RAISE EXCEPTION '% must have no policies (service role only)', t;
    END IF;
  END LOOP;
END $$;
