-- Create table for tracking cron job executions
CREATE TABLE IF NOT EXISTS cron_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Execution details
  cron_job_name TEXT NOT NULL, -- e.g., 'send-reminders', 'update-expired-status'
  executed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  duration_ms INTEGER, -- Execution duration in milliseconds
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),

  -- Results
  total_processed INTEGER DEFAULT 0,
  total_successful INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,

  -- Breakdown (JSON for flexibility)
  breakdown JSONB, -- e.g., {"reminder_7day": 2, "reminder_3day": 5, "due_today": 3}

  -- Recipients (array of member info)
  recipients JSONB, -- e.g., [{"name": "John", "phone": "+94771234567", "type": "due_today", "status": "sent"}]

  -- Error tracking
  errors JSONB, -- Array of error messages

  -- Metadata
  triggered_by TEXT DEFAULT 'cron', -- 'cron' or 'manual'

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX idx_cron_logs_job_name ON cron_execution_logs(cron_job_name);
CREATE INDEX idx_cron_logs_executed_at ON cron_execution_logs(executed_at DESC);
CREATE INDEX idx_cron_logs_status ON cron_execution_logs(status);

COMMENT ON TABLE cron_execution_logs IS 'Logs all cron job executions for monitoring and debugging';
COMMENT ON COLUMN cron_execution_logs.breakdown IS 'JSON breakdown of results by category (e.g., reminder types)';
COMMENT ON COLUMN cron_execution_logs.recipients IS 'Array of recipient details including name, phone, SMS type, and delivery status';
COMMENT ON COLUMN cron_execution_logs.errors IS 'Array of error messages encountered during execution';
