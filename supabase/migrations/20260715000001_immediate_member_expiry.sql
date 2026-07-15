-- ============================================================
-- Immediate member expiry — remove the 7-day expiry grace period
-- ============================================================
-- Members now expire as soon as their membership lapses: a member whose
-- next_due_date is today or earlier is no longer paid up and must be
-- 'expired'. Previously the app cron (update-expired-status) and the DB
-- helpers below waited MEMBER_EXPIRY_GRACE_DAYS (7) days past next_due_date.
--
-- App mirror: src/core/use-cases/member/UpdateExpiredStatus.ts filters
-- next_due_date <= today; MEMBER_EXPIRY_GRACE_DAYS has been removed from
-- StatusConfig.ts. (The comment in migration 20260708000001 describing the
-- 7-day window is historical.)
--
-- The SaaS billing grace (GRACE_PERIOD_DAYS = 7, gym subscription dunning)
-- is a separate concept and is NOT touched by this migration.

-- ============================================================
-- GET OVERDUE MEMBERS
-- ============================================================
-- Returns active members whose membership period has ended (due today or
-- earlier) — i.e. members the daily expiry cron is about to flip.
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
    AND m.next_due_date <= CURRENT_DATE
  ORDER BY m.next_due_date ASC; -- Most overdue first
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_overdue_members IS 'Returns active members whose membership has lapsed (next_due_date <= today, no grace period), sorted by most overdue first';

-- ============================================================
-- AUTO-EXPIRE OVERDUE MEMBERS
-- ============================================================
-- Changes status from 'active' to 'expired' as soon as the membership
-- lapses (next_due_date <= today). No grace period.
CREATE OR REPLACE FUNCTION auto_expire_overdue_members()
RETURNS TABLE (
  expired_count INTEGER,
  gym_id UUID,
  gym_name TEXT
) AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update members whose membership has lapsed (due today or earlier)
  WITH updated AS (
    UPDATE members m
    SET status = 'expired', updated_at = NOW()
    WHERE m.status = 'active'
      AND m.next_due_date <= CURRENT_DATE
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

COMMENT ON FUNCTION auto_expire_overdue_members IS 'Auto-expires members as soon as their membership lapses (next_due_date <= today, no grace period). Returns count of expired members per gym. Called by daily cron job.';
