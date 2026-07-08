-- Migration: add the Enterprise tier; cap Growth at 190 members
--
-- Tier set becomes starter | growth | enterprise (C-19 text+CHECK: the swap is
-- transactional). Growth gains a member cap of 190; Enterprise is unlimited.
-- Complimentary (lifetime) Enterprise rows are ordinary enterprise/active rows
-- with payhere_subscription_id IS NULL AND current_period_end IS NULL — both
-- dunning WHERE clauses require a period end, so dunning can never touch them.
--
-- TS mirror: SubscriptionConfig.ts (SaasTier.Enterprise, GROWTH_TIER_MEMBER_LIMIT
-- = 190) and the PlanRestrictions capability matrix.

-- ============================================================
-- PART 1: CHECK swaps (gyms + checkout_intents)
-- ============================================================

ALTER TABLE gyms DROP CONSTRAINT gyms_subscription_tier_check;
ALTER TABLE gyms
  ADD CONSTRAINT gyms_subscription_tier_check
  CHECK (subscription_tier IN ('starter', 'growth', 'enterprise'));  -- values = SaasTier

ALTER TABLE checkout_intents DROP CONSTRAINT checkout_intents_target_tier_check;
ALTER TABLE checkout_intents
  ADD CONSTRAINT checkout_intents_target_tier_check
  CHECK (target_tier IN ('starter', 'growth', 'enterprise'));        -- values = SaasTier

COMMENT ON COLUMN gyms.subscription_tier IS 'SaaS billing tier (starter|growth|enterprise). Mirror: SubscriptionConfig.ts SaasTier';

-- ============================================================
-- PART 2: register_member_guarded — per-tier caps
-- (starter 40, growth 190, enterprise unlimited; paid tiers additionally
--  require a live subscription: active / in-grace past_due / paid-through
--  canceled. Complimentary enterprise is always active -> unlimited.)
-- ============================================================

CREATE OR REPLACE FUNCTION register_member_guarded(p_gym_id uuid, p_member jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  g          RECORD;
  v_cap      integer;   -- NULL = unlimited
  within_cap boolean;
  allowed    boolean := false;
  new_id     uuid;
BEGIN
  SELECT subscription_tier, subscription_status, member_count, current_period_end
    INTO g FROM gyms WHERE id = p_gym_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;

  -- Cap matrix — MUST mirror PlanRestrictions.PLAN_CAPABILITIES (SubscriptionConfig.ts)
  v_cap := CASE g.subscription_tier
             WHEN 'starter'    THEN 40    -- STARTER_TIER_MEMBER_LIMIT
             WHEN 'growth'     THEN 190   -- GROWTH_TIER_MEMBER_LIMIT
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

  -- Column list = exact live members INSERT surface (SupabaseMemberRepository.toDatabase)
  INSERT INTO members (
    gym_id, name, phone_number, plan_type, plan_amount, discount_id,
    recurring_discount, status, registered_date, membership_start_date, next_due_date
  )
  VALUES (
    p_gym_id,
    p_member->>'name',
    p_member->>'phone_number',
    (p_member->>'plan_type')::member_plan_type,
    (p_member->>'plan_amount')::numeric,
    NULLIF(p_member->>'discount_id', '')::uuid,
    COALESCE((p_member->>'recurring_discount')::boolean, false),
    COALESCE(NULLIF(p_member->>'status', '')::member_status, 'active'),
    COALESCE(NULLIF(p_member->>'registered_date', '')::date, CURRENT_DATE),
    COALESCE(NULLIF(p_member->>'membership_start_date', '')::date, CURRENT_DATE),
    (p_member->>'next_due_date')::date
  )
  RETURNING id INTO new_id;  -- AFTER trigger increments member_count in this same transaction

  RETURN new_id;
END;
$$;

-- ============================================================
-- PART 3: process_dunning_downgrades — all billed paid tiers
-- (comped rows are immune: current_period_end IS NULL fails both predicates)
-- ============================================================

CREATE OR REPLACE FUNCTION process_dunning_downgrades(p_grace_days integer)
RETURNS TABLE (downgraded_past_due integer, lapsed_canceled integer)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_past_due integer;
  v_lapsed   integer;
BEGIN
  -- 1. Grace expired after involuntary failure -> hard downgrade
  UPDATE gyms
  SET subscription_tier = 'starter', subscription_status = 'canceled', payhere_subscription_id = NULL
  WHERE subscription_tier IN ('growth', 'enterprise') AND subscription_status = 'past_due'
    AND current_period_end IS NOT NULL
    AND current_period_end + (interval '1 day' * p_grace_days) < now();
  GET DIAGNOSTICS v_past_due = ROW_COUNT;

  -- 2. Voluntary cancel reached period end -> lapse to Starter (no grace; user chose this)
  UPDATE gyms
  SET subscription_tier = 'starter', payhere_subscription_id = NULL
  WHERE subscription_tier IN ('growth', 'enterprise') AND subscription_status = 'canceled'
    AND current_period_end IS NOT NULL AND current_period_end < now();
  GET DIAGNOSTICS v_lapsed = ROW_COUNT;

  RETURN QUERY SELECT v_past_due, v_lapsed;
END;
$$;

COMMENT ON FUNCTION register_member_guarded IS 'FOR UPDATE-locked quota gate + member insert (starter 40 / growth 190 / enterprise unlimited). The single quota authority; mirror of PlanRestrictions.';
COMMENT ON FUNCTION process_dunning_downgrades IS 'Set-based dunning on the DB clock for billed paid tiers (growth|enterprise). Complimentary rows (NULL period end) are untouchable. Members never touched.';
