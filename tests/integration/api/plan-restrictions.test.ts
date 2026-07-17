/**
 * Plan restriction integration tests (PlanRestrictions matrix + billing
 * status gates, paid-only Lite/Pro/Enterprise ladder).
 *
 * Server-side enforcement is the authority:
 *  - POST /api/announcements is enabled on EVERY tier (the capability gate
 *    stays wired for future re-gating and must not 403 today)
 *  - SendAutomatedReminders (via the DI container) halts for suspended
 *    accounts — reminders are tier-universal, status-gated
 *
 * The route reads the caller's session via @/lib/supabase/server (cookies);
 * in jest there is no request context, so ONLY that cookie plumbing is
 * replaced — the client it returns carries a REAL session token minted by
 * the stack's password grant, so auth, RLS and route logic stay real.
 */

import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  gatedDescribe,
  setPayhereTestEnv,
  adminClient,
  createTestGym,
  deleteTestGym,
  memberJson,
  type TestGym,
} from '../helpers/billing';

setPayhereTestEnv();

// Session-bound client for the announcements route: swapped per test via
// setSessionToken(); everything else about the client is real.
let sessionToken: string | null = null;

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createSupabaseClient(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: sessionToken ? { headers: { Authorization: `Bearer ${sessionToken}` } } : {},
    });
  }),
}));

// Import AFTER env + mock are in place
const { POST: announcementsPOST } = require('@/app/api/announcements/route');

async function loginAs(email: string): Promise<string> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Supabase's gateway rejects any request without the anon apikey
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({ email, password: 'integration-test-password-123' }),
    }
  );
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return (await res.json()).access_token as string;
}

async function postAnnouncement(message: string) {
  const request = new NextRequest('http://localhost:3000/api/announcements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, audience: 'all' }),
  });
  const response = await announcementsPOST(request);
  return { status: response.status, json: await response.json() };
}

gatedDescribe('plan restrictions + billing-status gates (integration)', () => {
  const supabase = adminClient();
  let gym: TestGym;
  let email: string;

  beforeEach(async () => {
    gym = await createTestGym(supabase);
    const { data } = await supabase.from('gyms').select('email').eq('id', gym.gymId).single();
    email = (data as { email: string }).email;
    sessionToken = await loginAs(email);
  });

  afterEach(async () => {
    sessionToken = null;
    await deleteTestGym(supabase, gym);
  });

  it('announcements POST: passes the gate for a trialing Lite gym (announcements are universal)', async () => {
    // The service requires at least one recipient
    await supabase.rpc('register_member_guarded', {
      p_gym_id: gym.gymId,
      p_member: memberJson(1),
    });

    const { status, json } = await postAnnouncement('Trialing Lite gym announcement');
    expect(status).not.toBe(403);
    expect(json.errorCode).not.toBe('FEATURE_NOT_AVAILABLE');
  });

  it('announcements POST: passes the gate for a Pro gym', async () => {
    await supabase.rpc('save_gym_subscription', {
      p_gym_id: gym.gymId,
      p_tier: 'pro',
      p_status: 'active',
      p_payhere_subscription_id: 'PHSUB-RESTRICT',
      p_payhere_customer_id: null,
      p_extend_period: true,
    });
    // The service requires at least one recipient
    await supabase.rpc('register_member_guarded', {
      p_gym_id: gym.gymId,
      p_member: memberJson(1),
    });

    const { status, json } = await postAnnouncement('Pro gym announcement');
    expect(status).not.toBe(403);
    expect(json.errorCode).not.toBe('FEATURE_NOT_AVAILABLE');
  });

  it('reminder cron use case (via DI container) halts for a suspended gym end-to-end', async () => {
    // Overdue member registered while the gym could still register members
    await supabase.rpc('register_member_guarded', {
      p_gym_id: gym.gymId,
      p_member: {
        ...memberJson(2),
        status: 'active',
        next_due_date: '2026-01-01', // long overdue
      },
    });
    // Suspend the account (trial expiry / dunning outcome)
    await supabase
      .from('gyms')
      .update({ subscription_status: 'suspended' })
      .eq('id', gym.gymId);

    const { createSendAutomatedReminders } = require('@/features/sms');
    const { createAdminClient } = require('@/lib/supabase/admin');
    const summary = await createSendAutomatedReminders(createAdminClient()).execute({
      gymId: gym.gymId,
    });

    expect(summary.membersSkippedBillingRestricted).toBe(1);
    expect(summary.totalSent).toBe(0);
  });
});
