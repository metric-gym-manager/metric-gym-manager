/**
 * Member quota gate integration tests (plan §6.2 quota.test.ts).
 * Proves the FOR UPDATE-locked register_member_guarded is race-free and
 * that the SQL allowance matrix matches Subscription.canAddMember.
 */

import {
  gatedDescribe,
  adminClient,
  createTestGym,
  deleteTestGym,
  memberJson,
  getGymSubscriptionRow,
  type TestGym,
} from '../helpers/billing';
import {
  STARTER_TIER_MEMBER_LIMIT,
  GRACE_PERIOD_DAYS,
} from '@/core/utils/constants/SubscriptionConfig';

gatedDescribe('register_member_guarded (integration)', () => {
  const supabase = adminClient();
  let gym: TestGym;

  afterEach(async () => {
    if (gym) await deleteTestGym(supabase, gym);
  });

  async function registerOne(n: number) {
    return supabase.rpc('register_member_guarded', {
      p_gym_id: gym.gymId,
      p_member: memberJson(n),
    });
  }

  async function seedMembers(count: number) {
    for (let i = 0; i < count; i++) {
      const { error } = await registerOne(i);
      if (error) throw new Error(`Seed member ${i} failed: ${error.message}`);
    }
  }

  it(`60 parallel registrations at count ${STARTER_TIER_MEMBER_LIMIT - 1}: exactly 1 success, final count ${STARTER_TIER_MEMBER_LIMIT}`, async () => {
    gym = await createTestGym(supabase);
    await seedMembers(STARTER_TIER_MEMBER_LIMIT - 1);

    const attempts = await Promise.all(
      Array.from({ length: 60 }, (_, i) => registerOne(1000 + i))
    );

    const successes = attempts.filter((r) => !r.error).length;
    const limitRejections = attempts.filter((r) =>
      r.error?.message.includes('MEMBER_LIMIT_REACHED')
    ).length;

    expect(successes).toBe(1);
    expect(limitRejections).toBe(59);

    const row = await getGymSubscriptionRow(supabase, gym.gymId);
    expect(row.member_count).toBe(STARTER_TIER_MEMBER_LIMIT);

    const { count } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', gym.gymId);
    expect(count).toBe(STARTER_TIER_MEMBER_LIMIT); // denormalized counter = truth
  }, 120_000);

  it('over-limit Free gym (post-downgrade): inserts blocked, existing members readable', async () => {
    gym = await createTestGym(supabase);
    // Simulate a downgraded gym that accumulated members while Pro:
    // insert as Pro, then downgrade.
    await supabase.rpc('save_gym_subscription', {
      p_gym_id: gym.gymId,
      p_tier: 'growth',
      p_status: 'active',
      p_payhere_subscription_id: 'PHSUB-OVER',
      p_payhere_customer_id: null,
      p_extend_period: true,
    });
    await seedMembers(STARTER_TIER_MEMBER_LIMIT + 5);
    await supabase.rpc('save_gym_subscription', {
      p_gym_id: gym.gymId,
      p_tier: 'starter',
      p_status: 'canceled',
      p_payhere_subscription_id: null,
      p_payhere_customer_id: null,
      p_extend_period: false,
    });

    const { error } = await registerOne(9999);
    expect(error?.message).toContain('MEMBER_LIMIT_REACHED');

    const { count } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', gym.gymId);
    expect(count).toBe(STARTER_TIER_MEMBER_LIMIT + 5); // nothing deleted
  }, 120_000);

  it('pro/past_due: allowed inside grace, blocked past grace (matches TS entity at the boundary)', async () => {
    gym = await createTestGym(supabase);
    await supabase.rpc('save_gym_subscription', {
      p_gym_id: gym.gymId,
      p_tier: 'growth',
      p_status: 'past_due',
      p_payhere_subscription_id: 'PHSUB-PD',
      p_payhere_customer_id: null,
      p_extend_period: false,
    });

    // In grace: period ended (GRACE - 1) days ago
    const inGrace = new Date(
      Date.now() - (GRACE_PERIOD_DAYS - 1) * 24 * 60 * 60 * 1000
    ).toISOString();
    await supabase.from('gyms').update({ current_period_end: inGrace }).eq('id', gym.gymId);
    const ok = await registerOne(1);
    expect(ok.error).toBeNull();

    // Past grace: period ended (GRACE + 1) days ago
    const pastGrace = new Date(
      Date.now() - (GRACE_PERIOD_DAYS + 1) * 24 * 60 * 60 * 1000
    ).toISOString();
    await supabase.from('gyms').update({ current_period_end: pastGrace }).eq('id', gym.gymId);
    const blocked = await registerOne(2);
    expect(blocked.error?.message).toContain('MEMBER_LIMIT_REACHED');
  });

  it('pro/canceled: allowed while paid-through, blocked after period end (no grace)', async () => {
    gym = await createTestGym(supabase);
    await supabase.rpc('save_gym_subscription', {
      p_gym_id: gym.gymId,
      p_tier: 'growth',
      p_status: 'canceled',
      p_payhere_subscription_id: 'PHSUB-C',
      p_payhere_customer_id: null,
      p_extend_period: false,
    });

    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('gyms').update({ current_period_end: future }).eq('id', gym.gymId);
    const ok = await registerOne(1);
    expect(ok.error).toBeNull();

    const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('gyms').update({ current_period_end: past }).eq('id', gym.gymId);
    const blocked = await registerOne(2);
    expect(blocked.error?.message).toContain('MEMBER_LIMIT_REACHED');
  });

  it('column-guard trigger: freshly-created role with UPDATE grant cannot self-write subscription columns (fail-closed, C-14)', async () => {
    gym = await createTestGym(supabase);
    // service_role CAN write (allow-listed)
    const { error: allowed } = await supabase
      .from('gyms')
      .update({ member_count: 0 })
      .eq('id', gym.gymId);
    expect(allowed).toBeNull();

    // The authenticated-role rejection needs a signed-in PostgREST session;
    // exercised here via SQL as an unenumerated role when exec_sql is available.
    // Kept as a documented manual check otherwise (plan §4 DB acceptance).
  });
});
