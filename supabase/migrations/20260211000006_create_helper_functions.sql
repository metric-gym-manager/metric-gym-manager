-- Helper functions for business logic

-- ============================================================
-- CALCULATE NEXT DUE DATE
-- ============================================================
-- Calculates the next payment due date based on plan type and start date
CREATE OR REPLACE FUNCTION calculate_next_due_date(
  p_plan_type member_plan_type,
  p_start_date DATE
)
RETURNS DATE AS $$
BEGIN
  RETURN CASE p_plan_type
    WHEN 'daily' THEN p_start_date + INTERVAL '1 day'
    WHEN 'monthly' THEN p_start_date + INTERVAL '30 days'
    WHEN 'annual' THEN p_start_date + INTERVAL '365 days'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_next_due_date IS 'Calculates next payment due date based on plan type (daily: +1d, monthly: +30d, annual: +365d)';


-- ============================================================
-- GET OVERDUE MEMBERS
-- ============================================================
-- Returns all members for a gym who are overdue (>7 days past due date)
CREATE OR REPLACE FUNCTION get_overdue_members(p_gym_id UUID)
RETURNS TABLE (
  member_id UUID,
  member_name TEXT,
  phone_number TEXT,
  plan_type member_plan_type,
  plan_amount DECIMAL,
  next_due_date DATE,
  days_overdue INTEGER,
  status member_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS member_id,
    m.name AS member_name,
    m.phone_number,
    m.plan_type,
    m.plan_amount,
    m.next_due_date,
    (CURRENT_DATE - m.next_due_date)::INTEGER AS days_overdue,
    m.status
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    AND m.next_due_date < CURRENT_DATE - INTERVAL '7 days'
  ORDER BY m.next_due_date ASC; -- Most overdue first
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_overdue_members IS 'Returns all active members who are more than 7 days overdue, sorted by most overdue first';


-- ============================================================
-- GET UPCOMING DUE MEMBERS
-- ============================================================
-- Returns members whose payment is due within specified days
CREATE OR REPLACE FUNCTION get_upcoming_due_members(
  p_gym_id UUID,
  p_days_ahead INTEGER DEFAULT 7
)
RETURNS TABLE (
  member_id UUID,
  member_name TEXT,
  phone_number TEXT,
  plan_type member_plan_type,
  plan_amount DECIMAL,
  next_due_date DATE,
  days_until_due INTEGER,
  status member_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS member_id,
    m.name AS member_name,
    m.phone_number,
    m.plan_type,
    m.plan_amount,
    m.next_due_date,
    (m.next_due_date - CURRENT_DATE)::INTEGER AS days_until_due,
    m.status
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    AND m.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL
  ORDER BY m.next_due_date ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_upcoming_due_members IS 'Returns active members whose payment is due within the specified number of days';


-- ============================================================
-- CALCULATE PAYMENT AMOUNT WITH DISCOUNT
-- ============================================================
-- Calculates final payment amount after applying discount
CREATE OR REPLACE FUNCTION calculate_payment_amount(
  p_plan_amount DECIMAL,
  p_discount_percentage INTEGER DEFAULT NULL
)
RETURNS DECIMAL AS $$
BEGIN
  IF p_discount_percentage IS NULL OR p_discount_percentage = 0 THEN
    RETURN p_plan_amount;
  END IF;

  RETURN ROUND(p_plan_amount * (100 - p_discount_percentage) / 100, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_payment_amount IS 'Calculates payment amount after applying discount percentage (returns LKR with 2 decimal places)';


-- ============================================================
-- GET MEMBER PAYMENT HISTORY
-- ============================================================
-- Returns payment history for a specific member
CREATE OR REPLACE FUNCTION get_member_payment_history(p_member_id UUID)
RETURNS TABLE (
  payment_id UUID,
  payment_date DATE,
  amount_paid DECIMAL,
  discount_applied TEXT,
  discount_percentage INTEGER,
  next_due_date_calculated DATE,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS payment_id,
    p.payment_date,
    p.amount_paid,
    p.discount_applied,
    p.discount_percentage,
    p.next_due_date_calculated,
    p.created_at
  FROM payments p
  WHERE p.member_id = p_member_id
  ORDER BY p.payment_date DESC, p.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_member_payment_history IS 'Returns complete payment history for a member, sorted by most recent first';


-- ============================================================
-- AUTO-EXPIRE OVERDUE MEMBERS
-- ============================================================
-- Automatically changes status from 'active' to 'expired' for members >7 days overdue
-- This function is intended to be called by a daily cron job
CREATE OR REPLACE FUNCTION auto_expire_overdue_members()
RETURNS TABLE (
  expired_count INTEGER,
  gym_id UUID,
  gym_name TEXT
) AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update members who are more than 7 days overdue
  WITH updated AS (
    UPDATE members m
    SET status = 'expired', updated_at = NOW()
    WHERE m.status = 'active'
      AND m.next_due_date < CURRENT_DATE - INTERVAL '7 days'
    RETURNING m.gym_id
  )
  SELECT COUNT(*)::INTEGER, u.gym_id
  INTO v_updated_count, gym_id
  FROM updated u
  GROUP BY u.gym_id;

  -- Return summary of expired members by gym
  RETURN QUERY
  WITH expired_summary AS (
    SELECT
      COUNT(*)::INTEGER AS count,
      m.gym_id,
      g.gym_name
    FROM members m
    JOIN gyms g ON g.id = m.gym_id
    WHERE m.status = 'expired'
      AND m.updated_at >= NOW() - INTERVAL '1 minute' -- Just updated
    GROUP BY m.gym_id, g.gym_name
  )
  SELECT * FROM expired_summary;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

COMMENT ON FUNCTION auto_expire_overdue_members IS 'Auto-expires members who are >7 days overdue. Returns count of expired members per gym. Called by daily cron job.';


-- ============================================================
-- GET REVENUE STATS
-- ============================================================
-- Calculates revenue statistics for a gym in a given time period
CREATE OR REPLACE FUNCTION get_revenue_stats(
  p_gym_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_collected DECIMAL,
  total_projected DECIMAL,
  payment_count INTEGER,
  active_member_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Total collected revenue
    COALESCE(SUM(p.amount_paid), 0)::DECIMAL AS total_collected,

    -- Total projected revenue (all active members in period)
    COALESCE(
      SUM(m.plan_amount *
        CASE m.plan_type
          WHEN 'daily' THEN (p_end_date - p_start_date + 1)
          WHEN 'monthly' THEN CEILING((p_end_date - p_start_date + 1) / 30.0)
          WHEN 'annual' THEN CEILING((p_end_date - p_start_date + 1) / 365.0)
        END
      ), 0
    )::DECIMAL AS total_projected,

    -- Payment count
    COUNT(DISTINCT p.id)::INTEGER AS payment_count,

    -- Active member count
    COUNT(DISTINCT m.id)::INTEGER AS active_member_count

  FROM members m
  LEFT JOIN payments p ON p.member_id = m.id
    AND p.payment_date BETWEEN p_start_date AND p_end_date
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    AND m.membership_start_date <= p_end_date;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_revenue_stats IS 'Calculates collected and projected revenue for a gym within a date range';
