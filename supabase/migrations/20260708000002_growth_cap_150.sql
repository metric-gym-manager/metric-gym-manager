-- Migration: lower the Growth active-member cap 190 -> 150
--
-- Growth's monthly price also drops to 2990 LKR, but the charged amount is
-- server-side env config (PAYHERE_PRO_PRICE_LKR) — no DB literal for it. The
-- member cap, however, IS a SQL literal in the single quota authority
-- assert_gym_can_add_active_member (migration 20260708000001), so it must be
-- re-issued here. register_member_guarded and the trg_enforce_active_member_quota
-- BEFORE trigger both delegate to this function, so this one CREATE OR REPLACE
-- is the whole change — every into-active write path picks up 150 at once.
--
-- TS mirror: GROWTH_TIER_MEMBER_LIMIT = 150 (SubscriptionConfig.ts) and the
-- PlanRestrictions capability matrix (which reads that constant).
--
-- Existing Growth gyms already above 150 active members keep every member —
-- the cap only gates NEW active members and into-active flips (reactivation),
-- exactly as before. No backfill: member_count already means "active count".

CREATE OR REPLACE FUNCTION assert_gym_can_add_active_member(p_gym_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  g          RECORD;
  v_cap      integer;   -- NULL = unlimited
  within_cap boolean;
  allowed    boolean := false;
BEGIN
  SELECT subscription_tier, subscription_status, member_count, current_period_end
    INTO g FROM gyms WHERE id = p_gym_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;

  -- Cap matrix — MUST mirror PlanRestrictions.PLAN_CAPABILITIES (SubscriptionConfig.ts)
  v_cap := CASE g.subscription_tier
             WHEN 'starter'    THEN 40    -- STARTER_TIER_MEMBER_LIMIT
             WHEN 'growth'     THEN 150   -- GROWTH_TIER_MEMBER_LIMIT (lowered from 190)
             WHEN 'enterprise' THEN NULL  -- unlimited
           END;
  within_cap := (v_cap IS NULL OR g.member_count < v_cap);

  IF g.subscription_tier IN ('growth', 'enterprise') THEN
    IF g.subscription_status = 'active' THEN
      allowed := within_cap;
    ELSIF g.subscription_status = 'past_due' THEN
      -- 7 = GRACE_PERIOD_DAYS (SubscriptionConfig.ts)
      allowed := within_cap AND (g.current_period_end IS NOT NULL
                  AND now() <= g.current_period_end + (interval '1 day' * 7));
    ELSIF g.subscription_status = 'canceled' THEN
      -- voluntary cancel: paid-through until period end, NO grace
      allowed := within_cap AND
                 (g.current_period_end IS NOT NULL AND now() <= g.current_period_end);
    END IF;
  ELSE
    allowed := within_cap;
  END IF;

  IF NOT allowed THEN RAISE EXCEPTION 'MEMBER_LIMIT_REACHED'; END IF;
END;
$$;

COMMENT ON FUNCTION assert_gym_can_add_active_member IS
  'FOR UPDATE-locked active-member quota gate (starter 40 / growth 150 / enterprise unlimited). Called by register_member_guarded and the members BEFORE trigger; raises MEMBER_LIMIT_REACHED.';
