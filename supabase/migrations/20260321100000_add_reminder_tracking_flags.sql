-- Add boolean flags to members table for tracking automatic reminder status
-- This provides O(1) lookup performance compared to querying sms_logs (Option B)

ALTER TABLE members
ADD COLUMN IF NOT EXISTS reminder_7day_sent_this_period BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_3day_sent_this_period BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS due_today_sent_this_period BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS overdue_sent_this_period BOOLEAN DEFAULT FALSE;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_members_reminder_flags
ON members (reminder_7day_sent_this_period, reminder_3day_sent_this_period, due_today_sent_this_period);

-- Comment for documentation
COMMENT ON COLUMN members.reminder_7day_sent_this_period IS 'Flag indicating if 7-day reminder was sent in current billing period';
COMMENT ON COLUMN members.reminder_3day_sent_this_period IS 'Flag indicating if 3-day reminder was sent in current billing period';
COMMENT ON COLUMN members.due_today_sent_this_period IS 'Flag indicating if due-today reminder was sent in current billing period';
COMMENT ON COLUMN members.overdue_sent_this_period IS 'Flag indicating if overdue reminder was sent in current billing period';
