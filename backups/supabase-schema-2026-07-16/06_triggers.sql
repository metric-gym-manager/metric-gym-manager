-- Triggers, public schema (backup 2026-07-16). Trigger functions are in 05_functions.sql.

CREATE TRIGGER update_discounts_updated_at BEFORE UPDATE ON public.discounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_prevent_subscription_self_update BEFORE UPDATE ON public.gyms FOR EACH ROW EXECUTE FUNCTION prevent_subscription_self_update();
CREATE TRIGGER update_gyms_updated_at BEFORE UPDATE ON public.gyms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_enforce_active_member_quota BEFORE INSERT OR UPDATE OF status ON public.members FOR EACH ROW EXECUTE FUNCTION enforce_active_member_quota();
CREATE TRIGGER trg_sync_gym_member_count AFTER INSERT OR DELETE OR UPDATE OF status ON public.members FOR EACH ROW EXECUTE FUNCTION sync_gym_member_count();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_plan_types_updated_at BEFORE UPDATE ON public.plan_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
