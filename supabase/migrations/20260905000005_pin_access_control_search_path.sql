-- ============================================================
-- Pin search_path on the five access-control functions
-- ============================================================
--
-- `20260805000001_pin_function_search_path.sql` pinned every function this
-- project owned in `public`. The access-control functions were created eight
-- days later (`20260813091014_access_control_functions`) with
-- `SET search_path = public`, so they were never covered — and
-- `20260813091429_lock_down_access_control_functions` tightened their *ACLs*
-- without touching their *pins*. Audited 2026-09-05: 20 of 25 functions were
-- correctly pinned and these five were not.
--
-- Why `search_path = public` is not enough, restated because it is the part
-- that looks harmless: with `pg_temp` unnamed, Postgres searches the session
-- temp schema **first** — ahead of even `pg_catalog` — for relation and type
-- names. Any caller can therefore `CREATE TEMP TABLE members` (or
-- `access_devices`, or `member_access_subjects`) and have a SECURITY DEFINER
-- body execute against their own object with `postgres` rights. Rule 2.18 also
-- rules out `SET search_path = ''`, which silences linter 0011 while leaving
-- the hole open. Only the three-element form closes it.
--
-- All five are SECURITY DEFINER. Two are the sharpest: `claim_access_sync_jobs`
-- hands out work items across tenants, and `enqueue_access_sync_for_member` is
-- a trigger on `members` that fires for every gym.
--
-- `ALTER FUNCTION … SET` is used rather than `CREATE OR REPLACE` deliberately:
-- it writes `proconfig` only and leaves `proacl` untouched, so the
-- service_role-only grants applied by 20260813091429 survive. A
-- `CREATE OR REPLACE` would discard both and silently regress the lockdown —
-- the failure mode rule 2.18 warns about.
--
-- Idempotent: setting an already-correct pin is a no-op.

ALTER FUNCTION public.allocate_access_subject_id()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.claim_access_sync_jobs(integer)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.enqueue_access_sync_for_member()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.reclaim_stale_access_sync_jobs(integer)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.recount_device_templates(uuid)
  SET search_path = pg_catalog, public, pg_temp;

-- ---------- Reachable SECURITY INVOKER helpers -------------------------------
--
-- `calculate_next_due_date` and `calculate_payment_amount` are pure arithmetic
-- with no table access, so they leak nothing — but PostgREST exposes every
-- function in `public` at `/rest/v1/rpc/<name>`, and both are currently
-- callable by `anon`. Neither has a `.rpc(` call site anywhere in the
-- application (the only six are claim_access_sync_jobs,
-- process_dunning_suspensions, process_trial_expiry, register_member_guarded,
-- save_gym_subscription and schedule_charge_retry), and no migration, policy or
-- trigger calls them either. Per rule 2.18 an unused function gets no grant.
--
-- The other two INVOKER functions — prevent_subscription_self_update and
-- update_updated_at_column — return `trigger`, which PostgREST cannot expose,
-- so they need nothing.

REVOKE ALL ON FUNCTION public.calculate_next_due_date(public.member_plan_type, date)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.calculate_payment_amount(numeric, integer)
  FROM PUBLIC, anon, authenticated;
