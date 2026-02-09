/* eslint-disable @typescript-eslint/no-var-requires */
exports.shorthands = undefined

exports.up = (pgm) => {
  // Function to automatically update updated_at timestamp
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  // Apply update trigger to all tables
  const tables = [
    'gyms',
    'users',
    'members',
    'emergency_contacts',
    'medical_waivers',
    'membership_plans',
    'member_memberships',
    'payment_methods',
    'payments',
  ]

  tables.forEach((table) => {
    pgm.sql(`
      CREATE TRIGGER update_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `)
  })

  // Function to validate member membership status based on payment
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_member_status_from_payment()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.status = 'succeeded' AND NEW.type = 'membership' THEN
        -- Update member status to active when payment succeeds
        UPDATE members
        SET status = 'active'
        WHERE id = NEW.member_id AND status = 'pending';

        -- Update membership status to active
        UPDATE member_memberships
        SET status = 'active'
        WHERE id = NEW.membership_id AND status = 'pending';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  pgm.sql(`
    CREATE TRIGGER payment_status_update
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_member_status_from_payment();
  `)
}

exports.down = (pgm) => {
  // Drop payment status trigger
  pgm.sql('DROP TRIGGER IF EXISTS payment_status_update ON payments')
  pgm.sql('DROP FUNCTION IF EXISTS update_member_status_from_payment()')

  // Drop update triggers
  const tables = [
    'gyms',
    'users',
    'members',
    'emergency_contacts',
    'medical_waivers',
    'membership_plans',
    'member_memberships',
    'payment_methods',
    'payments',
  ]

  tables.forEach((table) => {
    pgm.sql(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}`)
  })

  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column()')
}
