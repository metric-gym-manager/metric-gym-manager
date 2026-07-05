/**
 * PayHere webhook integration tests (plan §6.2 webhook.test.ts).
 * Exercises the real route handler against a disposable Supabase database.
 */

import { NextRequest } from 'next/server';
import {
  gatedDescribe,
  setPayhereTestEnv,
  adminClient,
  createTestGym,
  deleteTestGym,
  signedNotification,
  getGymSubscriptionRow,
  type TestGym,
} from '../helpers/billing';
import { INVALID_WEBHOOK_LOG_HOURLY_CAP } from '@/core/utils/constants/SubscriptionConfig';

setPayhereTestEnv();

// Import AFTER env is set (lazy config)
const { POST: webhookPOST } = require('@/app/api/webhooks/payhere/route');

function formRequest(fields: Record<string, string>): NextRequest {
  const body = new URLSearchParams(fields);
  return new NextRequest('http://localhost:3000/api/webhooks/payhere', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

async function post(fields: Record<string, string>) {
  const response = await webhookPOST(formRequest(fields));
  const json = await response.json();
  return { status: response.status, json };
}

gatedDescribe('POST /api/webhooks/payhere (integration)', () => {
  const supabase = adminClient();
  let gym: TestGym;
  let seq = 0;
  const nextId = (p: string) => `${p}-${Date.now()}-${seq++}`;

  beforeAll(async () => {
    // The C-20 invalid-audit cap counts signature_valid=false rows GLOBALLY
    // over the last hour, so flood rows left by a previous run would silently
    // suppress this run's audit inserts. Disposable database — purge them.
    await supabase.from('saas_payment_logs').delete().eq('signature_valid', false);
  });

  beforeEach(async () => {
    gym = await createTestGym(supabase);
  });

  afterEach(async () => {
    await deleteTestGym(supabase, gym);
  });

  async function createPendingIntent(orderId: string, amount = 4900) {
    const { error } = await supabase.from('checkout_intents').insert({
      order_id: orderId,
      gym_id: gym.gymId,
      target_tier: 'pro',
      expected_amount: amount,
      currency: 'LKR',
      status: 'pending',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  it('initial success provisions exactly once; duplicate replay is a 200 no-op', async () => {
    const orderId = nextId('SUB');
    const paymentId = nextId('PAY');
    await createPendingIntent(orderId);

    const fields = signedNotification({
      order_id: orderId,
      payment_id: paymentId,
      payhere_amount: '4900.00',
      status_code: '2',
      subscription_id: nextId('PHSUB'),
    });

    const first = await post(fields);
    expect(first.status).toBe(200);
    expect(first.json.data.outcome).toBe('PROVISIONED');

    const row = await getGymSubscriptionRow(supabase, gym.gymId);
    expect(row.subscription_tier).toBe('pro');
    expect(row.subscription_status).toBe('active');
    expect(row.current_period_end).not.toBeNull();
    const firstPeriodEnd = row.current_period_end;

    // Replay: 200, ALREADY_PROCESSED, no double extension, single log row
    const replay = await post(fields);
    expect(replay.status).toBe(200);
    expect(replay.json.data.outcome).toBe('ALREADY_PROCESSED');

    const rowAfter = await getGymSubscriptionRow(supabase, gym.gymId);
    expect(rowAfter.current_period_end).toBe(firstPeriodEnd);

    const { count } = await supabase
      .from('saas_payment_logs')
      .select('id', { count: 'exact', head: true })
      .eq('payhere_payment_id', paymentId);
    expect(count).toBe(1);
  });

  it('recovery: -2 marks past_due, then installment success re-anchors the period at the charge date (C-23)', async () => {
    const phsub = nextId('PHSUB');
    // Seed a pro/active gym with a stale period end
    const stalePeriodEnd = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.rpc('save_gym_subscription', {
      p_gym_id: gym.gymId,
      p_tier: 'pro',
      p_status: 'active',
      p_payhere_subscription_id: phsub,
      p_payhere_customer_id: null,
      p_extend_period: false,
    });
    await supabase
      .from('gyms')
      .update({ current_period_end: stalePeriodEnd })
      .eq('id', gym.gymId);

    // Installment failure -> past_due (with classification captured)
    const fail = await post(
      signedNotification({
        order_id: nextId('SUB'),
        payment_id: nextId('PAY'),
        payhere_amount: '4900.00',
        status_code: '-2',
        subscription_id: phsub,
        message_type: 'RECURRING_INSTALLMENT_FAILED',
        status_message: 'Insufficient funds',
      })
    );
    expect(fail.json.data.outcome).toBe('MARKED_PAST_DUE');
    let row = await getGymSubscriptionRow(supabase, gym.gymId);
    expect(row.subscription_status).toBe('past_due');
    expect(row.subscription_tier).toBe('pro'); // no downgrade in the webhook

    const { data: failLog } = await supabase
      .from('saas_payment_logs')
      .select('message_type, status_message')
      .eq('gym_id', gym.gymId)
      .eq('status_code', -2)
      .single();
    expect(failLog?.message_type).toBe('RECURRING_INSTALLMENT_FAILED');
    expect(failLog?.status_message).toBe('Insufficient funds');

    // Recovery success -> active, period anchored at NOW + 1 month (not stale boundary + 1 month)
    const before = Date.now();
    const recover = await post(
      signedNotification({
        order_id: nextId('SUB'),
        payment_id: nextId('PAY'),
        payhere_amount: '4900.00',
        status_code: '2',
        subscription_id: phsub,
      })
    );
    expect(recover.json.data.outcome).toBe('RENEWED');

    row = await getGymSubscriptionRow(supabase, gym.gymId);
    expect(row.subscription_status).toBe('active');
    const periodEnd = new Date(row.current_period_end!).getTime();
    const staleAnchor = new Date(stalePeriodEnd).getTime() + 32 * 24 * 60 * 60 * 1000;
    expect(periodEnd).toBeGreaterThan(staleAnchor); // charge-date anchor, not stale boundary
    expect(periodEnd).toBeGreaterThan(before + 27 * 24 * 60 * 60 * 1000);
  });

  it('amount mismatch: intent fails, gym stays Free', async () => {
    const orderId = nextId('SUB');
    await createPendingIntent(orderId, 4900);

    const res = await post(
      signedNotification({
        order_id: orderId,
        payment_id: nextId('PAY'),
        payhere_amount: '1.00', // signed but wrong vs expected_amount
        status_code: '2',
      })
    );
    expect(res.status).toBe(200);
    expect(res.json.data.outcome).toBe('AMOUNT_MISMATCH');

    const row = await getGymSubscriptionRow(supabase, gym.gymId);
    expect(row.subscription_tier).toBe('free');

    const { data: intent } = await supabase
      .from('checkout_intents')
      .select('status')
      .eq('order_id', orderId)
      .single();
    expect(intent?.status).toBe('failed');
  });

  it('invalid signature: 200, audited with signature_valid=false and md5sig redacted, gym unchanged', async () => {
    const orderId = nextId('SUB');
    await createPendingIntent(orderId);
    const paymentId = nextId('PAY');

    const fields = signedNotification({
      order_id: orderId,
      payment_id: paymentId,
      payhere_amount: '4900.00',
      status_code: '2',
    });
    fields.md5sig = 'F'.repeat(32); // tampered

    const res = await post(fields);
    expect(res.status).toBe(200);

    const row = await getGymSubscriptionRow(supabase, gym.gymId);
    expect(row.subscription_tier).toBe('free');

    const { data: log } = await supabase
      .from('saas_payment_logs')
      .select('signature_valid, raw_payload')
      .eq('payhere_payment_id', paymentId)
      .single();
    expect(log?.signature_valid).toBe(false);
    expect((log?.raw_payload as Record<string, string>).md5sig).toBe('[REDACTED]');
  });

  it('unresolved gym: 200 + null-gym audit row', async () => {
    const paymentId = nextId('PAY');
    const res = await post(
      signedNotification({
        order_id: nextId('UNKNOWN'),
        payment_id: paymentId,
        payhere_amount: '4900.00',
        status_code: '2',
        subscription_id: nextId('PHSUB-UNKNOWN'),
      })
    );
    expect(res.status).toBe(200);
    expect(res.json.data.outcome).toBe('UNRESOLVED');

    const { data: log } = await supabase
      .from('saas_payment_logs')
      .select('gym_id')
      .eq('payhere_payment_id', paymentId)
      .single();
    expect(log?.gym_id).toBeNull();
  });

  it('RECURRING_STOPPED on pro/active cancels; late STOPPED for a replaced sub leaves the new one untouched (C-21)', async () => {
    const subA = nextId('PHSUB-A');
    await supabase.rpc('save_gym_subscription', {
      p_gym_id: gym.gymId,
      p_tier: 'pro',
      p_status: 'active',
      p_payhere_subscription_id: subA,
      p_payhere_customer_id: null,
      p_extend_period: true,
    });

    // Gateway-side stop reconciles to pro/canceled
    const stop = await post(
      signedNotification({
        order_id: nextId('SUB'),
        payment_id: nextId('PAY'),
        payhere_amount: '4900.00',
        status_code: '-1',
        subscription_id: subA,
        message_type: 'RECURRING_STOPPED',
        item_rec_status: '-1',
      })
    );
    expect(stop.json.data.outcome).toBe('RECONCILED_CANCELED');
    let row = await getGymSubscriptionRow(supabase, gym.gymId);
    expect(row.subscription_tier).toBe('pro');
    expect(row.subscription_status).toBe('canceled');

    // Re-subscribe under sub B
    const subB = nextId('PHSUB-B');
    await supabase.rpc('save_gym_subscription', {
      p_gym_id: gym.gymId,
      p_tier: 'pro',
      p_status: 'active',
      p_payhere_subscription_id: subB,
      p_payhere_customer_id: null,
      p_extend_period: true,
    });

    // Late event for replaced sub A resolves the gym via custom_1 but must not touch B
    const late = await post(
      signedNotification({
        order_id: nextId('SUB'),
        payment_id: nextId('PAY'),
        payhere_amount: '4900.00',
        status_code: '-1',
        subscription_id: subA,
        custom_1: gym.gymId,
        message_type: 'RECURRING_STOPPED',
      })
    );
    expect(late.json.data.outcome).toBe('STALE_EVENT');
    row = await getGymSubscriptionRow(supabase, gym.gymId);
    expect(row.subscription_status).toBe('active');
    expect(row.payhere_subscription_id).toBe(subB);
  });

  it('forged-payload flood: audit rows capped at the hourly limit, every response still 200 (C-20)', async () => {
    const floodSize = INVALID_WEBHOOK_LOG_HOURLY_CAP + 25;
    const before = await supabase
      .from('saas_payment_logs')
      .select('id', { count: 'exact', head: true })
      .eq('signature_valid', false);

    for (let i = 0; i < floodSize; i++) {
      const res = await post({
        merchant_id: 'FORGED',
        order_id: `forged-${i}`,
        payhere_amount: '1.00',
        payhere_currency: 'LKR',
        status_code: '2',
        md5sig: 'A'.repeat(32),
      });
      expect(res.status).toBe(200); // never leak validation behavior
    }

    const after = await supabase
      .from('saas_payment_logs')
      .select('id', { count: 'exact', head: true })
      .eq('signature_valid', false);
    const inserted = (after.count ?? 0) - (before.count ?? 0);
    expect(inserted).toBeLessThanOrEqual(INVALID_WEBHOOK_LOG_HOURLY_CAP);
  }, 120_000);
});
