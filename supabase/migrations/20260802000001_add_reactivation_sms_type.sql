-- Add 'reactivation' value to the sms_type enum.
-- Sent when a cancelled or suspended member is brought back to active status
-- through the reactivation payment flow. The TypeScript SMSType already
-- includes 'reactivation'; without this enum value the sms_logs insert for a
-- reactivation SMS would fail with a constraint error.

ALTER TYPE sms_type ADD VALUE IF NOT EXISTS 'reactivation';
