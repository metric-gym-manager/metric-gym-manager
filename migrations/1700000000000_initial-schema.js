/* eslint-disable @typescript-eslint/no-var-requires */
exports.shorthands = undefined

exports.up = (pgm) => {
  // Enable UUID extension
  pgm.createExtension('uuid-ossp', { ifNotExists: true })

  // Gyms table (tenant isolation)
  pgm.createTable('gyms', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    name: { type: 'varchar(255)', notNull: true },
    slug: { type: 'varchar(100)', unique: true, notNull: true },
    email: { type: 'varchar(255)', notNull: true },
    phone: { type: 'varchar(50)' },
    address: { type: 'jsonb' },
    timezone: { type: 'varchar(50)', default: "'America/New_York'" },
    currency: { type: 'varchar(3)', default: "'USD'" },
    settings: { type: 'jsonb', default: "'{}'" },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  })

  pgm.sql('ALTER TABLE gyms ENABLE ROW LEVEL SECURITY')

  // Users table (gym staff - owners, admins, trainers, front desk)
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    gym_id: {
      type: 'uuid',
      notNull: true,
      references: '"gyms"',
      onDelete: 'CASCADE',
    },
    email: { type: 'varchar(255)', notNull: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    first_name: { type: 'varchar(100)', notNull: true },
    last_name: { type: 'varchar(100)', notNull: true },
    role: {
      type: 'varchar(50)',
      notNull: true,
      check: "role IN ('gym_owner', 'admin', 'trainer', 'front_desk')",
    },
    is_active: { type: 'boolean', default: true },
    last_login_at: { type: 'timestamp with time zone' },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  })

  pgm.addConstraint('users', 'users_gym_id_email_unique', {
    unique: ['gym_id', 'email'],
  })
  pgm.createIndex('users', 'gym_id')
  pgm.createIndex('users', 'email')
  pgm.sql('ALTER TABLE users ENABLE ROW LEVEL SECURITY')

  // Refresh tokens table
  pgm.createTable('refresh_tokens', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    token_hash: { type: 'varchar(255)', notNull: true },
    expires_at: { type: 'timestamp with time zone', notNull: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    revoked_at: { type: 'timestamp with time zone' },
  })

  pgm.createIndex('refresh_tokens', 'user_id')
  pgm.createIndex('refresh_tokens', 'token_hash')
  pgm.sql('ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY')

  // Members table (gym members)
  pgm.createTable('members', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    gym_id: {
      type: 'uuid',
      notNull: true,
      references: '"gyms"',
      onDelete: 'CASCADE',
    },
    email: { type: 'varchar(255)', notNull: true },
    first_name: { type: 'varchar(100)', notNull: true },
    last_name: { type: 'varchar(100)', notNull: true },
    phone: { type: 'varchar(50)' },
    date_of_birth: { type: 'date' },
    gender: { type: 'varchar(20)' },
    address: { type: 'jsonb' },
    photo_url: { type: 'varchar(500)' },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: "'pending'",
      check: "status IN ('active', 'pending', 'frozen', 'expired', 'cancelled')",
    },
    notes: { type: 'text' },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  })

  pgm.addConstraint('members', 'members_gym_id_email_unique', {
    unique: ['gym_id', 'email'],
  })
  pgm.createIndex('members', 'gym_id')
  pgm.createIndex('members', 'status')
  pgm.createIndex('members', 'email')
  pgm.sql('ALTER TABLE members ENABLE ROW LEVEL SECURITY')

  // Emergency contacts table
  pgm.createTable('emergency_contacts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    member_id: {
      type: 'uuid',
      notNull: true,
      references: '"members"',
      onDelete: 'CASCADE',
    },
    name: { type: 'varchar(255)', notNull: true },
    relationship: { type: 'varchar(100)', notNull: true },
    phone: { type: 'varchar(50)', notNull: true },
    email: { type: 'varchar(255)' },
    is_primary: { type: 'boolean', default: false },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  })

  pgm.createIndex('emergency_contacts', 'member_id')
  pgm.sql('ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY')

  // Medical waivers table
  pgm.createTable('medical_waivers', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    member_id: {
      type: 'uuid',
      notNull: true,
      references: '"members"',
      onDelete: 'CASCADE',
    },
    conditions: { type: 'text' },
    medications: { type: 'text' },
    allergies: { type: 'text' },
    signed_at: { type: 'timestamp with time zone', notNull: true },
    signature_data: { type: 'text' },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  })

  pgm.createIndex('medical_waivers', 'member_id')
  pgm.sql('ALTER TABLE medical_waivers ENABLE ROW LEVEL SECURITY')

  // Membership plans table
  pgm.createTable('membership_plans', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    gym_id: {
      type: 'uuid',
      notNull: true,
      references: '"gyms"',
      onDelete: 'CASCADE',
    },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    plan_type: {
      type: 'varchar(50)',
      notNull: true,
      check: "plan_type IN ('drop_in', 'class_pack', 'monthly', 'annual', 'custom')",
    },
    price_amount: { type: 'decimal(10, 2)', notNull: true },
    billing_frequency: {
      type: 'varchar(50)',
      notNull: true,
      check: "billing_frequency IN ('one_time', 'monthly', 'annual')",
    },
    trial_days: { type: 'integer', default: 0 },
    access_level: { type: 'varchar(50)', default: "'business_hours'" },
    class_credits: { type: 'integer' },
    contract_length_months: { type: 'integer' },
    setup_fee: { type: 'decimal(10, 2)', default: 0 },
    is_active: { type: 'boolean', default: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  })

  pgm.createIndex('membership_plans', 'gym_id')
  pgm.createIndex('membership_plans', 'plan_type')
  pgm.sql('ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY')

  // Member memberships (assignment of plans to members)
  pgm.createTable('member_memberships', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    member_id: {
      type: 'uuid',
      notNull: true,
      references: '"members"',
      onDelete: 'CASCADE',
    },
    plan_id: {
      type: 'uuid',
      notNull: true,
      references: '"membership_plans"',
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: "'active'",
      check: "status IN ('active', 'pending', 'cancelled', 'expired')",
    },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date' },
    next_billing_date: { type: 'date' },
    auto_renew: { type: 'boolean', default: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  })

  pgm.createIndex('member_memberships', 'member_id')
  pgm.createIndex('member_memberships', 'plan_id')
  pgm.createIndex('member_memberships', 'status')
  pgm.sql('ALTER TABLE member_memberships ENABLE ROW LEVEL SECURITY')

  // Payment methods table
  pgm.createTable('payment_methods', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    member_id: {
      type: 'uuid',
      notNull: true,
      references: '"members"',
      onDelete: 'CASCADE',
    },
    type: {
      type: 'varchar(50)',
      notNull: true,
      check: "type IN ('credit_card', 'debit_card', 'bank_account', 'cash', 'check')",
    },
    last_four: { type: 'varchar(4)' },
    brand: { type: 'varchar(50)' },
    expiry_month: { type: 'integer' },
    expiry_year: { type: 'integer' },
    is_default: { type: 'boolean', default: false },
    metadata: { type: 'jsonb', default: "'{}'" },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  })

  pgm.createIndex('payment_methods', 'member_id')
  pgm.sql('ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY')

  // Payments table (mock payment records)
  pgm.createTable('payments', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    gym_id: {
      type: 'uuid',
      notNull: true,
      references: '"gyms"',
      onDelete: 'CASCADE',
    },
    member_id: {
      type: 'uuid',
      notNull: true,
      references: '"members"',
      onDelete: 'CASCADE',
    },
    membership_id: {
      type: 'uuid',
      references: '"member_memberships"',
    },
    payment_method_id: {
      type: 'uuid',
      references: '"payment_methods"',
    },
    amount: { type: 'decimal(10, 2)', notNull: true },
    currency: { type: 'varchar(3)', default: "'USD'" },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: "'pending'",
      check: "status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')",
    },
    type: {
      type: 'varchar(50)',
      notNull: true,
      check: "type IN ('membership', 'setup_fee', 'class_pack', 'drop_in', 'other')",
    },
    description: { type: 'text' },
    mock_processor_id: { type: 'varchar(100)' },
    mock_data: { type: 'jsonb', default: "'{}'" },
    processed_at: { type: 'timestamp with time zone' },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  })

  pgm.createIndex('payments', 'gym_id')
  pgm.createIndex('payments', 'member_id')
  pgm.createIndex('payments', 'status')
  pgm.createIndex('payments', 'created_at')
  pgm.sql('ALTER TABLE payments ENABLE ROW LEVEL SECURITY')
}

exports.down = (pgm) => {
  pgm.dropTable('payments')
  pgm.dropTable('payment_methods')
  pgm.dropTable('member_memberships')
  pgm.dropTable('membership_plans')
  pgm.dropTable('medical_waivers')
  pgm.dropTable('emergency_contacts')
  pgm.dropTable('members')
  pgm.dropTable('refresh_tokens')
  pgm.dropTable('users')
  pgm.dropTable('gyms')
  pgm.dropExtension('uuid-ossp')
}
