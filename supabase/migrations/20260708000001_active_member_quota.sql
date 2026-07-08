-- Migration: the member quota counts ACTIVE members only
--
-- gyms.member_count changes meaning: "members with status = 'active'", not row
-- count. Non-active members (expired / suspended / cancelled) are unlimited on
-- every tier — gyms should never feel pressure to delete history. The cap only
-- gates making a member ACTIVE:
--
--   * INSERT of an active member          (registration)
--   * UPDATE flipping status into active  (reactivation, payment collection)
--
-- Both go through one allowance check, assert_gym_can_add_active_member(),
-- FOR UPDATE-locked on the gyms row — the same per-tenant mutex pattern as
-- register_member_guarded (which now delegates to it). A BEFORE trigger applies
-- the check to every write path, so no app code can bypass the quota.
--
-- TS mirror: PlanRestrictions.ts caps, Subscription.canAddMember,
-- SupabaseMemberRepository (maps MEMBER_LIMIT_REACHED -> MemberLimitError),
-- MEMBER_EXPIRY_GRACE_DAYS = 7 (StatusConfig.ts): unpaid actives expire 7 days
-- after next_due_date (cron update-expired-status) and drop out of the count
-- via the UPDATE branch of the sync trigger.

-- ============================================================
-- PART 1: THE ALLOWANCE CHECK (single quota authority)
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
END;
$$;

REVOKE ALL ON FUNCTION assert_gym_can_add_active_member(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION assert_gym_can_add_active_member IS
  'FOR UPDATE-locked active-member quota gate (starter 40 / growth 190 / enterprise unlimited). Called by register_member_guarded and the members BEFORE trigger; raises MEMBER_LIMIT_REACHED.';

-- ============================================================
-- PART 2: ENFORCEMENT TRIGGER — every into-active write is gated
-- (BEFORE, so the row never lands/flips when the quota is exhausted; covers
--  reactivation, payment-collection renewals of expired members, batch status
--  updates, and any future path — not just the registration RPC)
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_active_member_quota() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'active')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'active' AND OLD.status <> 'active') THEN
    PERFORM assert_gym_can_add_active_member(NEW.gym_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_active_member_quota ON members;
CREATE TRIGGER trg_enforce_active_member_quota
  BEFORE INSERT OR UPDATE OF status ON members
  FOR EACH ROW
  EXECUTE FUNCTION enforce_active_member_quota();

-- ============================================================
-- PART 3: COUNTER SYNC — active-only deltas, now including status flips
-- ============================================================

CREATE OR REPLACE FUNCTION sync_gym_member_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.status = 'active' THEN
      UPDATE gyms SET member_count = member_count + 1 WHERE id = NEW.gym_id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF OLD.status = 'active' AND NEW.status <> 'active' THEN
      UPDATE gyms SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.gym_id;
    ELSIF OLD.status <> 'active' AND NEW.status = 'active' THEN
      UPDATE gyms SET member_count = member_count + 1 WHERE id = NEW.gym_id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.status = 'active' THEN
      UPDATE gyms SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.gym_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_gym_member_count ON members;
CREATE TRIGGER trg_sync_gym_member_count
  AFTER INSERT OR DELETE OR UPDATE OF status ON members
  FOR EACH ROW
  EXECUTE FUNCTION sync_gym_member_count();

-- ============================================================
-- PART 4: register_member_guarded — quota only when the insert IS active
-- (non-active registrations are never quota-blocked; unknown gyms still fail)
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
  'FOR UPDATE-locked quota gate + member insert. Quota (starter 40 / growth 190 / enterprise unlimited) applies only to ACTIVE members; non-active registrations are unlimited.';

-- ============================================================
-- PART 5: BACKFILL — member_count becomes the ACTIVE member count
-- ============================================================

UPDATE gyms g
SET member_count = (
  SELECT count(*) FROM members m
  WHERE m.gym_id = g.id AND m.status = 'active'
);

COMMENT ON COLUMN gyms.member_count IS
  'Denormalized count of ACTIVE members only (trigger-maintained). Non-active members are not counted and never quota-gated.';
