-- Record member status changes, so revenue history can eventually be truthful.
--
-- WHY
-- `members` stores only the *current* status. There is no `cancelled_at` and no
-- audit trail, so for any past month it is impossible to know who was an active,
-- billable member at the time. That is why the revenue read model no longer
-- publishes a historical "billed" series: the previous one recomputed every past
-- month from *today's* active set, which erased anyone who had since cancelled
-- and silently rewrote history whenever a member left.
--
-- This table does not fix the past — nothing can, the information was never
-- recorded. It makes the future answerable: once there are twelve months of
-- transitions here, "who was billable in March" becomes a fact rather than an
-- approximation, and the historical billed series can be reinstated honestly.
--
-- SHAPE
-- `from_status IS NULL` marks the baseline snapshot written by this migration,
-- not an observed transition. Consumers must treat it as "status at seeding
-- time; anything earlier is unknown" rather than as a member's first status.
-- `changed_at` for those rows is `members.updated_at`, which is the last time
-- *any* column changed — a lower bound on the status change, not the moment of
-- it. Honest imprecision, labelled as such.

CREATE TABLE IF NOT EXISTS public.member_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  gym_id      uuid NOT NULL REFERENCES public.gyms(id)    ON DELETE CASCADE,
  -- NULL = baseline snapshot, see above.
  from_status member_status,
  to_status   member_status NOT NULL,
  changed_at  timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.member_status_history IS
  'Append-only log of member status transitions. from_status IS NULL marks the '
  'baseline snapshot taken when this table was created, not a real transition.';

-- Reads are "what was this gym''s membership on date X", so gym + time leads.
CREATE INDEX IF NOT EXISTS idx_member_status_history_gym_changed
  ON public.member_status_history (gym_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_status_history_member_changed
  ON public.member_status_history (member_id, changed_at DESC);

ALTER TABLE public.member_status_history ENABLE ROW LEVEL SECURITY;

-- SELECT only, and only your own gym. No INSERT/UPDATE/DELETE policy exists:
-- the log is written exclusively by the trigger below, which runs as definer.
-- An append-only audit trail that the audited party can edit is not one.
DROP POLICY IF EXISTS "Gym owners can view own member status history"
  ON public.member_status_history;
CREATE POLICY "Gym owners can view own member status history"
  ON public.member_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.gyms
      WHERE gyms.id = member_status_history.gym_id
        AND gyms.user_id = auth.uid()
    )
  );

-- Trigger function.
--
-- search_path is pinned with pg_temp LAST (rule 2.18): with pg_temp unlisted,
-- Postgres searches the session temp schema first for relation and type names,
-- so any caller could CREATE TEMP TABLE members and shadow the real table
-- inside a SECURITY DEFINER body. `SET search_path = ''` does not fix this and
-- is not used here.
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
    VALUES (NEW.id, NEW.gym_id, OLD.status, NEW.status, now());
  END IF;
  RETURN NEW;
END;
$$;

-- No GRANT: EXECUTE is not checked when a trigger fires, so granting it would
-- only widen the surface. REVOKE because PostgREST exposes every function in
-- `public` at /rest/v1/rpc/<name>.
REVOKE ALL ON FUNCTION public.record_member_status_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_record_member_status_change ON public.members;
CREATE TRIGGER trg_record_member_status_change
  AFTER UPDATE OF status ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.record_member_status_change();

-- Baseline snapshot: one row per existing member, only if the table is empty,
-- so a replay from an empty database and a re-run against production both end
-- in the same state (R11).
INSERT INTO public.member_status_history
  (member_id, gym_id, from_status, to_status, changed_at)
SELECT m.id, m.gym_id, NULL, m.status, m.updated_at
FROM public.members m
WHERE NOT EXISTS (SELECT 1 FROM public.member_status_history);
