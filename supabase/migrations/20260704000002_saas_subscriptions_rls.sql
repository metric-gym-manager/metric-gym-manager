-- Migration: RLS + column-write guard for SaaS subscription tables
-- Plan: docs/Payhere_subscritption_integration/payhere-subscription-execution-plan.md (Phase DB, file 2)
-- RLS conventions follow 20260211000005_enable_rls_policies.sql (gym-ownership predicate)
-- and 20260327000001_create_cron_logs_table.sql (service-role pattern).

-- ============================================================
-- PART 1: ENABLE RLS
-- ============================================================

ALTER TABLE checkout_intents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_payment_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 2: SERVICE ROLE POLICIES
-- (checkout creation, webhook, cron all run under the service role)
-- ============================================================

CREATE POLICY "Service role full access checkout_intents"
  ON checkout_intents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access saas_payment_logs"
  ON saas_payment_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- PART 3: GYM OWNER READ POLICY (billing history UI)
-- Same ownership predicate as the existing policies.
-- No gym-owner policy on checkout_intents: server-side plumbing only.
-- ============================================================

CREATE POLICY "Gym owners can view own saas payment logs"
  ON saas_payment_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = saas_payment_logs.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

-- ============================================================
-- PART 4: COLUMN-WRITE GUARD ON gyms (plan C-14)
-- RLS is row-level only: a gym owner holding UPDATE on their own gyms row
-- could set subscription_tier='pro' or member_count=0 via raw PostgREST.
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_subscription_self_update() RETURNS trigger
LANGUAGE plpgsql AS $$  -- SECURITY INVOKER on purpose: current_user must reflect the caller chain
BEGIN
  -- PostgREST executes SET ROLE from the JWT, so current_user is the reliable signal.
  -- Allow-list by privilege — FAILS CLOSED: only 'postgres' (migrations, backfills,
  -- SECURITY DEFINER function bodies, dashboard SQL) and 'service_role' (the app's
  -- admin-client writes: webhook, cron, billing repos) may touch these columns.
  -- Every unenumerated role — anon, authenticated, custom roles, future renames,
  -- direct non-postgres logins — is rejected. A block-list would fail OPEN.
  IF current_user NOT IN ('postgres', 'service_role') AND (
       NEW.subscription_tier       IS DISTINCT FROM OLD.subscription_tier
    OR NEW.subscription_status     IS DISTINCT FROM OLD.subscription_status
    OR NEW.payhere_customer_id     IS DISTINCT FROM OLD.payhere_customer_id
    OR NEW.payhere_subscription_id IS DISTINCT FROM OLD.payhere_subscription_id
    OR NEW.current_period_end      IS DISTINCT FROM OLD.current_period_end
    OR NEW.member_count            IS DISTINCT FROM OLD.member_count
  ) THEN
    RAISE EXCEPTION 'SUBSCRIPTION_COLUMNS_READONLY';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_subscription_self_update
  BEFORE UPDATE ON gyms
  FOR EACH ROW
  EXECUTE FUNCTION prevent_subscription_self_update();

COMMENT ON FUNCTION prevent_subscription_self_update IS 'Subscription columns are service-role/postgres-only. Do NOT key off request.jwt.claims (absent on direct connections = fail-open).';
