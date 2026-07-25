-- Regenerating (rotating) a gym's public registration token is now an
-- ADMIN-ONLY (SaaS operator) operation, performed exclusively server-side via
-- the service-role client
-- (POST /api/admin/qr-codes/regenerate → rotateRegistrationToken).
--
-- Gym owners may still VIEW their link (SELECT) and have it lazily CREATED on
-- first access (INSERT, via getOrCreateRegistrationLink), but they may no
-- longer UPDATE (rotate) the token themselves. Dropping the gym-owner UPDATE
-- policy removes the gym-side ability to regenerate; the service role bypasses
-- RLS, so the admin regenerate path is unaffected. With no DELETE policy and a
-- UNIQUE(gym_id) constraint, a gym owner also cannot delete-and-recreate or
-- insert a second row to obtain a fresh token.
--
-- Idempotent + replayable: DROP POLICY IF EXISTS is a no-op when the policy is
-- absent (fresh DB) and the table is created by an earlier migration.

DROP POLICY IF EXISTS "Gym owners can update own registration link"
  ON gym_registration_links;
