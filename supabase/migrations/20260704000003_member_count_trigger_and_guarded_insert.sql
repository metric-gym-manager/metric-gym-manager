-- Migration: member counter trigger + guarded member insert + subscription save RPC
-- Plan: docs/Payhere_subscritption_integration/payhere-subscription-execution-plan.md (Phase DB, file 3)

-- ============================================================
-- PART 1: DENORMALIZED MEMBER COUNTER
-- (SECURITY DEFINER: writes gyms regardless of the inserting role's RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION sync_gym_member_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE gyms SET member_count = member_count + 1 WHERE id = NEW.gym_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE gyms SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.gym_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_gym_member_count
  AFTER INSERT OR DELETE ON members
  FOR EACH ROW
  EXECUTE FUNCTION sync_gym_member_count();

-- ============================================================
-- PART 2: THE ONLY MEMBER-QUOTA AUTHORITY
-- The gyms row lock is the per-tenant mutex: concurrent registrations
-- serialize here, which is what makes limit-1 races impossible.
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
  IF g.subscription_tier = 'pro' THEN
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
    -- 50 = FREE_TIER_MEMBER_LIMIT (SubscriptionConfig.ts)
    allowed := (g.member_count < 50);
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
-- PART 3: SERVER-CLOCK SUBSCRIPTION PERSISTENCE
-- supabase-js .update() cannot express SQL expressions, so
-- current_period_end = now() + interval '1 month' MUST go through this RPC.
-- SupabaseGymSubscriptionRepository.save() calls this — never JS date math.
-- ============================================================

CREATE OR REPLACE FUNCTION save_gym_subscription(
  p_gym_id                  uuid,
  p_tier                    text,     -- SaasTier value; CHECK on gyms re-validates
  p_status                  text,     -- SaasStatus value
  p_payhere_subscription_id text,     -- NULL clears (downgrade)
  p_payhere_customer_id     text,
  p_extend_period           boolean   -- true on activate/renew: period anchors at now()
) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_period_end timestamptz;
BEGIN
  UPDATE gyms SET
    subscription_tier       = p_tier,
    subscription_status     = p_status,
    payhere_subscription_id = p_payhere_subscription_id,
    payhere_customer_id     = p_payhere_customer_id,
    current_period_end      = CASE WHEN p_extend_period
                              -- '1 month' = PRO_BILLING_RECURRENCE (SubscriptionConfig.ts)
                              THEN now() + interval '1 month'
                              ELSE current_period_end END
  WHERE id = p_gym_id
  RETURNING current_period_end INTO v_period_end;
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;
  RETURN v_period_end;
END;
$$;

-- ============================================================
-- PART 4: DUNNING DOWNGRADES — SET-BASED, SERVER-CLOCK ONLY
-- Same supabase-js limitation as PART 3: interval arithmetic against now()
-- must live in SQL. Idempotent; members are NEVER touched.
-- ============================================================

CREATE OR REPLACE FUNCTION process_dunning_downgrades(p_grace_days integer)
RETURNS TABLE (downgraded_past_due integer, lapsed_canceled integer)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_past_due integer;
  v_lapsed   integer;
BEGIN
  -- 1. Grace expired after involuntary failure -> hard downgrade
  --    p_grace_days is passed from GRACE_PERIOD_DAYS (SubscriptionConfig.ts)
  UPDATE gyms
  SET subscription_tier = 'free', subscription_status = 'canceled', payhere_subscription_id = NULL
  WHERE subscription_tier = 'pro' AND subscription_status = 'past_due'
    AND current_period_end IS NOT NULL
    AND current_period_end + (interval '1 day' * p_grace_days) < now();
  GET DIAGNOSTICS v_past_due = ROW_COUNT;

  -- 2. Voluntary cancel reached period end -> lapse to Free (no grace; user chose this)
  UPDATE gyms
  SET subscription_tier = 'free', payhere_subscription_id = NULL
  WHERE subscription_tier = 'pro' AND subscription_status = 'canceled'
    AND current_period_end IS NOT NULL AND current_period_end < now();
  GET DIAGNOSTICS v_lapsed = ROW_COUNT;

  RETURN QUERY SELECT v_past_due, v_lapsed;
END;
$$;

-- ============================================================
-- PART 5: EXECUTE GRANTS — SERVICE ROLE ONLY
-- The API layer authenticates the caller and pins gym_id BEFORE invoking;
-- direct PostgREST callers must not reach these.
-- ============================================================

REVOKE ALL ON FUNCTION register_member_guarded(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION save_gym_subscription(uuid, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION process_dunning_downgrades(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION register_member_guarded(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION save_gym_subscription(uuid, text, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION process_dunning_downgrades(integer) TO service_role;

COMMENT ON FUNCTION register_member_guarded IS 'FOR UPDATE-locked quota gate + member insert. The single quota authority; all app member creation goes through here.';
COMMENT ON FUNCTION save_gym_subscription IS 'Single-clock subscription writer: period extension always computed from the DB clock (plan C-18/C-23).';
