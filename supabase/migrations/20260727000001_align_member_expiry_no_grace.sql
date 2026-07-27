-- ============================================================
-- Align DB helper functions with the NO-GRACE member expiry rule
-- ============================================================
-- Member expiry no longer has a grace period: an ACTIVE member is Expired as
-- soon as next_due_date is in the past (next_due_date < CURRENT_DATE), and an
-- EXPIRED member is auto-Cancelled once 14 days past due.
--
-- Two helper functions from 20260211000006_create_helper_functions.sql still
-- encoded the retired 7-day grace window:
--
--   * get_overdue_members(p_gym_id)   -- under-reported overdue members
--   * auto_expire_overdue_members()   -- would re-apply the 7-day grace
--
-- Neither is called by application code (the Vercel cron
-- /api/cron/update-expired-status drives the transition through the
-- UpdateExpiredStatus use case), but auto_expire_overdue_members is SECURITY
-- DEFINER and documented as "called by a daily cron job", so leaving the stale
-- threshold in place is a live hazard: any future invocation would silently
-- contradict the application rule.
--
-- The application remains the single authority for the status transition
-- (features/members/config/StatusConfig.ts). These definitions are realigned so
-- the database can never disagree with it.
--
-- Idempotent: CREATE OR REPLACE only; safe to replay from an empty database
-- (both functions are created by the earlier migration, which runs first).
-- ============================================================

-- ------------------------------------------------------------
-- GET OVERDUE MEMBERS — now "past due", not "7+ days past due"
-- ------------------------------------------------------------
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
    -- No grace period: overdue the day after next_due_date
    AND m.next_due_date < CURRENT_DATE
  ORDER BY m.next_due_date ASC; -- Most overdue first
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_overdue_members IS
  'Returns all active members whose next_due_date has passed (no grace period), sorted by most overdue first.';

-- ------------------------------------------------------------
-- AUTO-EXPIRE OVERDUE MEMBERS — no grace period
-- ------------------------------------------------------------
-- NOTE: the authoritative implementation is the application use case
-- UpdateExpiredStatus (cron /api/cron/update-expired-status). This function is
-- kept only so a manual/administrative invocation cannot apply a stale rule.
CREATE OR REPLACE FUNCTION auto_expire_overdue_members()
RETURNS TABLE (
  expired_count INTEGER,
  gym_id UUID,
  gym_name TEXT
) AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Expire every active member whose due date has passed (no grace period)
  WITH updated AS (
    UPDATE members m
    SET status = 'expired', updated_at = NOW()
    WHERE m.status = 'active'
      AND m.next_due_date < CURRENT_DATE
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

COMMENT ON FUNCTION auto_expire_overdue_members IS
  'Auto-expires members whose next_due_date has passed (no grace period). The application cron /api/cron/update-expired-status is the authority; this exists so a manual call cannot apply a stale threshold.';
