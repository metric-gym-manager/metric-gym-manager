-- Per-gym Rules & Terms of Service section
--
-- Each gym gets an editable "Gym Rules" and "Terms of Service" document, shown
-- in the App Workspace (Settings → Rules & Terms). Every gym starts with a
-- pre-generated default so the section is never empty; gyms edit it to taste.
-- The gym-rules document is the page the registration forms' "I agree to the
-- gym's guidelines & rules" checkbox links to.
--
-- Stored as plain text on the gyms row (kept in sync with the TypeScript
-- fallback in src/features/settings/config/defaultGymPolicies.ts, used for the
-- "reset to default" action).

-- Default text lives in a temp function so the column DEFAULT, the backfill and
-- the comment all reference one source within this migration.
CREATE OR REPLACE FUNCTION pg_temp.default_gym_rules() RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
SELECT $rules$# Gym Rules & Guidelines

Welcome! To keep our facility safe and enjoyable for everyone, all members agree to the following:

1. Membership & Access
   - Membership is personal and non-transferable. Do not share your access with others.
   - Please check in at the front desk on every visit.

2. Payments
   - Membership fees are due by the date shown on your account.
   - Access may be paused if payment is overdue.

3. Health & Safety
   - Consult a physician before beginning any exercise program.
   - Use equipment only as intended; ask staff if you are unsure.
   - Report any faulty equipment or injury to staff immediately.

4. Etiquette
   - Wipe down equipment after use and re-rack weights.
   - Wear appropriate athletic clothing and clean footwear.
   - Be respectful of other members and staff at all times.

5. Liability
   - You use the facility and equipment at your own risk.
   - The gym is not responsible for lost or stolen personal belongings.

Management reserves the right to update these rules and to revoke membership for conduct that endangers or disturbs others.$rules$;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.default_gym_terms() RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
SELECT $terms$# Terms of Service

These terms govern your membership with our gym.

1. Membership
   - By registering you agree to abide by the current Gym Rules & Guidelines.
   - Membership grants access to the facilities associated with your plan.

2. Fees & Renewal
   - Applicable membership and any one-time admission/registration fees are payable at registration.
   - Recurring membership fees renew each billing period until cancelled.

3. Cancellation
   - You may cancel your membership at any time; access continues until the end of the paid period.
   - Fees already paid are non-refundable except where required by law.

4. Code of Conduct
   - Behaviour that harms, harasses, or endangers members or staff may result in immediate termination without refund.

5. Assumption of Risk
   - Physical exercise carries inherent risks. You participate voluntarily and assume those risks.

6. Changes
   - We may update these terms; continued use of the facility after an update constitutes acceptance.

For questions about these terms, please contact the front desk.$terms$;
$fn$;

ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS gym_rules TEXT,
  ADD COLUMN IF NOT EXISTS gym_terms TEXT;

-- Set the column DEFAULT for gyms created from now on.
ALTER TABLE gyms ALTER COLUMN gym_rules SET DEFAULT pg_temp.default_gym_rules();
ALTER TABLE gyms ALTER COLUMN gym_terms SET DEFAULT pg_temp.default_gym_terms();

-- Backfill existing gyms that have no document yet.
UPDATE gyms SET gym_rules = pg_temp.default_gym_rules() WHERE gym_rules IS NULL;
UPDATE gyms SET gym_terms = pg_temp.default_gym_terms() WHERE gym_terms IS NULL;

COMMENT ON COLUMN gyms.gym_rules IS 'Editable per-gym rules & guidelines document (markdown). Pre-seeded with a default; linked from the registration consent checkbox.';
COMMENT ON COLUMN gyms.gym_terms IS 'Editable per-gym terms of service document (markdown). Pre-seeded with a default.';
