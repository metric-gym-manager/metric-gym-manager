-- Lock down the PostgREST RPC surface (security audit C1 + C2)
--
-- BACKGROUND
-- Supabase exposes every function in the `public` schema at
-- /rest/v1/rpc/<name>, callable by whoever holds the anon key — which ships in
-- every browser bundle by design. A `SECURITY DEFINER` function runs as its
-- owner and is NOT subject to RLS, so any such function without an internal
-- ownership check is a hole straight through the tenant-isolation model.
--
-- A live-grant audit on 2026-07-26 found 10 RPC-reachable functions granted to
-- `anon` + `authenticated`, 7 of them materially exploitable:
--
--   save_gym_subscription        → sets ANY gym to enterprise/active for free
--                                  (full PayHere billing bypass)
--   register_member_guarded      → injects members into ANY gym, bypassing the
--                                  token/honeypot/rate-limit of the public route
--   get_member_payment_history   → ANY member's payment history, cross-tenant
--   get_revenue_stats            → ANY gym's revenue
--   get_overdue_members          → ANY gym's member names + phone numbers
--   get_upcoming_due_members     → same, forward-looking
--   auto_expire_overdue_members  → UNAUTHENTICATED write: mass-expires members
--                                  across every gym on the platform
--
-- WHY THE PREVIOUS REVOKE DID NOT HOLD
-- Migration 20260704000003 revoked these from PUBLIC and it worked — the live
-- ACL has no PUBLIC entry. What it has instead are EXPLICIT `anon=X` and
-- `authenticated=X` grants, re-applied afterwards by Supabase's stock bootstrap:
--
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
--
-- Every function created in `public` inherits EXECUTE for anon/authenticated.
-- `save_gym_subscription` gained a `p_extend_period` parameter in the
-- token-billing migration; a signature change creates a NEW function object, so
-- the default grant fired again and the old revoke applied to a function that
-- no longer existed.
--
-- => This migration is CONTAINMENT. It restores the intended state but does not
--    make it durable. Migration 20260726000003 inverts the default privilege and
--    moves internal functions to a non-exposed schema, which is the actual fix.
--    Do not ship this one without that one.
--
-- SAFETY
-- Verified 2026-07-26 before writing this migration:
--   * The 8 dropped functions have ZERO callers in src/ (full-tree grep; the
--     only textual hits are code comments referencing them as documentation).
--   * pg_depend shows no view, policy, trigger, default or other function
--     depending on any of them (empty result set).
--   * No RLS policy references is_gym_owner() — all policies use inline
--     EXISTS subqueries.
--   * All 4 call sites of register_member_guarded / save_gym_subscription use
--     createAdminClient() (service_role), which this migration does not touch:
--       src/app/api/members/route.ts:123
--       src/app/api/members/bulk/route.ts:47
--       src/app/api/public/registrations/route.ts:111
--       src/features/subscriptions/services/SupabaseGymSubscriptionRepository.ts
--
-- Trigger-returning functions (assign_member_number, sync_gym_member_count,
-- enforce_active_member_quota, prevent_subscription_self_update,
-- update_updated_at_column) also carry stray anon grants, but PostgREST
-- excludes trigger-returning functions from the RPC surface and Postgres
-- refuses to invoke them directly, so they are not exposed. Their grants are
-- tidied in 20260726000003 where the change can be branch-tested first.

-- ---------------------------------------------------------------------------
-- 1. Drop dead functions. Deleted code cannot leak, drift, or need an owner check.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_member_payment_history(uuid);
DROP FUNCTION IF EXISTS public.get_revenue_stats(uuid, date, date);
DROP FUNCTION IF EXISTS public.get_overdue_members(uuid);
DROP FUNCTION IF EXISTS public.get_upcoming_due_members(uuid, integer);
DROP FUNCTION IF EXISTS public.auto_expire_overdue_members();
DROP FUNCTION IF EXISTS public.cleanup_old_announcement_failures();
DROP FUNCTION IF EXISTS public.cleanup_expired_otps();
DROP FUNCTION IF EXISTS public.is_gym_owner(uuid);

-- ---------------------------------------------------------------------------
-- 2. Revoke the survivors. These are called ONLY by server-side code holding
--    the service_role key; service_role retains EXECUTE and is unaffected.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION
  public.register_member_guarded(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.save_gym_subscription(uuid, text, text, text, text, boolean)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.assert_gym_can_add_active_member(uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Self-verification. Fail the migration loudly rather than silently leaving
--    the hole open — this is the exact failure mode that let C2 persist for
--    four months.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_leaked text;
BEGIN
  -- has_function_privilege() is used rather than information_schema because it
  -- resolves the EFFECTIVE privilege — including anything inherited via PUBLIC —
  -- and keys on the function OID, so it is correct for overloaded names too.
  SELECT string_agg(format('%s(%s)%s%s',
                           p.proname,
                           pg_get_function_identity_arguments(p.oid),
                           CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE')
                                THEN ' [anon]' ELSE '' END,
                           CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                THEN ' [authenticated]' ELSE '' END),
                    ', ')
    INTO v_leaked
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef                                   -- SECURITY DEFINER only
    AND p.prorettype <> 'trigger'::regtype            -- triggers aren't RPC-reachable
    AND p.proname IN ('register_member_guarded', 'save_gym_subscription',
                      'assert_gym_can_add_active_member', 'process_dunning_suspensions',
                      'process_trial_expiry', 'schedule_charge_retry')
    AND (has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));

  IF v_leaked IS NOT NULL THEN
    RAISE EXCEPTION 'RPC lockdown failed — still reachable by anon/authenticated: %', v_leaked;
  END IF;

  RAISE NOTICE 'RPC surface locked: no SECURITY DEFINER business function is anon-executable.';
END;
$$;
