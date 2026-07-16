-- Enum types, public schema (backup 2026-07-16)
-- NOTE: member_status still contains 'frozen' in the live DB (removed from app code 2026-03-26).

CREATE TYPE public.delivery_status AS ENUM ('sent', 'delivered', 'failed');
CREATE TYPE public.member_plan_type AS ENUM ('monthly', 'daily', 'annual', 'weekly', '3-months', '6-months', 'custom');
CREATE TYPE public.member_status AS ENUM ('active', 'expired', 'suspended', 'cancelled', 'frozen');
CREATE TYPE public.sms_type AS ENUM ('reminder_7day', 'reminder_3day', 'due_today', 'overdue', 'receipt', 'welcome');
