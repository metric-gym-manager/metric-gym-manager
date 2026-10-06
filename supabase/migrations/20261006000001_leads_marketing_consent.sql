-- Marketing consent on demo requests (owner decision, 2026-10-06).
--
-- The demo form gained an unticked "email me product news and offers" box.
-- A ticked box is stored as the moment it was given: this column IS the
-- consent record, so it is a timestamp rather than a boolean. NULL means the
-- box was not ticked, and every lead captured before today is NULL.
--
-- Consenting leads are added to the Resend "Demo leads" audience
-- (docs/architecture/marketing-email.md). Opting out later is recorded in
-- Resend per topic, not here.
--
-- Idempotent (R11). RLS is unchanged: writes still come only from the
-- service-role client, and the one policy is the SaaS-admin read.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;

COMMENT ON COLUMN leads.marketing_consent_at IS
  'When the visitor ticked the marketing-email consent box on the demo form; NULL when they did not';
