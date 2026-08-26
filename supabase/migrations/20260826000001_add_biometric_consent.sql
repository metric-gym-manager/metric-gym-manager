-- Biometric consent — the gate on fingerprint enrolment
--
-- Fingerprint templates are sensitive personal data. We trigger their
-- collection from our own UI (the enrolment dialog puts a reader into
-- enrolment mode for one named member), so a consent record has to exist
-- before that command is ever dispatched.
--
-- ## Why this sits on `members` and not on `member_access_subjects`
--
-- It is a fact about the person, not about the hardware. `member_access_subjects`
-- is our mapping to a reader and is legitimately deleted and recreated —
-- capacity eviction empties it, a returning member gets it back. Consent must
-- not evaporate because a template was evicted, and must not be silently
-- inherited by re-provisioning either. It belongs next to the two consents
-- already captured at registration.
--
-- ## Why it is NOT captured at registration
--
-- The other two consents (`accepted_terms_at`, `accepted_gym_rules_at`) cover
-- processing that begins the moment someone signs up, at every gym. This one
-- covers a specific operation that happens at enrolment — possibly months
-- later, only at Enterprise gyms that own a reader, and never at all for most
-- members. Collecting it on the registration form would be consent to a
-- purpose that does not exist yet for almost everyone who ticked it, and it
-- would still be NULL for every member registered before this migration —
-- exactly the members a gym would enrol first. So `register_member_guarded`
-- is deliberately left untouched: nothing writes this column at registration.
--
-- The value is written at the moment of collection and cleared when the
-- fingerprint is removed, which is how a withdrawal is recorded (the privacy
-- policy's "right to withdraw consent"). A cleared value means the next
-- enrolment has to ask again.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS biometric_consent_at TIMESTAMPTZ;

COMMENT ON COLUMN members.biometric_consent_at IS
  'When the member consented to their fingerprint being recorded for door access. Captured at the enrolment dialog (the moment of collection), NOT at registration. Cleared when the fingerprint is removed — that is the consent withdrawal record.';

-- The enrolment gate reads this per member, always alongside the member row
-- itself, so no index is warranted: the lookup is already by primary key.
