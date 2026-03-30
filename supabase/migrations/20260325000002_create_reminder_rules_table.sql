-- Migration: Create reminder_rules table and seed with configuration data
-- Date: 2026-03-25
--
-- This migration:
-- 1. Creates reminder_rules table to store when reminders should be sent for each plan type
-- 2. Seeds the table with current configuration from REMINDER_RULES constant

-- ============================================================
-- PART 1: CREATE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS reminder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type member_plan_type NOT NULL,
  days_before_due INT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Ensure unique combinations of plan_type and days_before_due
  CONSTRAINT unique_plan_reminder UNIQUE (plan_type, days_before_due)
);

-- Create indexes for frequent queries
CREATE INDEX idx_reminder_rules_plan_type ON reminder_rules(plan_type);
CREATE INDEX idx_reminder_rules_enabled ON reminder_rules(enabled);
CREATE INDEX idx_reminder_rules_days ON reminder_rules(days_before_due);

-- Create trigger for updated_at
CREATE TRIGGER update_reminder_rules_updated_at
  BEFORE UPDATE ON reminder_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE reminder_rules IS 'Configuration for automated payment reminders by plan type';
COMMENT ON COLUMN reminder_rules.plan_type IS 'Type of membership plan';
COMMENT ON COLUMN reminder_rules.days_before_due IS 'Days before due date to send reminder (positive = before, 0 = today, negative = overdue)';
COMMENT ON COLUMN reminder_rules.enabled IS 'Whether this reminder is enabled for this plan type';

-- ============================================================
-- PART 2: SEED DATA FROM REMINDER_RULES CONSTANT
-- ============================================================

-- Daily: No reminders enabled
INSERT INTO reminder_rules (plan_type, days_before_due, enabled) VALUES
  ('daily', 7, FALSE),
  ('daily', 3, FALSE),
  ('daily', 0, FALSE);

-- Weekly: All reminders enabled (7-day, 3-day, due-today, overdue)
INSERT INTO reminder_rules (plan_type, days_before_due, enabled) VALUES
  ('weekly', 7, TRUE),
  ('weekly', 3, TRUE),
  ('weekly', 0, TRUE),
  ('weekly', -1, TRUE); -- Overdue marker (any negative value)

-- Monthly: Skip 7-day reminder (only 3-day, due-today, overdue)
INSERT INTO reminder_rules (plan_type, days_before_due, enabled) VALUES
  ('monthly', 7, FALSE), -- Explicitly disabled for monthly
  ('monthly', 3, TRUE),
  ('monthly', 0, TRUE),
  ('monthly', -1, TRUE); -- Overdue marker

-- 3-Months: All reminders enabled
INSERT INTO reminder_rules (plan_type, days_before_due, enabled) VALUES
  ('3-months', 7, TRUE),
  ('3-months', 3, TRUE),
  ('3-months', 0, TRUE),
  ('3-months', -1, TRUE); -- Overdue marker

-- 6-Months: All reminders enabled
INSERT INTO reminder_rules (plan_type, days_before_due, enabled) VALUES
  ('6-months', 7, TRUE),
  ('6-months', 3, TRUE),
  ('6-months', 0, TRUE),
  ('6-months', -1, TRUE); -- Overdue marker

-- Annual: All reminders enabled
INSERT INTO reminder_rules (plan_type, days_before_due, enabled) VALUES
  ('annual', 7, TRUE),
  ('annual', 3, TRUE),
  ('annual', 0, TRUE),
  ('annual', -1, TRUE); -- Overdue marker

-- Custom: All reminders enabled
INSERT INTO reminder_rules (plan_type, days_before_due, enabled) VALUES
  ('custom', 7, TRUE),
  ('custom', 3, TRUE),
  ('custom', 0, TRUE),
  ('custom', -1, TRUE); -- Overdue marker

-- ============================================================
-- PART 3: ENABLE RLS (if needed for multi-tenant isolation)
-- ============================================================

-- Note: This table is configuration data, not user data
-- It may not need RLS if it's shared across all gyms
-- However, if different gyms should have different reminder rules,
-- add gym_id column and enable RLS

-- For now, we assume reminder rules are global across all gyms
-- If gym-specific rules are needed, add:
-- ALTER TABLE reminder_rules ADD COLUMN gym_id UUID REFERENCES gyms(id);
