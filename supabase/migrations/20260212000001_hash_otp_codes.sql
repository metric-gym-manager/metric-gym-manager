-- Migration: Hash OTP Codes with bcrypt
-- Description: Updates otp_tokens table to support bcrypt-hashed OTP codes (60 chars)
--              and increases OTP expiry to 10 minutes for better UX
-- Author: Production Auth Upgrade
-- Date: 2026-02-12

-- Step 1: Remove old constraint on otp_code length (was for 6-digit plain text)
ALTER TABLE otp_tokens DROP CONSTRAINT IF EXISTS otp_code_length;

-- Step 2: Add new constraint for bcrypt hash length (bcrypt produces 60-character hashes)
ALTER TABLE otp_tokens
ADD CONSTRAINT otp_code_hash_length CHECK (char_length(otp_code) = 60);

-- Step 3: Update column comments for documentation
COMMENT ON COLUMN otp_tokens.expires_at IS 'OTP expiry time (10 minutes from creation for improved UX)';
COMMENT ON COLUMN otp_tokens.otp_code IS 'Six-digit OTP code (bcrypt hashed with 10 salt rounds for security)';

-- Step 4: Clean up expired and old OTP tokens (older than 1 hour)
-- This prevents issues with existing plain-text OTPs during migration
DELETE FROM otp_tokens WHERE created_at < NOW() - INTERVAL '1 hour';

-- Step 5: Add index for better query performance on phone + expiry lookups
CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone_expiry
ON otp_tokens(phone_number, expires_at)
WHERE used = false;

COMMENT ON INDEX idx_otp_tokens_phone_expiry IS 'Optimizes OTP verification queries by phone and expiry status';
