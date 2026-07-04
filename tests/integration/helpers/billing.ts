/**
 * Shared helpers for billing integration tests.
 *
 * These tests require a DISPOSABLE Supabase project/stack with the
 * migrations applied (never production). They are gated on:
 *   INTEGRATION_TESTS=1
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * and skip loudly otherwise.
 */

import { createHash } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const INTEGRATION_ENABLED = Boolean(
  process.env.INTEGRATION_TESTS === '1' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

if (!INTEGRATION_ENABLED) {
  console.warn(
    '⚠ Billing integration tests SKIPPED — set INTEGRATION_TESTS=1 plus ' +
      'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY against a disposable database.'
  );
}

/** describe gate: use `gatedDescribe(...)` instead of `describe(...)`. */
export const gatedDescribe = INTEGRATION_ENABLED ? describe : describe.skip;

export const TEST_MERCHANT_ID = '1211149';
export const TEST_MERCHANT_SECRET = 'INTEGRATION_TEST_SECRET';

/** Set the PayHere env the lazy config reads (call before importing routes). */
export function setPayhereTestEnv(): void {
  process.env.PAYHERE_MODE = 'sandbox';
  process.env.PAYHERE_MERCHANT_ID = TEST_MERCHANT_ID;
  process.env.PAYHERE_MERCHANT_SECRET = TEST_MERCHANT_SECRET;
  process.env.PAYHERE_PRO_PRICE_LKR = process.env.PAYHERE_PRO_PRICE_LKR ?? '4900';
  process.env.PAYHERE_APP_ID = 'integration-app-id';
  process.env.PAYHERE_APP_SECRET = 'integration-app-secret';
  process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export function adminClient(): SupabaseClient {
  if (!INTEGRATION_ENABLED) {
    // describe() bodies execute even under describe.skip — return a stub that
    // is never used because every test in the gated suites is skipped.
    return null as unknown as SupabaseClient;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const md5Upper = (s: string): string =>
  createHash('md5').update(s, 'utf8').digest('hex').toUpperCase();

/** Build a correctly-signed PayHere notification body (form fields). */
export function signedNotification(fields: {
  order_id: string;
  payment_id: string;
  payhere_amount: string;
  status_code: string;
  subscription_id?: string;
  custom_1?: string;
  message_type?: string;
  status_message?: string;
  item_rec_status?: string;
}): Record<string, string> {
  const base: Record<string, string> = {
    merchant_id: TEST_MERCHANT_ID,
    payhere_currency: 'LKR',
    ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Record<
      string,
      string
    >,
  };
  base.md5sig = md5Upper(
    base.merchant_id +
      base.order_id +
      base.payhere_amount +
      base.payhere_currency +
      base.status_code +
      md5Upper(TEST_MERCHANT_SECRET)
  );
  return base;
}

export interface TestGym {
  gymId: string;
  userId: string;
}

let gymCounter = 0;

/** Create an auth user + gym row; returns ids for cleanup. */
export async function createTestGym(
  supabase: SupabaseClient,
  overrides: Record<string, unknown> = {}
): Promise<TestGym> {
  const suffix = `${Date.now()}-${gymCounter++}`;
  const email = `billing-it-${suffix}@example.com`;

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password: 'integration-test-password-123',
    email_confirm: true,
  });
  if (userError || !userData.user) {
    throw new Error(`Failed to create test user: ${userError?.message}`);
  }

  const { data: gym, error: gymError } = await supabase
    .from('gyms')
    .insert({
      user_id: userData.user.id,
      username: `billing-it-${suffix}`,
      email,
      gym_name: `Billing IT Gym ${suffix}`,
      ...overrides,
    })
    .select('id')
    .single();
  if (gymError || !gym) {
    throw new Error(`Failed to create test gym: ${gymError?.message}`);
  }

  return { gymId: gym.id, userId: userData.user.id };
}

export async function deleteTestGym(supabase: SupabaseClient, gym: TestGym): Promise<void> {
  // gyms cascade-deletes members/intents; payment logs keep NULL gym_id
  await supabase.from('gyms').delete().eq('id', gym.gymId);
  await supabase.auth.admin.deleteUser(gym.userId);
}

/** Minimal valid member payload for register_member_guarded. */
export function memberJson(n: number): Record<string, unknown> {
  return {
    name: `IT Member ${n}`,
    phone_number: `+9477${String(1000000 + n).slice(0, 7)}`,
    plan_type: 'monthly',
    plan_amount: 2000,
    discount_id: null,
    recurring_discount: false,
    status: 'active',
    next_due_date: '2099-01-01',
  };
}

export async function getGymSubscriptionRow(supabase: SupabaseClient, gymId: string) {
  const { data, error } = await supabase
    .from('gyms')
    .select(
      'subscription_tier, subscription_status, payhere_subscription_id, current_period_end, member_count'
    )
    .eq('id', gymId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
