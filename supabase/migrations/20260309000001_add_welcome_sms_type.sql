-- Add 'welcome' value to sms_type enum
-- The TypeScript SMSType includes 'welcome' but the DB enum was missing it,
-- causing welcome SMS log inserts to fail with a constraint error on every
-- new member registration.

ALTER TYPE sms_type ADD VALUE IF NOT EXISTS 'welcome';
