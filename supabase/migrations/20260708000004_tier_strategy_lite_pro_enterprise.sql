-- Migration: quota authority v3 for the paid-only Lite/Pro/Enterprise ladder
--
-- assert_gym_can_add_active_member is re-issued for the new tier/status
-- domains (20260708000003). It remains the SINGLE quota authority: FOR
-- UPDATE-locked on the gyms row, called by register_member_guarded and the
-- trg_enforce_active_member_quota BEFORE trigger on every into-active write.
--
-- Allowance matrix (MUST mirror PlanRestrictions.PLAN_CAPABILITIES and
-- Subscription.canAddMember — SubscriptionConfig.ts):
--   cap:     lite 100 (LITE_TIER_MEMBER_LIMIT) / pro NULL / enterprise NULL
--   status:  trialing  -> within cap (full features during the trial window)
--            active    -> within cap
--            past_due  -> within cap while now() <= period end + 7d grace
--            suspended -> BLOCKED (account gated pending payment)
--            canceled  -> BLOCKED (into-active writes stop at cancel)
--
-- register_member_guarded v5: delegation unchanged — quota only when the
-- insert IS active; re-issued for the updated COMMENT only.

-- ============================================================
-- PART 1: THE ALLOWANCE CHECK (single quota authority) — v3
-- ============================================================

CREATE OR REPLACE FUNCTION assert_gym_can_add_active_member(p_gym_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  g          RECORD;
  v_cap      integer;   -- NULL = unlimited
  within_cap boolean;
  allowed    boolean := false;
BEGIN
  -- The gyms row lock is the per-tenant mutex: concurrent into-active
  -- transitions (and registrations) serialize here, so limit-1 races are
  -- impossible. READ COMMITTED re-reads the committed row after lock wait.
  SELECT subscription_tier, subscription_status, member_count, current_period_end
    INTO g FROM gyms WHERE id = p_gym_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;

  -- Cap matrix — MUST mirror PlanRestrictions.PLAN_CAPABILITIES (SubscriptionConfig.ts)
  v_cap := CASE g.subscription_tier
             WHEN 'lite'       THEN 100   -- LITE_TIER_MEMBER_LIMIT
             WHEN 'pro'        THEN NULL  -- unlimited
             WHEN 'enterprise' THEN NULL  -- unlimited
           END;
  within_cap := (v_cap IS NULL OR g.member_count < v_cap);

  IF g.subscription_status IN ('trialing', 'active') THEN
    allowed := within_cap;
  ELSIF g.subscription_status = 'past_due' THEN
    -- 7 = GRACE_PERIOD_DAYS (SubscriptionConfig.ts)
    allowed := within_cap AND (g.current_period_end IS NOT NULL
                AND now() <= g.current_period_end + (interval '1 day' * 7));
  ELSE
    -- suspended | canceled: all into-active writes are blocked on every tier
    allowed := false;
  END IF;

  IF NOT allowed THEN RAISE EXCEPTION 'MEMBER_LIMIT_REACHED'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION assert_gym_can_add_active_member(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION assert_gym_can_add_active_member IS
  'FOR UPDATE-locked active-member quota gate (lite 100 / pro unlimited / enterprise unlimited; suspended+canceled block; trialing/active within cap; past_due within cap while in grace). Called by register_member_guarded and the members BEFORE trigger; raises MEMBER_LIMIT_REACHED.';

-- ============================================================
-- PART 2: register_member_guarded v5 — delegation unchanged
-- ============================================================

CREATE OR REPLACE FUNCTION register_member_guarded(p_gym_id uuid, p_member jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status member_status;
  new_id   uuid;
BEGIN
  v_status := COALESCE(NULLIF(p_member->>'status', '')::member_status, 'active');

  IF v_status = 'active' THEN
    -- Locks the gyms row and raises MEMBER_LIMIT_REACHED / GYM_NOT_FOUND.
    -- (The BEFORE trigger repeats this check on the INSERT below — idempotent,
    -- the lock is already held by this transaction.)
    PERFORM assert_gym_can_add_active_member(p_gym_id);
  ELSE
    PERFORM 1 FROM gyms WHERE id = p_gym_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;
  END IF;

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
    v_status,
    COALESCE(NULLIF(p_member->>'registered_date', '')::date, CURRENT_DATE),
    COALESCE(NULLIF(p_member->>'membership_start_date', '')::date, CURRENT_DATE),
    (p_member->>'next_due_date')::date
  )
  RETURNING id INTO new_id;  -- AFTER trigger increments member_count iff active

  RETURN new_id;
END;
$$;

COMMENT ON FUNCTION register_member_guarded IS
  'FOR UPDATE-locked quota gate + member insert (lite 100 / pro unlimited / enterprise unlimited). Quota applies only to ACTIVE members; non-active registrations are unlimited. Delegates to assert_gym_can_add_active_member.';
