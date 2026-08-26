-- ============================================================
-- Repair get_overdue_members / get_upcoming_due_members
-- ============================================================
--
-- Both functions fail on EVERY call on the hosted project:
--
--   ERROR: 42804: structure of query does not match function result type
--   DETAIL: Returned type text does not match expected type member_plan_type
--           in column 4.
--
-- Cause: `members.plan_type` was converted from the `member_plan_type` enum to
-- `text` (to allow gym-defined custom plans), but both functions still declare
-- their 4th OUT column as `member_plan_type`. plpgsql checks the RETURN QUERY
-- row shape against the declared result type at runtime, so the mismatch
-- aborts the call. `20260727000001_align_member_expiry_no_grace` redefined
-- get_overdue_members and carried the stale declaration forward.
--
-- Fix: declare the column `text` and cast explicitly in the body with
-- `m.plan_type::text`. The explicit cast — rather than relying on the column's
-- current type — is deliberate: the hosted project has `plan_type text`, but a
-- fresh replay of this repo still produces the enum, because the migration
-- that performed the conversion (remote `20260301052657_allow_custom_plan_types`)
-- has no file here. `enum::text` and `text::text` are both valid, so this one
-- definition is correct against either schema. See
-- 20260805000004_reconcile_hosted_drift.sql, which brings the column itself
-- back under version control.
--
-- Changing an OUT column type requires DROP + CREATE; CREATE OR REPLACE cannot
-- do it. DROP also discards `proconfig` and `proacl`, so the search_path pin
-- from 20260805000001 and the EXECUTE revocation from 20260805000002 are
-- re-applied below. Omitting either would silently regress both fixes.
--
-- Behaviour is otherwise unchanged: same filters, same ordering, same columns.

DROP FUNCTION IF EXISTS public.get_overdue_members(uuid);
DROP FUNCTION IF EXISTS public.get_upcoming_due_members(uuid, integer);

-- ---------- get_overdue_members --------------------------------------------

CREATE FUNCTION public.get_overdue_members(p_gym_id uuid)
RETURNS TABLE (
  member_id     uuid,
  member_name   text,
  phone_number  text,
  plan_type     text,
  plan_amount   decimal,
  next_due_date date,
  days_overdue  integer,
  status        member_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS member_id,
    m.name AS member_name,
    m.phone_number,
    m.plan_type::text,
    m.plan_amount,
    m.next_due_date,
    (CURRENT_DATE - m.next_due_date)::INTEGER AS days_overdue,
    m.status
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    -- No grace period: overdue the day after next_due_date
    AND m.next_due_date < CURRENT_DATE
  ORDER BY m.next_due_date ASC; -- Most overdue first
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ---------- get_upcoming_due_members ---------------------------------------

CREATE FUNCTION public.get_upcoming_due_members(
  p_gym_id     uuid,
  p_days_ahead integer DEFAULT 7
)
RETURNS TABLE (
  member_id      uuid,
  member_name    text,
  phone_number   text,
  plan_type      text,
  plan_amount    decimal,
  next_due_date  date,
  days_until_due integer,
  status         member_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS member_id,
    m.name AS member_name,
    m.phone_number,
    m.plan_type::text,
    m.plan_amount,
    m.next_due_date,
    (m.next_due_date - CURRENT_DATE)::INTEGER AS days_until_due,
    m.status
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.status = 'active'
    AND m.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL
  ORDER BY m.next_due_date ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ---------- Re-apply what DROP discarded ------------------------------------

-- search_path pin (20260805000001). pg_temp MUST stay last — see that file.
ALTER FUNCTION public.get_overdue_members(uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_upcoming_due_members(uuid, integer)
  SET search_path = pg_catalog, public, pg_temp;

-- EXECUTE revocation (20260805000002). Neither has any caller in the repo, so
-- no role is granted back.
REVOKE ALL ON FUNCTION public.get_overdue_members(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_upcoming_due_members(uuid, integer) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.get_overdue_members(uuid) IS
  'Active members past their next_due_date (no grace period). plan_type is text: gyms may define custom plans.';
COMMENT ON FUNCTION public.get_upcoming_due_members(uuid, integer) IS
  'Active members due within p_days_ahead days. plan_type is text: gyms may define custom plans.';

-- ---------- Assertion: both must actually execute now -----------------------
--
-- The whole point of this migration is that these two were callable but always
-- threw. Prove they run, and that the previous two migrations survived.

DO $$
DECLARE
  v_gym uuid;
  v_a   integer;
  v_b   integer;
BEGIN
  SELECT id INTO v_gym FROM public.gyms LIMIT 1;
  IF v_gym IS NULL THEN
    v_gym := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  SELECT count(*) INTO v_a FROM public.get_overdue_members(v_gym);
  SELECT count(*) INTO v_b FROM public.get_upcoming_due_members(v_gym, 7);

  IF (SELECT count(*) FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('get_overdue_members','get_upcoming_due_members')
         AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c
                          WHERE c LIKE 'search\_path=%')) > 0 THEN
    RAISE EXCEPTION 'search_path pin was not re-applied after DROP/CREATE';
  END IF;

  IF has_function_privilege('anon', 'public.get_overdue_members(uuid)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_upcoming_due_members(uuid, integer)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'EXECUTE revocation was not re-applied after DROP/CREATE';
  END IF;
END;
$$;
