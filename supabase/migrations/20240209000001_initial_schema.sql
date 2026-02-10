-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- GYMS TABLE (Tenant Isolation)
-- ==============================================
CREATE TABLE gyms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address JSONB,
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  currency VARCHAR(3) DEFAULT 'USD',
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_gyms_slug ON gyms(slug);

-- ==============================================
-- USERS TABLE (Gym Staff - links to Supabase Auth)
-- ==============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('gym_owner', 'admin', 'trainer', 'front_desk')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(gym_id, email)
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_users_gym_id ON users(gym_id);
CREATE INDEX idx_users_email ON users(email);

-- ==============================================
-- MEMBERS TABLE
-- ==============================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  date_of_birth DATE,
  gender VARCHAR(50),
  address JSONB,
  photo_url TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'frozen', 'expired', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(gym_id, email)
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_members_gym_id ON members(gym_id);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_status ON members(status);

-- ==============================================
-- EMERGENCY CONTACTS TABLE
-- ==============================================
CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_emergency_contacts_member_id ON emergency_contacts(member_id);

-- ==============================================
-- MEDICAL WAIVERS TABLE
-- ==============================================
CREATE TABLE medical_waivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  conditions TEXT,
  medications TEXT,
  allergies TEXT,
  signature_data TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE medical_waivers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_medical_waivers_member_id ON medical_waivers(member_id);

-- ==============================================
-- MEMBERSHIP PLANS TABLE
-- ==============================================
CREATE TABLE membership_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('drop_in', 'class_pack', 'monthly', 'annual', 'custom')),
  price_amount DECIMAL(10, 2) NOT NULL CHECK (price_amount >= 0),
  billing_frequency VARCHAR(50) NOT NULL CHECK (billing_frequency IN ('one_time', 'monthly', 'annual')),
  trial_days INTEGER DEFAULT 0 CHECK (trial_days >= 0),
  access_level VARCHAR(100) DEFAULT 'business_hours',
  class_credits INTEGER CHECK (class_credits > 0),
  contract_length_months INTEGER CHECK (contract_length_months > 0),
  setup_fee DECIMAL(10, 2) DEFAULT 0 CHECK (setup_fee >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_membership_plans_gym_id ON membership_plans(gym_id);
CREATE INDEX idx_membership_plans_plan_type ON membership_plans(plan_type);
CREATE INDEX idx_membership_plans_is_active ON membership_plans(is_active);

-- ==============================================
-- MEMBER MEMBERSHIPS TABLE
-- ==============================================
CREATE TABLE member_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'cancelled', 'expired')),
  start_date DATE NOT NULL,
  end_date DATE,
  next_billing_date DATE,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE member_memberships ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_member_memberships_member_id ON member_memberships(member_id);
CREATE INDEX idx_member_memberships_plan_id ON member_memberships(plan_id);
CREATE INDEX idx_member_memberships_status ON member_memberships(status);

-- ==============================================
-- PAYMENT METHODS TABLE
-- ==============================================
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('credit_card', 'debit_card', 'bank_account', 'cash', 'check')),
  last_four VARCHAR(4),
  brand VARCHAR(50),
  expiry_month INTEGER CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year INTEGER CHECK (expiry_year >= 2024),
  is_default BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_payment_methods_member_id ON payment_methods(member_id);

-- ==============================================
-- PAYMENTS TABLE
-- ==============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  membership_id UUID REFERENCES member_memberships(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  type VARCHAR(50) NOT NULL CHECK (type IN ('membership', 'setup_fee', 'class_pack', 'drop_in', 'other')),
  description TEXT,
  mock_processor_id VARCHAR(255),
  mock_data JSONB DEFAULT '{}',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_payments_gym_id ON payments(gym_id);
CREATE INDEX idx_payments_member_id ON payments(member_id);
CREATE INDEX idx_payments_membership_id ON payments(membership_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_type ON payments(type);
