-- Add gym_id column to payments table for multi-tenant data isolation
-- Migration: 20260303000001

-- Step 1: Add gym_id column (nullable initially to allow backfill)
ALTER TABLE payments
ADD COLUMN gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE;

-- Step 2: Backfill gym_id from the member's gym_id
UPDATE payments p
SET gym_id = m.gym_id
FROM members m
WHERE p.member_id = m.id;

-- Step 3: Make gym_id NOT NULL now that all rows have values
ALTER TABLE payments
ALTER COLUMN gym_id SET NOT NULL;

-- Step 4: Create index for gym_id queries (important for RLS performance)
CREATE INDEX idx_payments_gym_id ON payments(gym_id);
CREATE INDEX idx_payments_gym_member ON payments(gym_id, member_id);

-- Step 5: Add comment for documentation
COMMENT ON COLUMN payments.gym_id IS 'References the gym this payment belongs to (multi-tenant isolation)';

-- Step 6: Update RLS policies for payments table to use gym_id
-- First, drop existing RLS policies if any
DROP POLICY IF EXISTS "Gym owners can view their gym payments" ON payments;
DROP POLICY IF EXISTS "Gym owners can insert their gym payments" ON payments;
DROP POLICY IF EXISTS "Gym owners can update their gym payments" ON payments;
DROP POLICY IF EXISTS "Gym owners can delete their gym payments" ON payments;

-- Create RLS policies using gym_id for better performance
CREATE POLICY "Gym owners can view their gym payments"
  ON payments
  FOR SELECT
  USING (
    gym_id IN (
      SELECT id FROM gyms WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Gym owners can insert their gym payments"
  ON payments
  FOR INSERT
  WITH CHECK (
    gym_id IN (
      SELECT id FROM gyms WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Gym owners can update their gym payments"
  ON payments
  FOR UPDATE
  USING (
    gym_id IN (
      SELECT id FROM gyms WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Gym owners can delete their gym payments"
  ON payments
  FOR DELETE
  USING (
    gym_id IN (
      SELECT id FROM gyms WHERE user_id = auth.uid()
    )
  );

-- Ensure RLS is enabled
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
