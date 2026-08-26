-- Access control: reclaim jobs stranded by a killed worker.
--
-- Companion to 20260810000002_access_control_functions.sql.

-- ============================================================
-- STALE IN-FLIGHT RECLAIM
-- ============================================================
-- claim_access_sync_jobs() moves a job to 'in_flight' and only ever picks up
-- 'pending' or 'failed'. So if the worker holding it dies — a serverless
-- timeout, a deploy mid-run, an OOM — that job is stranded permanently. There
-- is no path back, nothing reports it, and the member simply never syncs
-- again.
--
-- Every drain run therefore calls this first, which makes each run heal the
-- previous run's casualties.
--
-- The threshold wants to be comfortably longer than a healthy drain (so a
-- slow-but-alive worker is never robbed of its own job) and far shorter than
-- anyone would notice at a door.
CREATE OR REPLACE FUNCTION reclaim_stale_access_sync_jobs(
  p_older_than_seconds INTEGER DEFAULT 600
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reclaimed INTEGER;
BEGIN
  WITH stale AS (
    SELECT id
    FROM access_sync_jobs
    WHERE status = 'in_flight'
      AND updated_at < NOW() - MAKE_INTERVAL(secs => p_older_than_seconds)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE access_sync_jobs j
  SET status = 'pending',
      -- Due immediately: this job has already waited out the whole threshold.
      next_attempt_at = NOW(),
      last_error = COALESCE(j.last_error, 'Reclaimed after the worker stopped responding'),
      updated_at = NOW()
  FROM stale
  WHERE j.id = stale.id;

  GET DIAGNOSTICS v_reclaimed = ROW_COUNT;

  RETURN v_reclaimed;
END;
$$;

COMMENT ON FUNCTION reclaim_stale_access_sync_jobs(INTEGER) IS
  'Returns in_flight jobs abandoned by a dead worker to pending. Without it a killed drain invocation strands its claimed jobs forever, and those members never sync again.';

-- The reclaim scan filters on status + updated_at; without this it degrades to
-- a full scan of the outbox as the table grows.
CREATE INDEX IF NOT EXISTS idx_access_sync_jobs_in_flight
  ON access_sync_jobs(updated_at)
  WHERE status = 'in_flight';
