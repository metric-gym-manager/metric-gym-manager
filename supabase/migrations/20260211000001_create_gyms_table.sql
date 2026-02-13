-- Create gyms table
-- This table stores gym/business information linked to authenticated users

CREATE TABLE IF NOT EXISTS gyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Authentication fields
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  phone_number TEXT UNIQUE, -- Nullable for OTP login

  -- Business information
  gym_name TEXT NOT NULL,
  gym_address TEXT,
  gym_website TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  CONSTRAINT valid_phone CHECK (phone_number IS NULL OR phone_number ~* '^\+94[0-9]{9}$'),
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 50),
  CONSTRAINT gym_name_not_empty CHECK (char_length(gym_name) > 0)
);

-- Create indexes for frequently queried columns
CREATE INDEX idx_gyms_user_id ON gyms(user_id);
CREATE INDEX idx_gyms_username ON gyms(username);
CREATE INDEX idx_gyms_email ON gyms(email);
CREATE INDEX idx_gyms_phone_number ON gyms(phone_number) WHERE phone_number IS NOT NULL;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for gyms table
CREATE TRIGGER update_gyms_updated_at
  BEFORE UPDATE ON gyms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE gyms IS 'Stores gym/business information for each registered gym owner. Links to auth.users for authentication.';
COMMENT ON COLUMN gyms.user_id IS 'References the authenticated user from Supabase Auth';
COMMENT ON COLUMN gyms.phone_number IS 'Optional phone number in +94 format for OTP login';
COMMENT ON COLUMN gyms.email_verified IS 'Indicates if the email has been verified via Supabase Auth';
