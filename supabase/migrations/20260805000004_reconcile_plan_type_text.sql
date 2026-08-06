-- ============================================================
-- Bring the plan_type -> text conversion under version control
-- ============================================================
--
-- The hosted project stores `members.plan_type` and `plan_types.plan_type` as
-- `text` guarded by a format CHECK, so gyms can define their own plan names.
-- The migration that performed that conversion (remote
-- `20260301052657_allow_custom_plan_types`) was applied directly to the hosted
-- project and never committed here, so a fresh replay of this repo still
-- produces `member_plan_type` enum columns.
--
-- That divergence is not cosmetic. Under a replayed schema the enum rejects any
-- gym-defined plan name outright, so a staging or local database silently
-- enforces rules production does not. This migration closes the gap by
-- reproducing the hosted state exactly:
--
--   members.plan_type     text NOT NULL  CHECK member_plan_type_format
--   plan_types.plan_type  text NOT NULL  CHECK plan_type_format
--
-- Both CHECK definitions are copied verbatim from the hosted project:
--   plan_type ~ '^[a-z0-9_-]+$' AND char_length(plan_type) BETWEEN 2 AND 50
-- The hyphen is what allows the live values '3-months' and '6-months'.
--
-- The `member_plan_type` enum itself is deliberately KEPT. It is still the
-- parameter type of calculate_next_due_date(member_plan_type, date) on the
-- hosted project, so dropping it would break that signature. Verified before
-- writing: no table column anywhere still uses the enum in production.
--
-- Safe on the hosted project: every branch below is a no-op there, because the
-- columns are already text and both constraints already exist. It only does
-- real work on a replayed database.
--
-- Verified before writing: no views or materialised views depend on these
-- columns, so ALTER COLUMN TYPE has nothing to cascade to.

-- ---------- members.plan_type ----------------------------------------------

DO $$
BEGIN
  IF (SELECT atttypid FROM pg_attribute
       WHERE attrelid = 'public.members'::regclass
         AND attname  = 'plan_type') <> 'text'::regtype
  THEN
    ALTER TABLE public.members
      ALTER COLUMN plan_type TYPE text USING plan_type::text;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.members'::regclass
       AND conname  = 'member_plan_type_format')
  THEN
    ALTER TABLE public.members
      ADD CONSTRAINT member_plan_type_format CHECK (
        plan_type ~ '^[a-z0-9_-]+$'
        AND char_length(plan_type) >= 2
        AND char_length(plan_type) <= 50
      );
  END IF;
END;
$$;

-- ---------- plan_types.plan_type -------------------------------------------

DO $$
BEGIN
  IF (SELECT atttypid FROM pg_attribute
       WHERE attrelid = 'public.plan_types'::regclass
         AND attname  = 'plan_type') <> 'text'::regtype
  THEN
    -- unique_gym_plan_type (gym_id, plan_type) is rebuilt automatically.
    ALTER TABLE public.plan_types
      ALTER COLUMN plan_type TYPE text USING plan_type::text;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.plan_types'::regclass
       AND conname  = 'plan_type_format')
  THEN
    ALTER TABLE public.plan_types
      ADD CONSTRAINT plan_type_format CHECK (
        plan_type ~ '^[a-z0-9_-]+$'
        AND char_length(plan_type) >= 2
        AND char_length(plan_type) <= 50
      );
  END IF;
END;
$$;

-- ---------- Assertion -------------------------------------------------------

DO $$
DECLARE
  v_problems text := '';
BEGIN
  IF (SELECT atttypid FROM pg_attribute
       WHERE attrelid='public.members'::regclass AND attname='plan_type') <> 'text'::regtype THEN
    v_problems := v_problems || 'members.plan_type is not text; ';
  END IF;

  IF (SELECT atttypid FROM pg_attribute
       WHERE attrelid='public.plan_types'::regclass AND attname='plan_type') <> 'text'::regtype THEN
    v_problems := v_problems || 'plan_types.plan_type is not text; ';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.members'::regclass AND conname='member_plan_type_format') THEN
    v_problems := v_problems || 'members CHECK missing; ';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.plan_types'::regclass AND conname='plan_type_format') THEN
    v_problems := v_problems || 'plan_types CHECK missing; ';
  END IF;

  -- The enum must survive: calculate_next_due_date still takes it.
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                  WHERE n.nspname='public' AND t.typname='member_plan_type') THEN
    v_problems := v_problems || 'member_plan_type enum was dropped; ';
  END IF;

  IF v_problems <> '' THEN
    RAISE EXCEPTION 'plan_type reconciliation incomplete: %', v_problems;
  END IF;
END;
$$;
