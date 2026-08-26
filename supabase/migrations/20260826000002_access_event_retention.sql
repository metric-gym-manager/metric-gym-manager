-- Access event retention — an index the purge can actually use
--
-- `access_events` holds attendance data about identifiable people and was
-- previously kept forever. `/api/cron/purge-access-events` now deletes rows
-- older than `ACCESS_EVENT_RETENTION_DAYS` (12 months) every night.
--
-- ## Why `created_at` and not `occurred_at`
--
-- `occurred_at` is the **device's** idea of the time — `AttTime` parsed against
-- that reader's stored timezone offset. This feature already treats device
-- clocks as untrustworthy (drift is inferred, never read; see
-- DEVICE_CLOCK_SKEW_ALERT_SECONDS). A reader whose RTC has reset or whose
-- offset was mis-entered stamps today's entries with a date a year in the past,
-- and a purge keyed on that figure would delete this morning's scans tonight —
-- irreversibly, and reported as a perfectly ordinary run.
--
-- `created_at` is written by the database when we stored the row. It cannot be
-- wrong, and it is what a retention promise actually measures: how long we keep
-- something after receiving it. A reader offline for months that then uploads
-- its buffer keeps those scans 12 months from upload — longer than needed,
-- which is the safe direction, because deletion does not come back.
--
-- ## Why a third index rather than reusing one of the two that exist
--
-- Both existing indexes lead with a tenant column:
--
--   idx_access_events_gym_time    (gym_id, occurred_at DESC)
--   idx_access_events_member_time (member_id, occurred_at DESC)
--
-- They serve the check-in log, which is always "this gym, newest first". The
-- purge is the opposite shape: every gym, oldest first, bounded by a date, and
-- on a different column entirely. A leading equality column it cannot supply
-- makes both useless to it, leaving a sequential scan of the whole table on a
-- job that runs daily and is expected to delete nothing on most of those days.
--
-- Ascending, because the purge reads from the old end.

CREATE INDEX IF NOT EXISTS idx_access_events_created_at
  ON access_events(created_at);

COMMENT ON INDEX idx_access_events_created_at IS
  'Serves the retention purge (global, oldest-first, bounded by created_at). Retention is measured from when we stored the row, never from the device-supplied occurred_at, which a reset reader clock can put a year in the past.';
