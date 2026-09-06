-- Timestamp status transitions with clock_timestamp(), not now().
--
-- `now()` returns the *transaction* start time, so every status change made
-- inside one transaction receives an identical timestamp and the log cannot be
-- ordered. Verified immediately after 20260905000003 shipped: flipping a member
-- active -> suspended -> active produced two rows with the same
-- `changed_at` (…10:39:28.062528), and `ORDER BY changed_at` returned them in
-- the wrong order — reporting the member had gone suspended -> active before
-- active -> suspended.
--
-- That matters because the whole purpose of this table is to answer "what was
-- this member's status on date X" by replaying transitions in order. Two
-- unorderable rows make the answer arbitrary. Cron jobs are exactly where this
-- bites: `update-expired-status` and `cancel-overdue-members` move many members
-- in a single transaction.
--
-- `clock_timestamp()` advances within a transaction and is the correct clock
-- for an audit trail of discrete events.
--
-- Left as a separate migration rather than editing 20260905000003, so the chain
-- records what was actually applied and when.

CREATE OR REPLACE FUNCTION public.record_member_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.member_status_history
      (member_id, gym_id, from_status, to_status, changed_at)
    VALUES (NEW.id, NEW.gym_id, OLD.status, NEW.status, clock_timestamp());
  END IF;
  RETURN NEW;
END;
$$;

-- CREATE OR REPLACE discards proconfig and proacl, so both are re-applied
-- (rule 2.18). No GRANT: EXECUTE is not checked when a trigger fires.
REVOKE ALL ON FUNCTION public.record_member_status_change()
  FROM PUBLIC, anon, authenticated;

-- Also default the column, so any future direct insert cannot silently reuse
-- the transaction clock.
ALTER TABLE public.member_status_history
  ALTER COLUMN changed_at SET DEFAULT clock_timestamp();
