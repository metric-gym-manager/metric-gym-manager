-- Access event retention — an index the purge can actually use
--
-- `access_events` holds attendance data about identifiable people and was
-- previously kept forever. `/api/cron/purge-access-events` now deletes rows
-- older than `ACCESS_EVENT_RETENTION_DAYS` (12 months) every night.
--
-- ## Why a third index rather than reusing one of the two that exist
--
-- Both existing indexes lead with a tenant column:
--
--   idx_access_events_gym_time    (gym_id, occurred_at DESC)
--   idx_access_events_member_time (member_id, occurred_at DESC)
--
-- They serve the check-in log, which is always "this gym, newest first". The
-- purge is the opposite shape: every gym, oldest first, bounded by a date. A
-- leading equality column it cannot supply makes both useless to it, leaving a
-- sequential scan of the whole table on a job that runs daily and is expected
-- to delete nothing on most of those days.
--
-- Ascending, because the purge reads from the old end.

CREATE INDEX IF NOT EXISTS idx_access_events_occurred_at
  ON access_events(occurred_at);

COMMENT ON INDEX idx_access_events_occurred_at IS
  'Serves the retention purge (global, oldest-first, date-bounded). The gym/member indexes lead with a tenant column the purge cannot supply.';
