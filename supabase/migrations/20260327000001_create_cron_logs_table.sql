-- Migration: Create cron_logs table for cron job execution tracking
-- Date: 2026-03-27
--
-- This migration:
-- 1. Creates cron_logs table to persist cron job execution results
-- 2. Enables tracking of job start/completion times, status, and errors
-- 3. Provides audit trail for debugging cron job failures

-- ============================================================
-- PART 1: CREATE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  summary JSONB,
  errors TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('running', 'success', 'failure'))
);

-- Create indexes for frequent queries
CREATE INDEX idx_cron_logs_job_name ON cron_logs(job_name);
CREATE INDEX idx_cron_logs_started_at ON cron_logs(started_at DESC);
CREATE INDEX idx_cron_logs_status ON cron_logs(status);
CREATE INDEX idx_cron_logs_job_started ON cron_logs(job_name, started_at DESC);

-- Add comments for documentation
COMMENT ON TABLE cron_logs IS 'Audit log for cron job executions';
COMMENT ON COLUMN cron_logs.job_name IS 'Name of the cron job (e.g., send-reminders, update-expired-status)';
COMMENT ON COLUMN cron_logs.started_at IS 'Timestamp when the cron job started execution';
COMMENT ON COLUMN cron_logs.completed_at IS 'Timestamp when the cron job completed (NULL if still running or crashed)';
COMMENT ON COLUMN cron_logs.status IS 'Job status: running, success, or failure';
COMMENT ON COLUMN cron_logs.summary IS 'JSON summary of job execution (e.g., {totalUpdated: 5, totalSent: 10})';
COMMENT ON COLUMN cron_logs.errors IS 'Array of error messages encountered during execution';

-- ============================================================
-- PART 2: ENABLE RLS (OPTIONAL)
-- ============================================================

-- Note: This table stores admin-level cron job logs
-- RLS is enabled for consistency, but policies may be restricted to admins only

ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow admin service role to insert logs (used by cron jobs)
CREATE POLICY "Service role can insert cron logs"
  ON cron_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Allow admin service role to read all logs
CREATE POLICY "Service role can read all cron logs"
  ON cron_logs
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Gym owners can view logs (optional - for debugging UI)
-- Uncomment if you want to expose cron logs in admin dashboard
-- CREATE POLICY "Gym owners can view cron logs"
--   ON cron_logs
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM gym_profiles
--       WHERE gym_profiles.id = auth.uid()
--     )
--   );
