/* eslint-disable @typescript-eslint/no-var-requires */
exports.shorthands = undefined

exports.up = (pgm) => {
  // RLS Policies for gyms table
  pgm.sql(`
    CREATE POLICY "Gym owners view own gym"
      ON gyms FOR SELECT
      USING (
        id IN (
          SELECT gym_id FROM users WHERE id = current_setting('app.current_user_id')::uuid
        )
      )
  `)

  pgm.sql(`
    CREATE POLICY "Gym owners update own gym"
      ON gyms FOR UPDATE
      USING (
        id IN (
          SELECT gym_id FROM users
          WHERE id = current_setting('app.current_user_id')::uuid
          AND role = 'gym_owner'
        )
      )
  `)

  // RLS Policies for users table
  pgm.sql(`
    CREATE POLICY "Users view same gym"
      ON users FOR SELECT
      USING (
        gym_id IN (
          SELECT gym_id FROM users WHERE id = current_setting('app.current_user_id')::uuid
        )
      )
  `)

  pgm.sql(`
    CREATE POLICY "Admins and owners manage users"
      ON users FOR ALL
      USING (
        gym_id IN (
          SELECT gym_id FROM users
          WHERE id = current_setting('app.current_user_id')::uuid
          AND role IN ('gym_owner', 'admin')
        )
      )
  `)

  // RLS Policies for members table
  pgm.sql(`
    CREATE POLICY "Staff view members in same gym"
      ON members FOR SELECT
      USING (
        gym_id IN (
          SELECT gym_id FROM users WHERE id = current_setting('app.current_user_id')::uuid
        )
      )
  `)

  pgm.sql(`
    CREATE POLICY "Staff manage members in same gym"
      ON members FOR ALL
      USING (
        gym_id IN (
          SELECT gym_id FROM users
          WHERE id = current_setting('app.current_user_id')::uuid
          AND role IN ('gym_owner', 'admin', 'front_desk')
        )
      )
  `)

  // RLS Policies for emergency_contacts table
  pgm.sql(`
    CREATE POLICY "Emergency contacts follow member access"
      ON emergency_contacts FOR ALL
      USING (
        member_id IN (
          SELECT m.id FROM members m
          JOIN users u ON m.gym_id = u.gym_id
          WHERE u.id = current_setting('app.current_user_id')::uuid
        )
      )
  `)

  // RLS Policies for medical_waivers table
  pgm.sql(`
    CREATE POLICY "Medical waivers follow member access"
      ON medical_waivers FOR ALL
      USING (
        member_id IN (
          SELECT m.id FROM members m
          JOIN users u ON m.gym_id = u.gym_id
          WHERE u.id = current_setting('app.current_user_id')::uuid
        )
      )
  `)

  // RLS Policies for membership_plans table
  pgm.sql(`
    CREATE POLICY "Staff view plans in same gym"
      ON membership_plans FOR SELECT
      USING (
        gym_id IN (
          SELECT gym_id FROM users WHERE id = current_setting('app.current_user_id')::uuid
        )
      )
  `)

  pgm.sql(`
    CREATE POLICY "Admins manage plans"
      ON membership_plans FOR ALL
      USING (
        gym_id IN (
          SELECT gym_id FROM users
          WHERE id = current_setting('app.current_user_id')::uuid
          AND role IN ('gym_owner', 'admin')
        )
      )
  `)

  // RLS Policies for member_memberships table
  pgm.sql(`
    CREATE POLICY "Staff view memberships in same gym"
      ON member_memberships FOR SELECT
      USING (
        member_id IN (
          SELECT m.id FROM members m
          JOIN users u ON m.gym_id = u.gym_id
          WHERE u.id = current_setting('app.current_user_id')::uuid
        )
      )
  `)

  pgm.sql(`
    CREATE POLICY "Staff manage memberships"
      ON member_memberships FOR ALL
      USING (
        member_id IN (
          SELECT m.id FROM members m
          JOIN users u ON m.gym_id = u.gym_id
          WHERE u.id = current_setting('app.current_user_id')::uuid
          AND u.role IN ('gym_owner', 'admin', 'front_desk')
        )
      )
  `)

  // RLS Policies for payment_methods table
  pgm.sql(`
    CREATE POLICY "Payment methods follow member access"
      ON payment_methods FOR ALL
      USING (
        member_id IN (
          SELECT m.id FROM members m
          JOIN users u ON m.gym_id = u.gym_id
          WHERE u.id = current_setting('app.current_user_id')::uuid
        )
      )
  `)

  // RLS Policies for payments table
  pgm.sql(`
    CREATE POLICY "Staff view payments in same gym"
      ON payments FOR SELECT
      USING (
        gym_id IN (
          SELECT gym_id FROM users WHERE id = current_setting('app.current_user_id')::uuid
        )
      )
  `)

  pgm.sql(`
    CREATE POLICY "Staff manage payments"
      ON payments FOR ALL
      USING (
        gym_id IN (
          SELECT gym_id FROM users
          WHERE id = current_setting('app.current_user_id')::uuid
          AND role IN ('gym_owner', 'admin', 'front_desk')
        )
      )
  `)

  // RLS Policies for refresh_tokens table
  pgm.sql(`
    CREATE POLICY "Users manage own tokens"
      ON refresh_tokens FOR ALL
      USING (
        user_id = current_setting('app.current_user_id')::uuid
      )
  `)
}

exports.down = (pgm) => {
  // Drop all policies
  pgm.sql('DROP POLICY IF EXISTS "Gym owners view own gym" ON gyms')
  pgm.sql('DROP POLICY IF EXISTS "Gym owners update own gym" ON gyms')
  pgm.sql('DROP POLICY IF EXISTS "Users view same gym" ON users')
  pgm.sql('DROP POLICY IF EXISTS "Admins and owners manage users" ON users')
  pgm.sql('DROP POLICY IF EXISTS "Staff view members in same gym" ON members')
  pgm.sql('DROP POLICY IF EXISTS "Staff manage members in same gym" ON members')
  pgm.sql('DROP POLICY IF EXISTS "Emergency contacts follow member access" ON emergency_contacts')
  pgm.sql('DROP POLICY IF EXISTS "Medical waivers follow member access" ON medical_waivers')
  pgm.sql('DROP POLICY IF EXISTS "Staff view plans in same gym" ON membership_plans')
  pgm.sql('DROP POLICY IF EXISTS "Admins manage plans" ON membership_plans')
  pgm.sql('DROP POLICY IF EXISTS "Staff view memberships in same gym" ON member_memberships')
  pgm.sql('DROP POLICY IF EXISTS "Staff manage memberships" ON member_memberships')
  pgm.sql('DROP POLICY IF EXISTS "Payment methods follow member access" ON payment_methods')
  pgm.sql('DROP POLICY IF EXISTS "Staff view payments in same gym" ON payments')
  pgm.sql('DROP POLICY IF EXISTS "Staff manage payments" ON payments')
  pgm.sql('DROP POLICY IF EXISTS "Users manage own tokens" ON refresh_tokens')
}
