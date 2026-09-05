-- Record the admission fee as its own component of a payment.
--
-- The gym-level admission fee is charged once, on a member's first payment, and
-- is currently folded into `amount_paid` with nothing to distinguish it. That
-- makes it invisible to the revenue model: it is cash a membership schedule can
-- never predict, so it inflates "collected" against "billed" and can push the
-- collection rate above 100%. 8 first payments exceed their member's plan
-- amount for this reason (1 gym has the fee enabled today).
--
-- `amount_paid` keeps its meaning — the TOTAL the member handed over. Changing
-- it would silently rewrite every historical sum and every receipt. The fee is
-- added as a *component*, so plan revenue is `amount_paid - admission_fee` and
-- nothing existing shifts.
--
-- NOT backfilled. The fee at the time of a historical payment is unrecoverable:
-- deriving `amount_paid - plan_amount` assumes the plan price has not changed
-- since, and it frequently has. Pre-migration admission fees therefore remain
-- inside `amount_paid` and are counted as plan revenue. That is a known,
-- bounded inaccuracy in historical figures — recorded in
-- docs/architecture/revenue-billing-model.md rather than papered over with a
-- guess.
--
-- NOT NULL DEFAULT 0 rather than nullable: every existing row is genuinely
-- "no separately-recorded fee", and a default of zero keeps every SUM and
-- subtraction free of NULL handling.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS admission_fee numeric(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.payments.admission_fee IS
  'One-off gym admission fee included in amount_paid (0 when not charged). '
  'Plan revenue is amount_paid - admission_fee. Rows written before 2026-09-05 '
  'are 0 because the split was not recorded then, not because no fee was paid.';

-- Non-zero fees are rare, so the index is partial: it serves "what one-off
-- revenue did we take this period" without carrying a row per payment.
CREATE INDEX IF NOT EXISTS idx_payments_admission_fee
  ON public.payments (gym_id, payment_date)
  WHERE admission_fee > 0;

-- Guard against a negative fee, which would make plan revenue exceed the total
-- paid. A CHECK is cheap and this column is written from two code paths.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_admission_fee_non_negative'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_admission_fee_non_negative
      CHECK (admission_fee >= 0);
  END IF;
END $$;
