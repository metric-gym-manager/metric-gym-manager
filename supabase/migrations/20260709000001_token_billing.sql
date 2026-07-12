-- Migration: tokenized automated charging (PayHere Preapproval + Charging API)
--
-- Billing-schedule ownership moves from PayHere to this application:
--   * checkout tokenizes the card (Preapproval API, first month captured
--     alongside) and stores the customer token in gyms.payhere_customer_id
--   * a daily cron (charge-renewals) charges due tokens via the OAuth REST
--     Charging API — WE decide when and how much
--   * gyms.next_charge_at is the schedule; saas_charge_attempts is the
--     idempotency/ambiguity ledger for every server-initiated charge
--
-- Discriminator between billing generations (no dual-billing possible):
--   token-based:      payhere_customer_id IS NOT NULL AND payhere_subscription_id IS NULL
--                     -> OUR cron charges; next_charge_at set
--   legacy recurring: payhere_subscription_id IS NOT NULL
--                     -> PayHere charges on its own schedule; next_charge_at stays NULL
--
-- Period-credit rule (register C-33): every successful charge extends
--   current_period_end = GREATEST(existing period end, now()) + 1 month
-- so unused paid days are BANKED, never forfeited — a mid-month plan change
-- charges the new price today and pushes the next charge out by the unused
-- days. Past-due recovery is unchanged (existing boundary is in the past ->
-- GREATEST picks the charge date, the C-23 anchor).
--
-- TS mirror: SubscriptionConfig.ts (RENEWAL_RETRY_INTERVAL_DAYS = 2,
-- CHARGE_ATTEMPT_TTL_HOURS = 48), ChangePlan / ChargeDueRenewals use cases,
-- SupabaseChargeAttemptRepository, SupabaseGymSubscriptionRepository.

-- ============================================================
-- PART 1: SERVER-INITIATED CHARGE LEDGER
-- Every REST charge (renewal or plan change) inserts a pending row BEFORE
-- calling PayHere. The webhook resolves order_id -> gym through this table
-- (same trust model as checkout_intents), late/lost responses are recovered
-- by the notify callback, and the one-pending-per-gym index makes concurrent
-- charges impossible.
-- ============================================================

CREATE TABLE saas_charge_attempts (
  order_id           text          PRIMARY KEY,
  gym_id             uuid          NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  kind               text          NOT NULL CHECK (kind IN ('renewal', 'plan_change')),
  -- Tier being paid for (renewal: current tier; plan_change: the target)
  target_tier        text          NOT NULL CHECK (target_tier IN ('lite', 'pro', 'enterprise')), -- values = SaasTier
  expected_amount    numeric(12,2) NOT NULL,
  currency           text          NOT NULL DEFAULT 'LKR',
  status             text          NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'succeeded', 'failed', 'expired')),
  payhere_payment_id text,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  resolved_at        timestamptz
);

-- At most one live charge per gym: a cron pass racing a user plan change hits 23505
CREATE UNIQUE INDEX idx_charge_attempts_one_pending_per_gym
  ON saas_charge_attempts (gym_id) WHERE status = 'pending';

-- Admin/system-health triage + per-gym history
CREATE INDEX idx_charge_attempts_gym ON saas_charge_attempts (gym_id, created_at DESC);

COMMENT ON TABLE saas_charge_attempts IS
  'Ledger of server-initiated PayHere token charges (Charging API). Pending row inserted BEFORE the REST call: webhook order_id resolution, timeout-ambiguity recovery, and the one-pending-per-gym concurrency gate. Server-side plumbing; no gym-owner RLS policy.';

ALTER TABLE saas_charge_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access saas_charge_attempts"
  ON saas_charge_attempts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- PART 2: THE BILLING CLOCK — gyms.next_charge_at
-- ============================================================

ALTER TABLE gyms ADD COLUMN next_charge_at timestamptz;

COMMENT ON COLUMN gyms.next_charge_at IS
  'When the charge-renewals cron next charges this gym''s stored token (NULL = nothing scheduled: legacy recurring, trialing, canceled, suspended, complimentary). Maintained by save_gym_subscription / schedule_charge_retry / the dunning + trial crons on the DB clock.';

-- ============================================================
-- PART 3: COLUMN-WRITE GUARD v2 (C-14)
-- Adds next_charge_at AND trial_ends_at to the protected set. trial_ends_at
-- was introduced in 20260708000003 without guard coverage — a gym owner with
-- raw PostgREST UPDATE on their own row could self-extend their trial. Closed
-- here; same fail-closed allow-list as v1.
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_subscription_self_update() RETURNS trigger
LANGUAGE plpgsql AS $$  -- SECURITY INVOKER on purpose: current_user must reflect the caller chain
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') AND (
       NEW.subscription_tier       IS DISTINCT FROM OLD.subscription_tier
    OR NEW.subscription_status     IS DISTINCT FROM OLD.subscription_status
    OR NEW.payhere_customer_id     IS DISTINCT FROM OLD.payhere_customer_id
    OR NEW.payhere_subscription_id IS DISTINCT FROM OLD.payhere_subscription_id
    OR NEW.current_period_end      IS DISTINCT FROM OLD.current_period_end
    OR NEW.member_count            IS DISTINCT FROM OLD.member_count
    OR NEW.trial_ends_at           IS DISTINCT FROM OLD.trial_ends_at
    OR NEW.next_charge_at          IS DISTINCT FROM OLD.next_charge_at
  ) THEN
    RAISE EXCEPTION 'SUBSCRIPTION_COLUMNS_READONLY';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION prevent_subscription_self_update IS
  'Subscription columns (incl. trial_ends_at, next_charge_at) are service-role/postgres-only. Do NOT key off request.jwt.claims (absent on direct connections = fail-open).';

-- ============================================================
-- PART 4: save_gym_subscription v2 — credit-preserving period math +
-- next_charge_at maintenance (single clock, C-18/C-23/C-33)
-- ============================================================

CREATE OR REPLACE FUNCTION save_gym_subscription(
  p_gym_id                  uuid,
  p_tier                    text,     -- SaasTier value; CHECK on gyms re-validates
  p_status                  text,     -- SaasStatus value
  p_payhere_subscription_id text,     -- legacy recurring id (NULL for token billing)
  p_payhere_customer_id     text,     -- stored card token (Preapproval customer_token)
  p_extend_period           boolean   -- true on activate/renew/plan-change: banked-credit extension
) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_period_end timestamptz;
BEGIN
  UPDATE gyms SET
    subscription_tier       = p_tier,
    subscription_status     = p_status,
    payhere_subscription_id = p_payhere_subscription_id,
    payhere_customer_id     = p_payhere_customer_id,
    -- C-33 banked credit: unused paid days roll into the new period. When the
    -- old boundary is past (recovery) GREATEST picks now() — the C-23 anchor.
    -- '1 month' is the sole billing interval.
    current_period_end      = CASE WHEN p_extend_period
                              THEN GREATEST(COALESCE(current_period_end, now()), now())
                                   + interval '1 month'
                              ELSE current_period_end END,
    next_charge_at          = CASE
                              -- Nothing may ever be scheduled in these states
                              WHEN p_status IN ('canceled', 'suspended', 'trialing') THEN NULL
                              -- Token-billed activation/renewal: charge again at the
                              -- (credit-extended) period boundary
                              WHEN p_extend_period AND p_status = 'active'
                                   AND p_payhere_customer_id IS NOT NULL
                                   AND p_payhere_subscription_id IS NULL
                                THEN GREATEST(COALESCE(current_period_end, now()), now())
                                     + interval '1 month'
                              -- Legacy recurring (PayHere drives) or past_due
                              -- (schedule_charge_retry owns the retry clock)
                              ELSE next_charge_at END
  WHERE id = p_gym_id
  RETURNING current_period_end INTO v_period_end;
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;
  RETURN v_period_end;
END;
$$;

COMMENT ON FUNCTION save_gym_subscription IS
  'Single-clock subscription writer. Extension banks unused paid days (GREATEST rule, C-33; recovery anchor C-23 preserved) and schedules the next token charge for token-billed active gyms. Legacy recurring rows never get next_charge_at.';

-- ============================================================
-- PART 5: schedule_charge_retry — failed-charge backoff on the DB clock
-- ============================================================

CREATE FUNCTION schedule_charge_retry(
  p_gym_id              uuid,
  p_retry_interval_days integer,  -- RENEWAL_RETRY_INTERVAL_DAYS (SubscriptionConfig.ts)
  p_grace_days          integer   -- GRACE_PERIOD_DAYS (SubscriptionConfig.ts)
) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next timestamptz;
BEGIN
  UPDATE gyms SET
    next_charge_at = CASE
      -- Next retry only if it lands inside the grace window; otherwise stop —
      -- the dunning cron suspends at grace expiry and checkout/late-webhook
      -- recovery takes over. Bounds total attempts per past_due episode
      -- (C-26: stay inside card-network retry budgets).
      WHEN current_period_end IS NOT NULL
           AND now() + (interval '1 day' * p_retry_interval_days)
               <= current_period_end + (interval '1 day' * p_grace_days)
        THEN now() + (interval '1 day' * p_retry_interval_days)
      ELSE NULL
    END
  WHERE id = p_gym_id
  RETURNING next_charge_at INTO v_next;
  IF NOT FOUND THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;
  RETURN v_next;
END;
$$;

COMMENT ON FUNCTION schedule_charge_retry IS
  'After a failed token charge: next attempt in p_retry_interval_days, but never beyond period end + grace (dunning suspends there). NULL = no further automatic attempts this episode.';

-- ============================================================
-- PART 6: dunning + trial expiry clear the billing clock on suspension
-- (full replacements of the 20260708000005/6 bodies)
-- ============================================================

CREATE OR REPLACE FUNCTION process_dunning_suspensions(p_grace_days integer)
RETURNS TABLE (suspended_past_due integer, suspended_canceled integer)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_past_due integer;
  v_canceled integer;
BEGIN
  -- 1. Grace expired after involuntary failure -> suspend (tier preserved)
  UPDATE gyms
  SET subscription_status = 'suspended', next_charge_at = NULL
  WHERE subscription_status = 'past_due'
    AND current_period_end IS NOT NULL
    AND current_period_end + (interval '1 day' * p_grace_days) < now();
  GET DIAGNOSTICS v_past_due = ROW_COUNT;

  -- 2. Voluntary cancel reached period end -> suspend (no grace; user chose this)
  UPDATE gyms
  SET subscription_status = 'suspended', next_charge_at = NULL
  WHERE subscription_status = 'canceled'
    AND current_period_end IS NOT NULL AND current_period_end < now();
  GET DIAGNOSTICS v_canceled = ROW_COUNT;

  RETURN QUERY SELECT v_past_due, v_canceled;
END;
$$;

COMMENT ON FUNCTION process_dunning_suspensions IS
  'Set-based dunning on the DB clock: past_due beyond grace and lapsed canceled become SUSPENDED — tier preserved, billing clock cleared, no downgrade landing tier exists. Complimentary rows (NULL period end) are untouchable. Members never touched.';

CREATE OR REPLACE FUNCTION process_trial_expiry()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_suspended integer;
BEGIN
  UPDATE gyms
  SET subscription_status = 'suspended', next_charge_at = NULL
  WHERE subscription_status = 'trialing'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < now();
  GET DIAGNOSTICS v_suspended = ROW_COUNT;

  RETURN v_suspended;
END;
$$;

COMMENT ON FUNCTION process_trial_expiry IS
  'Set-based trial expiry on the DB clock: trialing gyms past trial_ends_at become SUSPENDED (tier preserved, billing clock cleared, members untouched). A checkout before expiry converts to active and never reaches here.';

-- ============================================================
-- PART 7: EXECUTE GRANTS — SERVICE ROLE ONLY
-- (privileges on replaced functions persist; only the new one needs grants)
-- ============================================================

REVOKE ALL ON FUNCTION schedule_charge_retry(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION schedule_charge_retry(uuid, integer, integer) TO service_role;
