-- Leads: retire the old tier names for good.
--
-- Applied once the code that sends 'lite' / 'pro' is live (20261005000001
-- accepted both sets during the switchover). Anything stored under an old name
-- in between is renamed first. `LeadConfig.test.ts` checks that this list
-- equals the LeadInterest enum.
--
-- Idempotent: every statement can run twice, and on an empty database.

UPDATE leads SET interest = 'lite' WHERE interest = 'starter';
UPDATE leads SET interest = 'pro' WHERE interest = 'growth';

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_interest_check;
ALTER TABLE leads ADD CONSTRAINT leads_interest_check
  CHECK (interest IN ('demo', 'sales', 'lite', 'pro', 'enterprise'));

-- End state: the constraint lists exactly the five current values.
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def
  FROM pg_constraint
  WHERE conrelid = 'public.leads'::regclass AND conname = 'leads_interest_check';
  IF def IS NULL OR def ~ 'starter|growth' OR def !~ 'lite' OR def !~ 'pro' THEN
    RAISE EXCEPTION 'leads_interest_check is not the Lite/Pro list: %', def;
  END IF;
END $$;
