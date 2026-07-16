-- CREATE TABLE statements, public schema (backup 2026-07-16)
-- Constraints, indexes, RLS, grants and comments are in the sibling files.

CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  message text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  session_failures jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE public.checkout_intents (
  order_id text NOT NULL,
  gym_id uuid NOT NULL,
  target_tier text NOT NULL,
  expected_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'LKR'::text,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);

CREATE TABLE public.cron_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  status text NOT NULL,
  summary jsonb,
  errors text[],
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.discounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  discount_name text NOT NULL,
  discount_percentage integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.email_confirmations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  user_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  confirmed_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL,
  ip_address text,
  user_agent text
);

CREATE TABLE public.gyms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  email text NOT NULL,
  email_verified boolean DEFAULT false,
  phone_number text,
  gym_name text NOT NULL,
  gym_address text,
  gym_website text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  profile_image_url text,
  subscription_tier text NOT NULL DEFAULT 'lite'::text,
  subscription_status text NOT NULL DEFAULT 'trialing'::text,
  payhere_customer_id text,
  payhere_subscription_id text,
  current_period_end timestamp with time zone,
  member_count integer NOT NULL DEFAULT 0,
  trial_ends_at timestamp with time zone DEFAULT (now() + '14 days'::interval),
  next_charge_at timestamp with time zone
);

CREATE TABLE public.members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  name text NOT NULL,
  phone_number text NOT NULL,
  plan_amount numeric(10,2) NOT NULL,
  discount_id uuid,
  recurring_discount boolean DEFAULT false,
  status member_status NOT NULL DEFAULT 'active'::member_status,
  registered_date date NOT NULL DEFAULT CURRENT_DATE,
  membership_start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_due_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  plan_type text NOT NULL
);

CREATE TABLE public.otp_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_paid numeric(10,2) NOT NULL,
  discount_applied text,
  discount_percentage integer,
  next_due_date_calculated date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  gym_id uuid NOT NULL
);

CREATE TABLE public.phone_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone_number character varying(20) NOT NULL,
  otp_code character varying(6) NOT NULL,
  user_id uuid,
  verified boolean DEFAULT false,
  attempts integer DEFAULT 0,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  verified_at timestamp with time zone
);

CREATE TABLE public.plan_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  default_amount numeric(10,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  plan_type text NOT NULL
);

CREATE TABLE public.saas_admins (
  user_id uuid NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.saas_charge_attempts (
  order_id text NOT NULL,
  gym_id uuid NOT NULL,
  kind text NOT NULL,
  target_tier text NOT NULL,
  expected_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'LKR'::text,
  status text NOT NULL DEFAULT 'pending'::text,
  payhere_payment_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

CREATE TABLE public.saas_payment_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gym_id uuid,
  order_id text,
  payhere_payment_id text,
  payhere_subscription_id text,
  status_code integer NOT NULL,
  signature_valid boolean NOT NULL,
  message_type text,
  status_message text,
  raw_payload jsonb NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.sms_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  gym_id uuid NOT NULL,
  sms_type sms_type NOT NULL,
  phone_number text NOT NULL,
  message_body text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  delivery_status delivery_status NOT NULL DEFAULT 'sent'::delivery_status,
  text_lk_message_id text,
  error_message text
);
