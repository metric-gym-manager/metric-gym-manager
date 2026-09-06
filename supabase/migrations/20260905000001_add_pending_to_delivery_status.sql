-- Add 'pending' to the delivery_status enum.
--
-- The TypeScript `SMSDeliveryStatus` enum (features/sms/services/ISMSRepository.ts)
-- has declared `Pending = 'pending'` since it was written, while the database enum
-- only had sent | delivered | failed. Any write of that value would have failed with
-- a constraint error at runtime. This is the third instance of the same drift in
-- this table's history -- see 20260309000001 (welcome) and 20260802000001
-- (reactivation), both of which were written after the insert failed in production.
--
-- 'pending' is needed for real now: the text.lk delivery webhook reports a PENDING
-- state for a message the vendor has accepted but not yet handed to the carrier.
-- That was previously collapsed onto 'sent', which conflated "queued at the vendor"
-- with "dispatched to the handset" and made the two indistinguishable in the
-- member SMS history.
--
-- Ordering note: the enum values are not sorted, so 'pending' is appended rather
-- than placed before 'sent'. Nothing orders by this column's enum position;
-- sms_logs is ordered by sent_at.

ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'pending';
