-- Add 'announcement' to the sms_type enum.
--
-- Gym announcements had no sms_type of their own and were logged as 'welcome'
-- (announcement.service hard-coded it). Every announcement text therefore sat
-- in members' SMS history as a welcome message, and every count of welcome
-- texts sent was inflated. 20261004000002 relabels the existing rows.
--
-- The TypeScript owner (SmsConfig.SMS_TYPES) and supabase/expected-enums.json
-- gain the value in the same change, so enum-parity.test.ts and db:audit agree.
--
-- ADD VALUE cannot be used in the transaction that adds it, which is why the
-- relabel is a separate migration.

ALTER TYPE sms_type ADD VALUE IF NOT EXISTS 'announcement';
