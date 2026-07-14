-- Day pass support
--
-- Day passes are recorded as ordinary payment rows (single source of truth
-- for revenue) tagged with payment_type = 'day_pass'. Issuing a day pass
-- sets the member's next_due_date to the following day without changing
-- their plan_type, so a later monthly/annual renewal behaves as before.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'plan_payment'
    CHECK (payment_type IN ('plan_payment', 'day_pass'));

COMMENT ON COLUMN payments.payment_type IS 'plan_payment: regular plan renewal/registration. day_pass: single-day access fee.';

-- Reporting index: day-pass revenue per gym over time
CREATE INDEX IF NOT EXISTS idx_payments_day_pass
  ON payments(gym_id, payment_date DESC)
  WHERE payment_type = 'day_pass';
