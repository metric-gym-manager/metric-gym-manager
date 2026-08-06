-- ============================================================
-- Revoke anon/authenticated EXECUTE on SECURITY DEFINER functions
-- ============================================================
--
-- Fixes Supabase linters 0028 `anon_security_definer_function_executable`
-- and 0029 `authenticated_security_definer_function_executable`.
--
-- Every SECURITY DEFINER function in `public` is reachable over PostgREST at
-- `/rest/v1/rpc/<name>` by any role holding EXECUTE. These functions run as
-- `postgres` and deliberately bypass RLS, so EXECUTE is the *only* thing
-- standing between a caller and the privileged body. The worst cases:
--
--   get_revenue_stats(p_gym_id, ...)        -- any gym's revenue, unauthenticated
--   get_member_payment_history(p_member_id) -- any member's payment history
--   get_overdue_members(p_gym_id)           -- any gym's member roster
--   save_gym_subscription(...)              -- write a gym's billing tier/status
--   register_member_guarded(...)            -- insert members into any gym
--
-- All of these take the tenant id as a *parameter* and resolve nothing from
-- the session, so a caller could simply pass someone else's gym id. That is a
-- cross-tenant read/write, not a hypothetical.
--
-- Who actually calls these: every call site in the repo goes through
-- `createAdminClient()` (service_role) — verified across all 29 `.rpc(`
-- occurrences, which resolve to just five distinct functions:
--
--   register_member_guarded      src/features/members/services/SupabaseMemberRepository.ts
--                                (both callers: app/api/members/route.ts and
--                                 app/api/public/registrations/route.ts use
--                                 createAdminClient)
--   save_gym_subscription        src/features/subscriptions/services/
--   process_dunning_suspensions    SupabaseGymSubscriptionRepository.ts
--   process_trial_expiry           (webhooks + cron routes, all createAdminClient)
--   schedule_charge_retry
--
-- Nothing calls any of them as `anon` or `authenticated`, so revoking those
-- two roles is behaviour-preserving for the application.
--
-- The remaining ten need no grant at all:
--   * Trigger functions (assign_member_number, enforce_active_member_quota,
--     sync_gym_member_count) fire through the trigger mechanism, which does
--     NOT check EXECUTE on the trigger function — permission is checked when
--     the trigger is created, not when it fires. Verified on PostgreSQL 16 by
--     revoking all EXECUTE and confirming an INSERT by a non-privileged role
--     still assigns member_number and increments member_count.
--   * assert_gym_can_add_active_member is only ever reached from inside
--     register_member_guarded and the quota trigger, both of which already
--     run as `postgres`.
--   * get_revenue_stats, get_member_payment_history, get_overdue_members,
--     get_upcoming_due_members, cleanup_old_announcement_failures and
--     is_gym_owner have no caller anywhere in the repo.
--
-- Note on is_gym_owner: its COMMENT advertises it as an RLS helper, but no
-- policy references it. If a future policy does call it, `authenticated` will
-- need EXECUTE granted back explicitly.
--
-- Note on provenance: migrations 20260704000003 and 20260708000001/000004
-- already REVOKE these exact privileges, yet the hosted project still shows
-- `anon=X | authenticated=X` on register_member_guarded, save_gym_subscription
-- and assert_gym_can_add_active_member. No migration re-grants them, so they
-- were re-granted outside version control. The assertion at the foot of this
-- file exists so that regression is caught rather than silently re-introduced.
--
-- SECURITY INVOKER functions are deliberately out of scope: they run as the
-- caller, so RLS still applies and the linters do not flag them.
--
-- Idempotent: REVOKE/GRANT are declarative, so this is safe to re-run.

-- ---------- Revoke from every SECURITY DEFINER function ---------------------

REVOKE ALL ON FUNCTION public.assert_gym_can_add_active_member(uuid)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_member_number()                                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_announcement_failures()                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_active_member_quota()                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_member_payment_history(uuid)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_overdue_members(uuid)                             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_revenue_stats(uuid, date, date)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_upcoming_due_members(uuid, integer)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_gym_owner(uuid)                                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_dunning_suspensions(integer)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_trial_expiry()                                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_member_guarded(uuid, jsonb)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_gym_subscription(uuid, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.schedule_charge_retry(uuid, integer, integer)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_gym_member_count()                               FROM PUBLIC, anon, authenticated;

-- ---------- Re-grant only what the application actually calls ---------------

GRANT EXECUTE ON FUNCTION public.register_member_guarded(uuid, jsonb)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.save_gym_subscription(uuid, text, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_dunning_suspensions(integer)                 TO service_role;
GRANT EXECUTE ON FUNCTION public.process_trial_expiry()                               TO service_role;
GRANT EXECUTE ON FUNCTION public.schedule_charge_retry(uuid, integer, integer)        TO service_role;

-- ---------- Assertions ------------------------------------------------------

-- 1. No SECURITY DEFINER function in `public` may be executable by anon or
--    authenticated. has_function_privilege() accounts for PUBLIC grants and
--    role membership, so this catches a re-grant by any route.
DO $$
DECLARE
  v_leaked text;
BEGIN
  SELECT string_agg(
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') -> ' ||
           CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE')
                 AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
                THEN 'anon+authenticated'
                WHEN has_function_privilege('anon', p.oid, 'EXECUTE')
                THEN 'anon'
                ELSE 'authenticated'
           END, ', ' ORDER BY p.proname)
    INTO v_leaked
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d
           ON d.objid = p.oid AND d.classid = 'pg_proc'::regclass AND d.deptype = 'e'
   WHERE n.nspname = 'public'
     AND d.objid IS NULL
     AND p.prosecdef
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));

  IF v_leaked IS NOT NULL THEN
    RAISE EXCEPTION
      'SECURITY DEFINER functions still executable by anon/authenticated: %', v_leaked;
  END IF;
END;
$$;

-- 2. The five functions the application calls must remain executable by
--    service_role, or the dashboard, public registration, webhooks and crons
--    all break. Fail here rather than in production.
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(sig, ', ' ORDER BY sig) INTO v_missing
    FROM (
      VALUES ('public.register_member_guarded(uuid, jsonb)'),
             ('public.save_gym_subscription(uuid, text, text, text, text, boolean)'),
             ('public.process_dunning_suspensions(integer)'),
             ('public.process_trial_expiry()'),
             ('public.schedule_charge_retry(uuid, integer, integer)')
    ) AS t(sig)
   WHERE NOT has_function_privilege('service_role', sig::regprocedure, 'EXECUTE');

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'service_role lost EXECUTE on application-called functions: %', v_missing;
  END IF;
END;
$$;
