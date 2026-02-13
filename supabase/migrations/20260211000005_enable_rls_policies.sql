-- Enable Row Level Security (RLS) policies for multi-tenant isolation
-- Each gym can only access their own data

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- GYMS TABLE POLICIES
-- ============================================================

-- Gym owners can view their own gym record
CREATE POLICY "Gym owners can view own gym"
  ON gyms FOR SELECT
  USING (auth.uid() = user_id);

-- Gym owners can update their own gym record
CREATE POLICY "Gym owners can update own gym"
  ON gyms FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow insert during registration (handled by service role or auth trigger)
CREATE POLICY "Allow gym creation during registration"
  ON gyms FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- MEMBERS TABLE POLICIES
-- ============================================================

-- Gym owners can view their own members
CREATE POLICY "Gym owners can view own members"
  ON members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = members.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

-- Gym owners can insert members to their gym
CREATE POLICY "Gym owners can insert members"
  ON members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = members.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

-- Gym owners can update their own members
CREATE POLICY "Gym owners can update own members"
  ON members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = members.gym_id
      AND gyms.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = members.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

-- Gym owners can delete their own members
CREATE POLICY "Gym owners can delete own members"
  ON members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = members.gym_id
      AND gyms.user_id = auth.uid()
    )
  );


-- ============================================================
-- PAYMENTS TABLE POLICIES
-- ============================================================

-- Gym owners can view payments for their members
CREATE POLICY "Gym owners can view member payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members
      JOIN gyms ON gyms.id = members.gym_id
      WHERE members.id = payments.member_id
      AND gyms.user_id = auth.uid()
    )
  );

-- Gym owners can insert payments for their members
CREATE POLICY "Gym owners can insert member payments"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members
      JOIN gyms ON gyms.id = members.gym_id
      WHERE members.id = payments.member_id
      AND gyms.user_id = auth.uid()
    )
  );

-- Payments are immutable (no updates or deletes for audit trail)


-- ============================================================
-- PLAN TYPES TABLE POLICIES
-- ============================================================

-- Gym owners can view their plan types
CREATE POLICY "Gym owners can view own plan types"
  ON plan_types FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = plan_types.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

-- Gym owners can manage their plan types
CREATE POLICY "Gym owners can manage plan types"
  ON plan_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = plan_types.gym_id
      AND gyms.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = plan_types.gym_id
      AND gyms.user_id = auth.uid()
    )
  );


-- ============================================================
-- DISCOUNTS TABLE POLICIES
-- ============================================================

-- Gym owners can view their discounts
CREATE POLICY "Gym owners can view own discounts"
  ON discounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = discounts.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

-- Gym owners can manage their discounts
CREATE POLICY "Gym owners can manage discounts"
  ON discounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = discounts.gym_id
      AND gyms.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = discounts.gym_id
      AND gyms.user_id = auth.uid()
    )
  );


-- ============================================================
-- SMS LOGS TABLE POLICIES
-- ============================================================

-- Gym owners can view their SMS logs
CREATE POLICY "Gym owners can view own SMS logs"
  ON sms_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = sms_logs.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

-- Allow insert of SMS logs (for system/cron jobs via service role)
CREATE POLICY "Allow SMS log creation"
  ON sms_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = sms_logs.gym_id
      AND gyms.user_id = auth.uid()
    )
  );


-- ============================================================
-- OTP TOKENS TABLE POLICIES
-- ============================================================

-- OTP tokens are publicly insertable (for login flow)
CREATE POLICY "Anyone can create OTP tokens"
  ON otp_tokens FOR INSERT
  WITH CHECK (true);

-- OTP tokens are publicly readable (for verification)
-- Note: In production, OTP codes should be hashed
CREATE POLICY "Anyone can verify OTP tokens"
  ON otp_tokens FOR SELECT
  USING (true);

-- OTP tokens can be marked as used
CREATE POLICY "OTP tokens can be marked used"
  ON otp_tokens FOR UPDATE
  USING (true)
  WITH CHECK (used = true); -- Can only mark as used, not revert


-- ============================================================
-- HELPER FUNCTION FOR CHECKING GYM OWNERSHIP
-- ============================================================

-- Function to check if the current user owns a gym
CREATE OR REPLACE FUNCTION is_gym_owner(p_gym_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM gyms
    WHERE id = p_gym_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_gym_owner IS 'Checks if the current authenticated user owns the specified gym';
