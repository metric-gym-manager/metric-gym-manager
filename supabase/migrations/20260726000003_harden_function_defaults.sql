-- Make the RPC lockdown durable (security audit C2 root cause + H8)
--
-- This is the fix that 20260726000001 is only the containment for. Without it,
-- the revoke in that migration will silently undo itself the next time any of
-- those functions changes signature.
--
-- ---------------------------------------------------------------------------
-- PART 1 — Invert the default privilege (the root cause)
-- ---------------------------------------------------------------------------
-- Supabase projects ship with:
--
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
--
-- so EVERY function created in `public` is born callable by the anon key. That
-- is why the 20260704000003 revoke evaporated: `save_gym_subscription` gained a
-- `p_extend_period` parameter, a new signature is a new function object, and the
-- default grant fired again on the new object.
--
-- Inverting the default flips the failure mode from "silently exposed in
-- production" to "visibly broken in testing" — a new RPC function must now be
-- granted explicitly and deliberately, which is a reviewable line in a diff.
--
-- Scope note: this affects FUTURE functions created by `postgres` in `public`.
-- It does not retroactively change existing grants (20260726000001 does that),
-- and it does not touch service_role, which keeps EXECUTE and is how all
-- legitimate server-side callers reach these functions.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- PART 2 — Pin search_path on every project function (audit H8)
-- ---------------------------------------------------------------------------
-- 21 functions had a mutable search_path (`proconfig IS NULL`), several of them
-- SECURITY DEFINER. An unpinned search_path on a SECURITY DEFINER function is a
-- recognised privilege-escalation primitive: an attacker who can create an
-- object in a schema that resolves earlier than the intended one can shadow a
-- table or operator and have it executed with the function owner's privileges.
--
-- Exploiting it here would require CREATE on some schema in the resolution
-- path, which anon/authenticated do not have by default — so this is hardening
-- against a chain rather than closing a live hole. It is also free.
--
-- `ALTER FUNCTION ... SET search_path` is a metadata-only change: it does not
-- recreate the function, so it does NOT re-trigger the default grant, and it
-- does not alter the function body or its ACL. Applied via a loop so the change
-- cannot miss a signature, and scoped to project-owned functions only —
-- extension functions (pg_trgm et al.) are excluded because their search_path
-- is the extension author's concern, not ours.

DO $$
DECLARE
  fn      record;
  n_fixed integer := 0;
BEGIN
  FOR fn IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proconfig IS NULL                       -- not already pinned
      AND NOT EXISTS (                              -- not owned by an extension
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = pg_catalog, public, pg_temp',
      fn.proname, fn.args
    );
    n_fixed := n_fixed + 1;
  END LOOP;

  RAISE NOTICE 'search_path pinned on % project function(s).', n_fixed;
END;
$$;

-- ---------------------------------------------------------------------------
-- PART 3 — Self-verification
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_unpinned text;
BEGIN
  SELECT string_agg(p.proname, ', ')
    INTO v_unpinned
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proconfig IS NULL
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e');

  IF v_unpinned IS NOT NULL THEN
    RAISE EXCEPTION 'Functions still have a mutable search_path: %', v_unpinned;
  END IF;

  RAISE NOTICE 'All project functions have a pinned search_path.';
END;
$$;

-- ---------------------------------------------------------------------------
-- DELIBERATELY NOT IN THIS MIGRATION
-- ---------------------------------------------------------------------------
-- Relocating the trigger functions and internal helpers into a non-exposed
-- `private` schema (the strongest layer — PostgREST cannot route to a schema it
-- does not expose, regardless of grants) is held back to a follow-up migration
-- because it rewires trigger-function callers:
--
--   * assert_gym_can_add_active_member is called by BOTH register_member_guarded
--     and the enforce_active_member_quota trigger. Moving it means recreating
--     both callers with a fully-qualified private.* call.
--   * Recreating a function re-applies default privileges — which is safe only
--     AFTER Part 1 of this migration is in place. Order matters.
--
-- That change must be verified on a Supabase branch (member registration, the
-- active-member quota trigger, and the public QR flow all exercise this path)
-- before it touches production. Branching requires the Pro plan.
