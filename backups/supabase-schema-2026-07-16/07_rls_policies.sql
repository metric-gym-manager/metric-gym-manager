-- Row Level Security: ENABLE statements + all policies (backup 2026-07-16)
-- storage.* tables are Supabase-managed; they have RLS enabled but had NO custom
-- policies at backup time. All application policies live on the public schema.

-- ============ RLS ENABLE ============

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_charge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============

CREATE POLICY "Gym owners can create announcements" ON public.announcements
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((gym_id IN ( SELECT gyms.id
   FROM gyms
  WHERE (gyms.user_id = auth.uid()))));

CREATE POLICY "Gym owners can view own announcements" ON public.announcements
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((gym_id IN ( SELECT gyms.id
   FROM gyms
  WHERE (gyms.user_id = auth.uid()))));

CREATE POLICY "Service role full access checkout_intents" ON public.checkout_intents
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can insert cron logs" ON public.cron_logs
  AS PERMISSIVE
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read all cron logs" ON public.cron_logs
  AS PERMISSIVE
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Gym owners can manage discounts" ON public.discounts
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = discounts.gym_id) AND (gyms.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = discounts.gym_id) AND (gyms.user_id = auth.uid())))));

CREATE POLICY "Gym owners can view own discounts" ON public.discounts
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = discounts.gym_id) AND (gyms.user_id = auth.uid())))));

CREATE POLICY "Allow email confirmation creation" ON public.email_confirmations
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Allow email confirmation updates" ON public.email_confirmations
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Gym owners view own email confirmations" ON public.email_confirmations
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Allow gym creation during registration" ON public.gyms
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Gym owners can update own gym" ON public.gyms
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Gym owners can view own gym" ON public.gyms
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Gym owners can delete own members" ON public.members
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = members.gym_id) AND (gyms.user_id = auth.uid())))));

CREATE POLICY "Gym owners can insert members" ON public.members
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = members.gym_id) AND (gyms.user_id = auth.uid())))));

CREATE POLICY "Gym owners can update own members" ON public.members
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = members.gym_id) AND (gyms.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = members.gym_id) AND (gyms.user_id = auth.uid())))));

CREATE POLICY "Gym owners can view own members" ON public.members
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = members.gym_id) AND (gyms.user_id = auth.uid())))));

CREATE POLICY "Gym owners can delete their gym payments" ON public.payments
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((gym_id IN ( SELECT gyms.id
   FROM gyms
  WHERE (gyms.user_id = auth.uid()))));

CREATE POLICY "Gym owners can insert member payments" ON public.payments
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (members
     JOIN gyms ON ((gyms.id = members.gym_id)))
  WHERE ((members.id = payments.member_id) AND (gyms.user_id = auth.uid())))));

CREATE POLICY "Gym owners can insert their gym payments" ON public.payments
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((gym_id IN ( SELECT gyms.id
   FROM gyms
  WHERE (gyms.user_id = auth.uid()))));

CREATE POLICY "Gym owners can update their gym payments" ON public.payments
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((gym_id IN ( SELECT gyms.id
   FROM gyms
  WHERE (gyms.user_id = auth.uid()))));

CREATE POLICY "Gym owners can view member payments" ON public.payments
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM (members
     JOIN gyms ON ((gyms.id = members.gym_id)))
  WHERE ((members.id = payments.member_id) AND (gyms.user_id = auth.uid())))));

CREATE POLICY "Gym owners can view their gym payments" ON public.payments
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((gym_id IN ( SELECT gyms.id
   FROM gyms
  WHERE (gyms.user_id = auth.uid()))));

CREATE POLICY "Users can insert verifications" ON public.phone_verifications
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update own verifications" ON public.phone_verifications
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((auth.uid() = user_id) OR (user_id IS NULL)));

CREATE POLICY "Users can view own verifications" ON public.phone_verifications
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((auth.uid() = user_id) OR (user_id IS NULL)));

CREATE POLICY "Gym owners can manage plan types" ON public.plan_types
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = plan_types.gym_id) AND (gyms.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = plan_types.gym_id) AND (gyms.user_id = auth.uid())))));

CREATE POLICY "Gym owners can view own plan types" ON public.plan_types
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = plan_types.gym_id) AND (gyms.user_id = auth.uid())))));

CREATE POLICY "Admins can read own admin row" ON public.saas_admins
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((user_id = auth.uid()));

CREATE POLICY "Service role full access saas_admins" ON public.saas_admins
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access saas_charge_attempts" ON public.saas_charge_attempts
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Gym owners can view own saas payment logs" ON public.saas_payment_logs
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = saas_payment_logs.gym_id) AND (gyms.user_id = auth.uid())))));

CREATE POLICY "Service role full access saas_payment_logs" ON public.saas_payment_logs
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow SMS log creation" ON public.sms_logs
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = sms_logs.gym_id) AND (gyms.user_id = auth.uid())))));

CREATE POLICY "Gym owners can view own SMS logs" ON public.sms_logs
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM gyms
  WHERE ((gyms.id = sms_logs.gym_id) AND (gyms.user_id = auth.uid())))));
