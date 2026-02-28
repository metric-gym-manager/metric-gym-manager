-- Remove emergency contact fields from members table
-- These fields are no longer needed in the application

-- Drop constraints related to emergency contact fields
ALTER TABLE members
  DROP CONSTRAINT IF EXISTS emergency_contact_complete,
  DROP CONSTRAINT IF EXISTS valid_emergency_phone;

-- Drop emergency contact columns
ALTER TABLE members
  DROP COLUMN IF EXISTS emergency_contact_name,
  DROP COLUMN IF EXISTS emergency_contact_phone;

-- Add comment for documentation
COMMENT ON TABLE members IS 'Stores gym members/customers with their membership details (emergency contact fields removed 2026-02-27)';
