-- Migration: Create Email Confirmations Tracking Table
-- Description: Adds custom email confirmation tracking table for better visibility
--              and auditing of email verification attempts beyond Supabase's defaults
-- Author: Production Auth Upgrade
-- Date: 2026-02-12

-- Step 1: Create email confirmations table
CREATE TABLE IF NOT EXISTS email_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email details
  email TEXT NOT NULL,
  token TEXT NOT NULL, -- SHA-256 hash of confirmation token

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired')),
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL, -- 24 hours from creation

  -- Metadata for security audit
  ip_address TEXT,
  user_agent TEXT,

  -- Constraints
  CONSTRAINT valid_email_conf CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Step 2: Create indexes for performance
CREATE INDEX idx_email_confirmations_gym_id ON email_confirmations(gym_id);
CREATE INDEX idx_email_confirmations_user_id ON email_confirmations(user_id);
CREATE INDEX idx_email_confirmations_token ON email_confirmations(token);
CREATE INDEX idx_email_confirmations_status ON email_confirmations(status);

-- Step 3: Enable Row Level Security
ALTER TABLE email_confirmations ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies
-- Policy 1: Gym owners can view their own email confirmations
CREATE POLICY "Gym owners view own email confirmations"
  ON email_confirmations FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Allow system to insert confirmations (during registration)
CREATE POLICY "Allow email confirmation creation"
  ON email_confirmations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Allow system to update confirmations (when confirmed)
CREATE POLICY "Allow email confirmation updates"
  ON email_confirmations FOR UPDATE
  USING (auth.uid() = user_id);

-- Step 5: Add helpful comments
COMMENT ON TABLE email_confirmations IS 'Tracks email confirmation attempts and status for gym registrations';
COMMENT ON COLUMN email_confirmations.token IS 'SHA-256 hash of the confirmation token sent via email';
COMMENT ON COLUMN email_confirmations.status IS 'pending: awaiting confirmation, confirmed: email verified, expired: token expired';
COMMENT ON COLUMN email_confirmations.expires_at IS 'Token expiry time (24 hours from creation)';
COMMENT ON COLUMN email_confirmations.ip_address IS 'IP address from which the confirmation was requested (for security auditing)';
COMMENT ON COLUMN email_confirmations.user_agent IS 'User agent string from confirmation request (for security auditing)';
