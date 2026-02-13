-- Create members table
-- This table stores gym members/customers

-- Create ENUM types for members
CREATE TYPE member_plan_type AS ENUM ('monthly', 'daily', 'annual');
CREATE TYPE member_status AS ENUM ('active', 'expired', 'suspended', 'cancelled');

CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to gym
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,

  -- Personal information
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,

  -- Emergency contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,

  -- Membership details
  plan_type member_plan_type NOT NULL,
  plan_amount DECIMAL(10, 2) NOT NULL,
  discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL,
  recurring_discount BOOLEAN DEFAULT FALSE,
  status member_status DEFAULT 'active' NOT NULL,

  -- Dates
  registered_date DATE DEFAULT CURRENT_DATE NOT NULL,
  membership_start_date DATE DEFAULT CURRENT_DATE NOT NULL,
  next_due_date DATE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_phone CHECK (phone_number ~* '^\+94[0-9]{9}$'),
  CONSTRAINT valid_emergency_phone CHECK (
    emergency_contact_phone IS NULL OR
    emergency_contact_phone ~* '^\+94[0-9]{9}$'
  ),
  CONSTRAINT positive_amount CHECK (plan_amount > 0),
  CONSTRAINT name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT valid_dates CHECK (membership_start_date >= registered_date),
  CONSTRAINT emergency_contact_complete CHECK (
    (emergency_contact_name IS NULL AND emergency_contact_phone IS NULL) OR
    (emergency_contact_name IS NOT NULL AND emergency_contact_phone IS NOT NULL)
  )
);

-- Create indexes for frequently queried columns
CREATE INDEX idx_members_gym_id ON members(gym_id);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_next_due_date ON members(next_due_date);
CREATE INDEX idx_members_phone_number ON members(phone_number);
CREATE INDEX idx_members_plan_type ON members(plan_type);
CREATE INDEX idx_members_gym_status ON members(gym_id, status);
CREATE INDEX idx_members_gym_due_date ON members(gym_id, next_due_date);

-- Composite index for overdue queries
CREATE INDEX idx_members_overdue ON members(gym_id, status, next_due_date)
  WHERE status = 'active';

-- Create trigger for members table
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE members IS 'Stores gym members/customers with their membership details';
COMMENT ON COLUMN members.gym_id IS 'References the gym this member belongs to';
COMMENT ON COLUMN members.phone_number IS 'Phone number in +94 format for SMS notifications';
COMMENT ON COLUMN members.plan_type IS 'Type of membership plan: monthly, daily, or annual';
COMMENT ON COLUMN members.plan_amount IS 'Monthly payment amount in LKR';
COMMENT ON COLUMN members.discount_id IS 'Optional reference to discount preset';
COMMENT ON COLUMN members.recurring_discount IS 'Whether discount applies to all future payments';
COMMENT ON COLUMN members.status IS 'Current membership status: active, expired, suspended, or cancelled';
COMMENT ON COLUMN members.next_due_date IS 'Date when next payment is due';
