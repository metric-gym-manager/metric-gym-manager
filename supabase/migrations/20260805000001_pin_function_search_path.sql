-- ============================================================
-- Pin search_path on every project-owned function in `public`
-- ============================================================
--
-- Fixes Supabase linter 0011 `function_search_path_mutable`, which flagged all
-- 20 functions this project owns in `public`. None of them had a `search_path`
-- pinned (`pg_proc.proconfig IS NULL`), so each one resolved unqualified object
-- names using whatever `search_path` the *caller* happened to have.
--
-- Why that matters: 15 of the 20 are SECURITY DEFINER and run as `postgres`.
-- A caller who can create objects in a schema that sits earlier in their own
-- search_path can shadow an unqualified name in the function body (a table, a
-- view, a type) and have the definer execute against the attacker's object with
-- superuser rights. `register_member_guarded`, `save_gym_subscription` and
-- `assert_gym_can_add_active_member` are the sharpest cases: they are the
-- multi-tenant quota and billing gates.
--
-- The fix is `SET search_path` on each function, which stores the setting in
-- `pg_proc.proconfig` and applies it for the duration of every call regardless
-- of the caller. No function body changes.
--
-- Why `pg_catalog, public, pg_temp` specifically:
--   * `pg_catalog` first  — built-in functions/operators can never be shadowed.
--   * `public`            — where every table, view and enum this project uses
--                           lives (pg_trgm is installed here too), so bodies
--                           keep resolving exactly as they did before. This is
--                           what makes the change behaviour-preserving: no body
--                           needs to be rewritten with qualified names.
--   * `pg_temp` LAST      — this is the part that is easy to miss. Postgres
--                           searches the session temp schema *first*, ahead of
--                           even pg_catalog, whenever `pg_temp` is not named
--                           explicitly in the path. It is only consulted for
--                           relation and type names, never functions/operators
--                           — but that is precisely enough for any caller to
--                           create a temp table named `members` or `gyms` and
--                           shadow the real one inside a SECURITY DEFINER body.
--                           Naming `pg_temp` last demotes it to lowest priority
--                           and closes that hole. Omitting it would leave the
--                           linter satisfied but the function still shadowable.
--
-- Do NOT "simplify" this to `SET search_path = ''`. That is the remediation the
-- Supabase docs suggest, and it does silence the linter, but it does not list
-- `pg_temp` either — so the temp schema is still searched first and the
-- shadowing hole stays wide open. Verified on PostgreSQL 16 by planting a temp
-- table named `gyms` and calling `is_gym_owner()` as a non-owner:
--
--     mutable search_path (before)      -> true   (attacker "owns" the gym)
--     search_path = pg_catalog,public,pg_temp -> false  (correct)
--     search_path = pg_catalog,public   -> true   (still exploitable)
--     search_path = ''                  -> true   (still exploitable)
--
-- Only the three-element form is actually safe. Keep `pg_temp` last.
--
-- Deliberately NOT touched: the `auth`, `storage`, `realtime`, `extensions` and
-- `graphql_public` schemas. Those functions are Supabase-managed and are reset
-- by platform upgrades; the linter excludes them and so do we. pg_trgm's own
-- functions in `public` are extension-owned and are likewise left alone.
--
-- Idempotent: `ALTER FUNCTION ... SET` overwrites any existing setting, so this
-- migration is safe to re-run.

-- ---------- SECURITY DEFINER (runs as `postgres` — the real exposure) --------

ALTER FUNCTION public.assert_gym_can_add_active_member(uuid)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.assign_member_number()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.cleanup_old_announcement_failures()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.enforce_active_member_quota()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.get_member_payment_history(uuid)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.get_overdue_members(uuid)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.get_revenue_stats(uuid, date, date)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.get_upcoming_due_members(uuid, integer)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.is_gym_owner(uuid)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.process_dunning_suspensions(integer)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.process_trial_expiry()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.register_member_guarded(uuid, jsonb)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.save_gym_subscription(uuid, text, text, text, text, boolean)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.schedule_charge_retry(uuid, integer, integer)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.sync_gym_member_count()
  SET search_path = pg_catalog, public, pg_temp;

-- ---------- SECURITY INVOKER (lower risk, but the linter flags them too) -----

ALTER FUNCTION public.calculate_next_due_date(public.member_plan_type, date)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.calculate_payment_amount(numeric, integer)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.prevent_subscription_self_update()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = pg_catalog, public, pg_temp;

-- ---------- Drift: exists on the hosted project, not in this repo ------------
--
-- `public.cleanup_expired_otps()` and the `phone_verifications` table it deletes
-- from were created directly against the hosted project (remote migration
-- `20260214020546_create_phone_verifications_table`) and have no migration file
-- here. A replay of this repo onto an empty database therefore never creates it,
-- so an unguarded ALTER would abort the migration. Guarded rather than assumed.

DO $$
BEGIN
  IF to_regprocedure('public.cleanup_expired_otps()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.cleanup_expired_otps() '
            'SET search_path = pg_catalog, public, pg_temp';
  END IF;
END;
$$;

-- ---------- Assertion: fail loudly if anything was missed -------------------
--
-- Guards against a function being added later without a pinned search_path and
-- against this migration silently drifting out of date. Extension-owned
-- functions (pg_trgm) are excluded — they are not ours to alter.

DO $$
DECLARE
  v_unpinned text;
BEGIN
  SELECT string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', '
                    ORDER BY p.proname)
    INTO v_unpinned
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d
           ON d.objid = p.oid
          AND d.classid = 'pg_proc'::regclass
          AND d.deptype = 'e'
   WHERE n.nspname = 'public'
     AND d.objid IS NULL
     AND NOT EXISTS (
           SELECT 1
             FROM unnest(coalesce(p.proconfig, '{}')) AS c
            WHERE c LIKE 'search\_path=%'
         );

  IF v_unpinned IS NOT NULL THEN
    RAISE EXCEPTION
      'Functions in public still have a mutable search_path: %', v_unpinned;
  END IF;
END;
$$;
