-- Migration: Add error_message column to sms_logs table
-- Date: 2026-03-28
--
-- This migration:
-- 1. Adds error_message column to sms_logs table for tracking SMS delivery failures
-- 2. Enables detailed error logging for debugging SMS provider issues

-- ============================================================
-- ADD ERROR_MESSAGE COLUMN
-- ============================================================

ALTER TABLE sms_logs
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add comment for documentation
COMMENT ON COLUMN sms_logs.error_message IS 'Error message from SMS provider if delivery failed (NULL for successful deliveries)';
