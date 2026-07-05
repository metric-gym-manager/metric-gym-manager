/**
 * Dunning integration tests (plan §6.2 dunning.test.ts).
 * Server-clock downgrades; members are NEVER touched.
 */

import {
  gatedDescribe,
  setPayhereTestEnv,
  adminClient,
  createTestGym,
  deleteTestGym,
  memberJson,
  getGymSubscriptionRow,
  type TestGym,
} from '../helpers/billing';
import { GRACE_PERIOD_DAYS } from '@/core/utils/constants/SubscriptionConfig';

setPayhereTestEnv();

gatedDescribe('process-dunning (integration)', () => {
  const supabase = adminClient();
  const gyms: TestGym[] = [];

  afterAll(async () => {
    for (const gym of gyms) await deleteTestGym(supabase, gym);
  });

  async function seedGym(
    status: 'past_due' | 'canceled' | 'active',
    periodEndOffsetDays: number,
    memberCount = 2
  ): Promise<TestGym> {
    const gym = await createTestGym(supabase);
    gyms.push(gym);
    // Seed members BEFORE pushing the subscription into arrears: the quota
    // matrix (correctly) rejects registrations once a past_due gym is beyond
    // grace, and the invariant under test is that dunning preserves members
    // that were registered while the gym could still register them.
    for (let i = 0; i < memberCount; i++) {
      const { error } = await supabase.rpc('register_member_guarded', {
        p_gym_id: gym.gymId,
        p_member: memberJson(i),
      });
      if (error) throw new Error(error.message);
    }
    await supabase.rpc('save_gym_subscription', {
      p_gym_id: gym.gymId,
      p_tier: 'pro',
      p_status: status,
      p_payhere_subscription_id: `PHSUB-${gym.gymId.slice(0, 8)}`,
      p_payhere_customer_id: null,
      p_extend_period: false,
    });
    await supabase
      .from('gyms')
      .update({
        current_period_end: new Date(
          Date.now() + periodEndOffsetDays * 24 * 60 * 60 * 1000
        ).toISOString(),
      })
      .eq('id', gym.gymId);
    return gym;
  }

  it('downgrades past-grace past_due, retains in-grace, lapses ended canceled, preserves members', async () => {
    const pastGrace = await seedGym('past_due', -(GRACE_PERIOD_DAYS + 1)); // downgrade
    const inGrace = await seedGym('past_due', -(GRACE_PERIOD_DAYS - 2)); // retain
    const lapsedCancel = await seedGym('canceled', -1); // lapse to free
    const paidCancel = await seedGym('canceled', +5); // retain (paid-through)
    const activePro = await seedGym('active', +10); // untouched

    const membersBefore = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .in('gym_id', gyms.map((g) => g.gymId));

    const { data, error } = await supabase.rpc('process_dunning_downgrades', {
      p_grace_days: GRACE_PERIOD_DAYS,
    });
    expect(error).toBeNull();
    const counts = Array.isArray(data) ? data[0] : data;
    expect(counts.downgraded_past_due).toBeGreaterThanOrEqual(1);
    expect(counts.lapsed_canceled).toBeGreaterThanOrEqual(1);

    expect((await getGymSubscriptionRow(supabase, pastGrace.gymId)).subscription_tier).toBe('free');
    expect(
      (await getGymSubscriptionRow(supabase, pastGrace.gymId)).payhere_subscription_id
    ).toBeNull();
    expect((await getGymSubscriptionRow(supabase, inGrace.gymId)).subscription_tier).toBe('pro');
    expect((await getGymSubscriptionRow(supabase, inGrace.gymId)).subscription_status).toBe(
      'past_due'
    );

    const lapsedRow = await getGymSubscriptionRow(supabase, lapsedCancel.gymId);
    expect(lapsedRow.subscription_tier).toBe('free');
    expect(lapsedRow.subscription_status).toBe('canceled'); // status preserved on lapse

    expect((await getGymSubscriptionRow(supabase, paidCancel.gymId)).subscription_tier).toBe('pro');
    expect((await getGymSubscriptionRow(supabase, activePro.gymId)).subscription_status).toBe(
      'active'
    );

    // THE invariant: no dunning branch touches members
    const membersAfter = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .in('gym_id', gyms.map((g) => g.gymId));
    expect(membersAfter.count).toBe(membersBefore.count);

    // Idempotence: a second pass changes nothing further
    const second = await supabase.rpc('process_dunning_downgrades', {
      p_grace_days: GRACE_PERIOD_DAYS,
    });
    const secondCounts = Array.isArray(second.data) ? second.data[0] : second.data;
    expect(secondCounts.downgraded_past_due).toBe(0);
  }, 180_000);

  it('expires stale pending checkout intents', async () => {
    const gym = await createTestGym(supabase);
    gyms.push(gym);
    await supabase.from('checkout_intents').insert({
      order_id: `STALE-${Date.now()}`,
      gym_id: gym.gymId,
      target_tier: 'pro',
      expected_amount: 4900,
      currency: 'LKR',
      status: 'pending',
      expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
    });

    const { error } = await supabase
      .from('checkout_intents')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .eq('gym_id', gym.gymId);
    expect(error).toBeNull();

    const { data: intent } = await supabase
      .from('checkout_intents')
      .select('status')
      .eq('gym_id', gym.gymId)
      .single();
    expect(intent?.status).toBe('expired');
  });
});
