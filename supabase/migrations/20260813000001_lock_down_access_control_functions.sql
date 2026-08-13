-- Access control: revoke public EXECUTE on the SECURITY DEFINER functions.
--
-- ## What was wrong
--
-- The four access-control functions plus the trigger function were created
-- without an explicit grant, so they inherited PostgREST's default: callable
-- by `anon` and `authenticated` over `/rest/v1/rpc/*`. Every other
-- SECURITY DEFINER function in this database is already locked to
-- `postgres` + `service_role`; these five were the exception, and the
-- omission was mine.
--
-- The worst of the five is `claim_access_sync_jobs`. It is SECURITY DEFINER,
-- so it bypasses RLS by design — and it both **returns** outbox rows (which
-- carry `last_error`, i.e. raw vendor text for every gym) and **mutates** them
-- to `in_flight`. Any signed-in user could therefore have read other gyms'
-- sync state and stranded their jobs, which the reclaim would only undo ten
-- minutes later.
--
-- The others are lower severity but not harmless:
--
--   * `allocate_access_subject_id` burns values from a finite global sequence
--     (79,999,999 ids for the whole platform) — a cheap exhaustion attack.
--   * `reclaim_stale_access_sync_jobs` and `recount_device_templates` let a
--     caller churn another gym's rows.
--   * `enqueue_access_sync_for_member` is a trigger function and was never
--     meant to be callable at all.
--
-- ## The rule
--
-- These are all server-side plumbing, reached only through the service-role
-- client in cron jobs and the webhook. None of them has any business being on
-- the public API surface. Revoking from PUBLIC covers future roles too, so a
-- role added later does not silently inherit access.

REVOKE ALL ON FUNCTION allocate_access_subject_id()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION claim_access_sync_jobs(INTEGER)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION reclaim_stale_access_sync_jobs(INTEGER)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION recount_device_templates(UUID)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION enqueue_access_sync_for_member()
  FROM PUBLIC, anon, authenticated;

-- Re-granted explicitly, so the intended callers are stated rather than
-- inherited. The trigger function needs no grant: triggers execute as the
-- table owner regardless.
GRANT EXECUTE ON FUNCTION allocate_access_subject_id() TO service_role;
GRANT EXECUTE ON FUNCTION claim_access_sync_jobs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION reclaim_stale_access_sync_jobs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION recount_device_templates(UUID) TO service_role;
