-- ==============================================
-- CLEANUP MIGRATION
-- ==============================================
-- Remove columns that are now handled by Supabase Auth
-- This migration completes the transition from custom JWT auth to Supabase Auth

-- ==============================================
-- USERS TABLE CLEANUP
-- ==============================================
-- The users table no longer needs password_hash column
-- Passwords are now stored securely in auth.users by Supabase Auth
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='users' AND column_name='password_hash'
  ) THEN
    ALTER TABLE users DROP COLUMN password_hash;
  END IF;
END $$;

-- ==============================================
-- REFRESH TOKENS TABLE CLEANUP
-- ==============================================
-- Drop refresh_tokens table if it exists
-- Supabase Auth handles session management via its own tables
DROP TABLE IF EXISTS refresh_tokens;

-- ==============================================
-- INDEXES CLEANUP
-- ==============================================
-- Remove any indexes that were specifically for the old auth system
-- (None to remove - all indexes are still needed for Supabase)

-- Migration complete
-- The system is now fully migrated to Supabase Auth
