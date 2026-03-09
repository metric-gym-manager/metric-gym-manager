-- Allow backdated memberships by removing registered_date constraint
-- This allows membership_start_date to be before registered_date
-- which is necessary when registering members with historical start dates

-- Drop the constraint that requires membership_start_date >= registered_date
ALTER TABLE members DROP CONSTRAINT IF EXISTS valid_dates;

-- Add comment explaining the change
COMMENT ON COLUMN members.registered_date IS 'Date when the member record was created in the system (for backdated members, this may be after membership_start_date)';
COMMENT ON COLUMN members.membership_start_date IS 'Actual date when the membership started (can be backdated)';
