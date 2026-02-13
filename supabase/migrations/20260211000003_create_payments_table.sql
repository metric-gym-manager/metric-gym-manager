-- Create payments table
-- This table stores payment history for all members

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to member
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Payment details
  payment_date DATE DEFAULT CURRENT_DATE NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,

  -- Discount information (snapshot at time of payment)
  discount_applied TEXT, -- Name of the discount
  discount_percentage INTEGER, -- Percentage value (1-100)

  -- Calculated next due date at time of payment
  next_due_date_calculated DATE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT positive_amount_paid CHECK (amount_paid > 0),
  CONSTRAINT valid_discount_percentage CHECK (
    discount_percentage IS NULL OR
    (discount_percentage >= 1 AND discount_percentage <= 100)
  ),
  CONSTRAINT discount_complete CHECK (
    (discount_applied IS NULL AND discount_percentage IS NULL) OR
    (discount_applied IS NOT NULL AND discount_percentage IS NOT NULL)
  )
);

-- Create indexes for frequently queried columns
CREATE INDEX idx_payments_member_id ON payments(member_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_payments_member_date ON payments(member_id, payment_date DESC);

-- Add comments for documentation
COMMENT ON TABLE payments IS 'Stores payment history for all members. Discount details are snapshotted at payment time.';
COMMENT ON COLUMN payments.member_id IS 'References the member who made this payment';
COMMENT ON COLUMN payments.amount_paid IS 'Actual amount paid in LKR (after discount)';
COMMENT ON COLUMN payments.discount_applied IS 'Name of discount applied (snapshot)';
COMMENT ON COLUMN payments.discount_percentage IS 'Discount percentage at time of payment (snapshot)';
COMMENT ON COLUMN payments.next_due_date_calculated IS 'Next due date calculated at time of payment';
