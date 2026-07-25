-- Admission / registration fee (gym-level billing setup)
--
-- A gym may charge a one-time admission (registration) fee on top of the first
-- membership payment. The fee is a single gym-level value, configured in the
-- Membership Setup screen. When admission_fee_enabled is true the fee is shown
-- on the public QR self-registration form and added to the amount due; when
-- false it is ignored everywhere (self-registration and manual registration).
--
-- The charged amount is always resolved server-side from these columns, never
-- from client input (same trust model as plan_types.default_amount).

ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS admission_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admission_fee_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE gyms
  DROP CONSTRAINT IF EXISTS admission_fee_non_negative;
ALTER TABLE gyms
  ADD CONSTRAINT admission_fee_non_negative CHECK (admission_fee >= 0);

COMMENT ON COLUMN gyms.admission_fee IS 'One-time admission/registration fee in LKR, charged on first registration when admission_fee_enabled is true.';
COMMENT ON COLUMN gyms.admission_fee_enabled IS 'Whether the admission fee is active. When true it appears on the self-registration form and is added to the first payment.';
