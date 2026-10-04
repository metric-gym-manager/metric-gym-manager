-- Relabel announcement texts that were logged as 'welcome'.
--
-- A welcome text always starts "Welcome" and names one member, so its exact
-- body is never shared by two members of a gym. An announcement's body is.
-- Either signature marks a row as an announcement; on 2026-10-04 both selected
-- the same 401 of 915 'welcome' rows (50 sent in one gym on 2026-03-01, 351
-- logged in mock mode in an E2E test gym on 2026-09-13), with no disagreement.
--
-- Idempotent: a second run finds nothing left to change, so it can be re-run
-- after deploy to catch announcements sent before the code switched to
-- 'announcement'. On an empty database it is a no-op.

UPDATE sms_logs AS s
SET sms_type = 'announcement'
WHERE s.sms_type = 'welcome'
  AND (
    s.message_body NOT ILIKE 'Welcome%'
    OR EXISTS (
      SELECT 1
      FROM sms_logs AS o
      WHERE o.sms_type = 'welcome'
        AND o.gym_id = s.gym_id
        AND o.message_body = s.message_body
        AND o.member_id <> s.member_id
    )
  );

-- End state: no 'welcome' row still carries an announcement's signature.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM sms_logs
    WHERE sms_type = 'welcome' AND message_body NOT ILIKE 'Welcome%'
  ) THEN
    RAISE EXCEPTION 'relabel incomplete: a welcome row does not start with "Welcome"';
  END IF;
END $$;
