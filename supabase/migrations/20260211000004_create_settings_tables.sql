-- Create settings and supporting tables
-- Includes: plan_types, discounts, sms_logs, otp_tokens

-- ============================================================
-- PLAN TYPES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to gym
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,

  -- Plan configuration
  plan_type member_plan_type NOT NULL,
  default_amount DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT positive_default_amount CHECK (default_amount > 0),
  CONSTRAINT unique_gym_plan_type UNIQUE (gym_id, plan_type)
);

-- Create indexes
CREATE INDEX idx_plan_types_gym_id ON plan_types(gym_id);
CREATE INDEX idx_plan_types_active ON plan_types(gym_id, is_active);

-- Create trigger for plan_types table
CREATE TRIGGER update_plan_types_updated_at
  BEFORE UPDATE ON plan_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE plan_types IS 'Stores plan type configurations per gym (monthly, daily, annual)';
COMMENT ON COLUMN plan_types.default_amount IS 'Default amount in LKR for this plan type';
COMMENT ON COLUMN plan_types.is_active IS 'Whether this plan type is available for new members';


-- ============================================================
-- DISCOUNTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to gym
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,

  -- Discount details
  discount_name TEXT NOT NULL,
  discount_percentage INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_percentage CHECK (discount_percentage >= 1 AND discount_percentage <= 100),
  CONSTRAINT discount_name_not_empty CHECK (char_length(discount_name) > 0),
  CONSTRAINT unique_gym_discount_name UNIQUE (gym_id, discount_name)
);

-- Create indexes
CREATE INDEX idx_discounts_gym_id ON discounts(gym_id);
CREATE INDEX idx_discounts_active ON discounts(gym_id, is_active);

-- Create trigger for discounts table
CREATE TRIGGER update_discounts_updated_at
  BEFORE UPDATE ON discounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE discounts IS 'Stores discount presets per gym';
COMMENT ON COLUMN discounts.discount_percentage IS 'Discount percentage (1-100)';
COMMENT ON COLUMN discounts.is_active IS 'Whether this discount is available for use';


-- ============================================================
-- SMS LOGS TABLE
-- ============================================================
CREATE TYPE sms_type AS ENUM ('reminder_7day', 'reminder_3day', 'due_today', 'overdue', 'receipt');
CREATE TYPE delivery_status AS ENUM ('sent', 'delivered', 'failed');

CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,

  -- SMS details
  sms_type sms_type NOT NULL,
  phone_number TEXT NOT NULL,
  message_body TEXT NOT NULL,

  -- Delivery tracking
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  delivery_status delivery_status DEFAULT 'sent' NOT NULL,
  text_lk_message_id TEXT, -- External API message ID

  -- Constraints
  CONSTRAINT valid_sms_phone CHECK (phone_number ~* '^\+94[0-9]{9}$')
);

-- Create indexes
CREATE INDEX idx_sms_logs_member_id ON sms_logs(member_id);
CREATE INDEX idx_sms_logs_gym_id ON sms_logs(gym_id);
CREATE INDEX idx_sms_logs_sent_at ON sms_logs(sent_at DESC);
CREATE INDEX idx_sms_logs_delivery_status ON sms_logs(delivery_status);
CREATE INDEX idx_sms_logs_member_sent ON sms_logs(member_id, sent_at DESC);

COMMENT ON TABLE sms_logs IS 'Stores SMS delivery logs for tracking reminders and receipts';
COMMENT ON COLUMN sms_logs.sms_type IS 'Type of SMS: reminder (7-day, 3-day, due today, overdue) or receipt';
COMMENT ON COLUMN sms_logs.delivery_status IS 'Delivery status: sent, delivered, or failed';
COMMENT ON COLUMN sms_logs.text_lk_message_id IS 'Message ID from text.lk API (null for mock SMS)';


-- ============================================================
-- OTP TOKENS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- OTP details
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL, -- Should be hashed in production
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_otp_phone CHECK (phone_number ~* '^\+94[0-9]{9}$'),
  CONSTRAINT otp_code_length CHECK (char_length(otp_code) = 6)
);

-- Create indexes
CREATE INDEX idx_otp_tokens_phone_number ON otp_tokens(phone_number);
CREATE INDEX idx_otp_tokens_expires_at ON otp_tokens(expires_at);
CREATE INDEX idx_otp_tokens_phone_unused ON otp_tokens(phone_number, used, expires_at)
  WHERE used = FALSE;

COMMENT ON TABLE otp_tokens IS 'Stores OTP tokens for phone-based authentication (60-second expiry)';
COMMENT ON COLUMN otp_tokens.otp_code IS 'Six-digit OTP code (should be hashed)';
COMMENT ON COLUMN otp_tokens.expires_at IS 'OTP expiry time (60 seconds from creation)';
COMMENT ON COLUMN otp_tokens.used IS 'Whether this OTP has been used';
