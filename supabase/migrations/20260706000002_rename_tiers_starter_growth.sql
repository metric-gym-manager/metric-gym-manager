-- Migration: rename SaaS tiers free->starter, pro->growth; Starter cap 40
--
-- The text + CHECK design (C-19) exists for exactly this: the whole rename —
-- constraints, row values, defaults and both SQL authorities — is one
-- transaction. TS mirror: src/core/utils/constants/SubscriptionConfig.ts
-- (SaasTier.Starter/'starter', SaasTier.Growth/'growth',
-- STARTER_TIER_MEMBER_LIMIT = 40).
--
-- Runs as postgres: the subscription column-guard trigger allow-lists
-- postgres/service_role, so the backfill UPDATE passes it.

-- ============================================================
-- PART 1: gyms.subscription_tier — constraint swap + backfill
-- ============================================================

ALTER TABLE gyms DROP CONSTRAINT gyms_subscription_tier_check;
ALTER TABLE gyms ALTER COLUMN subscription_tier DROP DEFAULT;

UPDATE gyms SET subscription_tier = 'starter' WHERE subscription_tier = 'free';
UPDATE gyms SET subscription_tier = 'growth'  WHERE subscription_tier = 'pro';

ALTER TABLE gyms
  ADD CONSTRAINT gyms_subscription_tier_check
  CHECK (subscription_tier IN ('starter', 'growth'));           -- values = SaasTier
ALTER TABLE gyms ALTER COLUMN subscription_tier SET DEFAULT 'starter';

COMMENT ON COLUMN gyms.subscription_tier IS 'SaaS billing tier (starter|growth). Mirror: SubscriptionConfig.ts SaasTier';

-- ============================================================
-- PART 2: checkout_intents.target_tier — same swap
-- ============================================================

ALTER TABLE checkout_intents DROP CONSTRAINT checkout_intents_target_tier_check;

UPDATE checkout_intents SET target_tier = 'starter' WHERE target_tier = 'free';
UPDATE checkout_intents SET target_tier = 'growth'  WHERE target_tier = 'pro';

ALTER TABLE checkout_intents
  ADD CONSTRAINT checkout_intents_target_tier_check
  CHECK (target_tier IN ('starter', 'growth'));                 -- values = SaasTier

-- ============================================================
-- PART 3: register_member_guarded — growth matrix, Starter cap 40
-- (full replacement of the 20260704000003 body; still the single
--  member-quota authority, still FOR UPDATE-serialized)
-- ============================================================

CREATE OR REPLACE FUNCTION register_member_guarded(p_gym_id uuid, p_member jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  g       RECORD;
  allowed boolean := false;
  new_id  uuid;
BEGIN
  SELECT subscription_tier, subscription_status, member_count, current_period_end
    INTO g FROM gyms WHERE id = p_gym_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;

  -- Allowance matrix — MUST mirror Subscription.canAddMember (SubscriptionConfig.ts)
  IF g.subscription_tier = 'growth' THEN
    IF g.subscription_status = 'active' THEN
      allowed := true;
    ELSIF g.subscription_status = 'past_due' THEN
      -- 7 = GRACE_PERIOD_DAYS (SubscriptionConfig.ts)
      allowed := (g.current_period_end IS NOT NULL
                  AND now() <= g.current_period_end + (interval '1 day' * 7));
    ELSIF g.subscription_status = 'canceled' THEN
      -- voluntary cancel: paid-through until period end, NO grace
      allowed := (g.current_period_end IS NOT NULL AND now() <= g.current_period_end);
    END IF;
  ELSE
    -- 40 = STARTER_TIER_MEMBER_LIMIT (SubscriptionConfig.ts)
    allowed := (g.member_count < 40);
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
-- PART 4: process_dunning_downgrades — growth -> starter
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
  WHERE subscription_tier = 'growth' AND subscription_status = 'past_due'
    AND current_period_end IS NOT NULL
    AND current_period_end + (interval '1 day' * p_grace_days) < now();
  GET DIAGNOSTICS v_past_due = ROW_COUNT;

  -- 2. Voluntary cancel reached period end -> lapse to Starter (no grace; user chose this)
  UPDATE gyms
  SET subscription_tier = 'starter', payhere_subscription_id = NULL
  WHERE subscription_tier = 'growth' AND subscription_status = 'canceled'
    AND current_period_end IS NOT NULL AND current_period_end < now();
  GET DIAGNOSTICS v_lapsed = ROW_COUNT;

  RETURN QUERY SELECT v_past_due, v_lapsed;
END;
$$;

COMMENT ON FUNCTION register_member_guarded IS 'FOR UPDATE-locked quota gate + member insert (starter cap 40 / growth matrix). The single quota authority.';
COMMENT ON FUNCTION process_dunning_downgrades IS 'Set-based dunning on the DB clock: growth/past_due beyond grace and ended growth/canceled lapse to starter. Members never touched.';
