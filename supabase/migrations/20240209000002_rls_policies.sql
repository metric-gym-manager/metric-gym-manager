-- ==============================================
-- ROW LEVEL SECURITY POLICIES
-- ==============================================
-- These policies enforce multi-tenant isolation using Supabase Auth
-- All queries are automatically filtered by gym_id based on the authenticated user

-- ==============================================
-- GYMS TABLE POLICIES
-- ==============================================
CREATE POLICY "Users can view their own gym"
  ON gyms FOR SELECT
  USING (
    id IN (
      SELECT gym_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Gym owners can update their gym"
  ON gyms FOR UPDATE
  USING (
    id IN (
      SELECT gym_id FROM users
      WHERE id = auth.uid() AND role = 'gym_owner'
    )
  );

-- ==============================================
-- USERS TABLE POLICIES
-- ==============================================
CREATE POLICY "Users can view users in same gym"
  ON users FOR SELECT
  USING (
    gym_id IN (
      SELECT gym_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Gym owners and admins can insert users"
  ON users FOR INSERT
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM users
      WHERE id = auth.uid() AND role IN ('gym_owner', 'admin')
    )
  );

CREATE POLICY "Gym owners and admins can update users"
  ON users FOR UPDATE
  USING (
    gym_id IN (
      SELECT gym_id FROM users
      WHERE id = auth.uid() AND role IN ('gym_owner', 'admin')
    )
  );

CREATE POLICY "Gym owners can delete users"
  ON users FOR DELETE
  USING (
    gym_id IN (
      SELECT gym_id FROM users
      WHERE id = auth.uid() AND role = 'gym_owner'
    )
  );

-- ==============================================
-- MEMBERS TABLE POLICIES
-- ==============================================
CREATE POLICY "Staff can view members in same gym"
  ON members FOR SELECT
  USING (
    gym_id IN (
      SELECT gym_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert members"
  ON members FOR INSERT
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM users
      WHERE id = auth.uid() AND role IN ('gym_owner', 'admin', 'front_desk')
    )
  );

CREATE POLICY "Staff can update members"
  ON members FOR UPDATE
  USING (
    gym_id IN (
      SELECT gym_id FROM users
      WHERE id = auth.uid() AND role IN ('gym_owner', 'admin', 'front_desk')
    )
  );

CREATE POLICY "Gym owners and admins can delete members"
  ON members FOR DELETE
  USING (
    gym_id IN (
      SELECT gym_id FROM users
      WHERE id = auth.uid() AND role IN ('gym_owner', 'admin')
    )
  );

-- ==============================================
-- EMERGENCY CONTACTS POLICIES
-- ==============================================
CREATE POLICY "Staff can view emergency contacts"
  ON emergency_contacts FOR SELECT
  USING (
    member_id IN (
      SELECT m.id FROM members m
      INNER JOIN users u ON u.gym_id = m.gym_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage emergency contacts"
  ON emergency_contacts FOR ALL
  USING (
    member_id IN (
      SELECT m.id FROM members m
      INNER JOIN users u ON u.gym_id = m.gym_id
      WHERE u.id = auth.uid() AND u.role IN ('gym_owner', 'admin', 'front_desk')
    )
  );

-- ==============================================
-- MEDICAL WAIVERS POLICIES
-- ==============================================
CREATE POLICY "Staff can view medical waivers"
  ON medical_waivers FOR SELECT
  USING (
    member_id IN (
      SELECT m.id FROM members m
      INNER JOIN users u ON u.gym_id = m.gym_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Staff can create medical waivers"
  ON medical_waivers FOR INSERT
  WITH CHECK (
    member_id IN (
      SELECT m.id FROM members m
      INNER JOIN users u ON u.gym_id = m.gym_id
      WHERE u.id = auth.uid() AND u.role IN ('gym_owner', 'admin', 'front_desk')
    )
  );

-- ==============================================
-- MEMBERSHIP PLANS POLICIES
-- ==============================================
CREATE POLICY "Staff can view membership plans"
  ON membership_plans FOR SELECT
  USING (
    gym_id IN (
      SELECT gym_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Gym owners and admins can manage plans"
  ON membership_plans FOR ALL
  USING (
    gym_id IN (
      SELECT gym_id FROM users
      WHERE id = auth.uid() AND role IN ('gym_owner', 'admin')
    )
  );

-- ==============================================
-- MEMBER MEMBERSHIPS POLICIES
-- ==============================================
CREATE POLICY "Staff can view member memberships"
  ON member_memberships FOR SELECT
  USING (
    member_id IN (
      SELECT m.id FROM members m
      INNER JOIN users u ON u.gym_id = m.gym_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage member memberships"
  ON member_memberships FOR ALL
  USING (
    member_id IN (
      SELECT m.id FROM members m
      INNER JOIN users u ON u.gym_id = m.gym_id
      WHERE u.id = auth.uid() AND u.role IN ('gym_owner', 'admin', 'front_desk')
    )
  );

-- ==============================================
-- PAYMENT METHODS POLICIES
-- ==============================================
CREATE POLICY "Staff can view payment methods"
  ON payment_methods FOR SELECT
  USING (
    member_id IN (
      SELECT m.id FROM members m
      INNER JOIN users u ON u.gym_id = m.gym_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage payment methods"
  ON payment_methods FOR ALL
  USING (
    member_id IN (
      SELECT m.id FROM members m
      INNER JOIN users u ON u.gym_id = m.gym_id
      WHERE u.id = auth.uid() AND u.role IN ('gym_owner', 'admin', 'front_desk')
    )
  );

-- ==============================================
-- PAYMENTS POLICIES
-- ==============================================
CREATE POLICY "Staff can view payments in same gym"
  ON payments FOR SELECT
  USING (
    gym_id IN (
      SELECT gym_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Staff can create payments"
  ON payments FOR INSERT
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM users
      WHERE id = auth.uid() AND role IN ('gym_owner', 'admin', 'front_desk')
    )
  );

CREATE POLICY "Staff can update payments"
  ON payments FOR UPDATE
  USING (
    gym_id IN (
      SELECT gym_id FROM users
      WHERE id = auth.uid() AND role IN ('gym_owner', 'admin', 'front_desk')
    )
  );
