-- ============================================================
-- Remove 'frozen' from member_status — completing a change that silently failed
-- ============================================================
--
-- `20260326000001_remove_frozen_status.sql` was written to do this in March and
-- never took effect: `member_status` still contains `frozen`, while the
-- TypeScript `MemberStatus` enum has only active/expired/suspended/cancelled.
-- Audited 2026-09-05 against the live database.
--
-- This is NOT a re-run of that migration, for three reasons. Running it today
-- would have made things worse:
--
--  1. It recreates `get_overdue_members` / `get_upcoming_due_members` with
--     `plan_type member_plan_type` and a `- INTERVAL '7 days'` grace window.
--     Both were deliberately changed since — `fix_due_member_fn_plan_type`
--     moved the column to `text`, and the no-grace expiry rule (§2.13) removed
--     the seven days. Re-running would revert both.
--  2. Those recreations carry no `SET search_path` and no REVOKE/GRANT, so they
--     would discard the pin applied by `20260805000001` and the lockdown from
--     `20260806071902` — exactly the `proconfig`/`proacl` regression rule 2.18
--     warns about, and it would undo migration `20260905000005` from minutes
--     earlier.
--  3. It predates `member_status_history`, which now has *two* more columns of
--     this type, and it drops none of the three triggers that carry a column
--     dependency on `members.status`. The old swap would fail on all of them —
--     the first attempt at this migration did, with
--     `cannot alter type of a column used in a trigger definition`.
--
-- The definitions restored below are the **live** ones, read from
-- `pg_get_functiondef` rather than copied from an older migration.
--
-- Idempotent: the swap is guarded on `frozen` still existing, so a replay from
-- an empty database (where the type is created without it) is a no-op.

-- ---------- 1. Data, then the type swap, only if 'frozen' is still there -----

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'member_status' AND e.enumlabel = 'frozen'
  ) THEN
    -- No member holds it today (verified: active 217, cancelled 97, expired 20,
    -- suspended 2, frozen 0) but the conversion runs regardless, because a row
    -- written between this audit and this migration would otherwise block the
    -- cast. `suspended` is the status the March migration chose as its
    -- replacement — frozen was judged redundant with it.
    EXECUTE $sql$ UPDATE members SET status = 'suspended' WHERE status = 'frozen' $sql$;
    EXECUTE $sql$ UPDATE member_status_history SET from_status = 'suspended' WHERE from_status = 'frozen' $sql$;
    EXECUTE $sql$ UPDATE member_status_history SET to_status   = 'suspended' WHERE to_status   = 'frozen' $sql$;

    -- Everything bound to the type must be detached before it can be swapped.
    -- Two functions return it in their signature, one partial index binds it in
    -- its predicate, and — the part that is easy to miss and that failed on the
    -- first attempt — three triggers declared `UPDATE OF status` hold a column
    -- dependency. A trigger with an `OF column` clause blocks the type change
    -- with `cannot alter type of a column used in a trigger definition`, and
    -- `pg_trigger.tgattr` is where that dependency is visible.
    --
    -- Two of the three are load-bearing (§2.13): the active-member quota gate
    -- and the trigger-maintained `gyms.member_count`. They are recreated below
    -- verbatim from `pg_get_triggerdef`, names unchanged so firing order (which
    -- Postgres takes alphabetically) is preserved.
    EXECUTE $sql$ DROP INDEX IF EXISTS idx_members_overdue $sql$;
    EXECUTE $sql$ DROP FUNCTION IF EXISTS get_overdue_members(uuid) $sql$;
    EXECUTE $sql$ DROP FUNCTION IF EXISTS get_upcoming_due_members(uuid, integer) $sql$;
    EXECUTE $sql$ DROP TRIGGER IF EXISTS trg_enforce_active_member_quota ON members $sql$;
    EXECUTE $sql$ DROP TRIGGER IF EXISTS trg_record_member_status_change ON members $sql$;
    EXECUTE $sql$ DROP TRIGGER IF EXISTS trg_sync_gym_member_count ON members $sql$;
    EXECUTE $sql$ ALTER TABLE members ALTER COLUMN status DROP DEFAULT $sql$;

    EXECUTE $sql$ ALTER TYPE member_status RENAME TO member_status_old $sql$;
    EXECUTE $sql$ CREATE TYPE member_status AS ENUM ('active','expired','suspended','cancelled') $sql$;

    EXECUTE $sql$ ALTER TABLE members
      ALTER COLUMN status TYPE member_status USING status::text::member_status $sql$;
    EXECUTE $sql$ ALTER TABLE member_status_history
      ALTER COLUMN from_status TYPE member_status USING from_status::text::member_status $sql$;
    EXECUTE $sql$ ALTER TABLE member_status_history
      ALTER COLUMN to_status TYPE member_status USING to_status::text::member_status $sql$;

    EXECUTE $sql$ ALTER TABLE members ALTER COLUMN status SET DEFAULT 'active' $sql$;
    EXECUTE $sql$ DROP TYPE member_status_old $sql$;

    -- Verbatim from pg_get_triggerdef, taken from the live database before the
    -- swap. Restoring these is not optional: without the quota trigger a gym
    -- could exceed its plan's active-member cap, and without the count trigger
    -- `gyms.member_count` would drift.
    EXECUTE $sql$ CREATE TRIGGER trg_enforce_active_member_quota
      BEFORE INSERT OR UPDATE OF status ON members
      FOR EACH ROW EXECUTE FUNCTION enforce_active_member_quota() $sql$;
    EXECUTE $sql$ CREATE TRIGGER trg_record_member_status_change
      AFTER UPDATE OF status ON members
      FOR EACH ROW EXECUTE FUNCTION record_member_status_change() $sql$;
    EXECUTE $sql$ CREATE TRIGGER trg_sync_gym_member_count
      AFTER INSERT OR DELETE OR UPDATE OF status ON members
      FOR EACH ROW EXECUTE FUNCTION sync_gym_member_count() $sql$;
  END IF;
END $$;

-- ---------- 2. Restore the dependants, unconditionally ----------------------
--
-- Safe either way: if the swap ran they were dropped, and if it did not these
-- are identical replacements. Written outside the guard so the pin and the
-- grants below are re-asserted on every apply.

CREATE INDEX IF NOT EXISTS idx_members_overdue
  ON members (gym_id, status, next_due_date)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.get_overdue_members(p_gym_id uuid)
RETURNS TABLE(member_id uuid, member_name text, phone_number text,
              plan_type text, plan_amount numeric, next_due_date date,
              days_overdue integer, status member_status)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
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
    AND m.next_due_date < CURRENT_DATE
  ORDER BY m.next_due_date ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_upcoming_due_members(
  p_gym_id uuid,
  p_days_ahead integer DEFAULT 7
)
RETURNS TABLE(member_id uuid, member_name text, phone_number text,
              plan_type text, plan_amount numeric, next_due_date date,
              days_until_due integer, status member_status)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
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
$function$;

-- CREATE OR REPLACE discards proacl, so the lockdown from 20260806071902 is
-- re-asserted here rather than assumed (rule 2.18). Grants preserved exactly as
-- they were; this migration removes an enum value, it does not re-open the
-- question of who may execute these.
REVOKE ALL ON FUNCTION public.get_overdue_members(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_upcoming_due_members(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_overdue_members(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_upcoming_due_members(uuid, integer) TO service_role;

COMMENT ON TYPE member_status IS
  'Member status: active, expired, suspended, cancelled. "frozen" was judged '
  'redundant with "suspended" and removed 2026-09-05, completing the intent of '
  '20260326000001 which never took effect.';
