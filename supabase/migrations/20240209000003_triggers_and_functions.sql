-- ==============================================
-- HELPER FUNCTIONS AND TRIGGERS
-- ==============================================

-- ==============================================
-- AUTO-UPDATE TIMESTAMP FUNCTION
-- ==============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_gyms_updated_at
  BEFORE UPDATE ON gyms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emergency_contacts_updated_at
  BEFORE UPDATE ON emergency_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_waivers_updated_at
  BEFORE UPDATE ON medical_waivers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_membership_plans_updated_at
  BEFORE UPDATE ON membership_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_member_memberships_updated_at
  BEFORE UPDATE ON member_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- AUTO-ACTIVATE MEMBER ON SUCCESSFUL PAYMENT
-- ==============================================
CREATE OR REPLACE FUNCTION update_member_status_from_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- When a membership payment succeeds, activate the member and membership
  IF NEW.status = 'succeeded' AND NEW.type = 'membership' AND OLD.status != 'succeeded' THEN
    -- Update member status to active
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

CREATE TRIGGER payment_status_trigger
  AFTER UPDATE OF status ON payments
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION update_member_status_from_payment();

-- ==============================================
-- ENSURE ONLY ONE PRIMARY EMERGENCY CONTACT
-- ==============================================
CREATE OR REPLACE FUNCTION ensure_single_primary_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Unset other primary contacts for this member
    UPDATE emergency_contacts
    SET is_primary = false
    WHERE member_id = NEW.member_id AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER emergency_contact_primary_trigger
  BEFORE INSERT OR UPDATE OF is_primary ON emergency_contacts
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION ensure_single_primary_contact();

-- ==============================================
-- ENSURE ONLY ONE DEFAULT PAYMENT METHOD
-- ==============================================
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset other default payment methods for this member
    UPDATE payment_methods
    SET is_default = false
    WHERE member_id = NEW.member_id AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_method_default_trigger
  BEFORE INSERT OR UPDATE OF is_default ON payment_methods
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_payment_method();
