/**
 * Trial-expiry integration tests (tier strategy v2).
 * Server-clock suspension of expired trials — tier preserved, members
 * NEVER touched; converted (active) accounts are immune.
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

setPayhereTestEnv();

gatedDescribe('process-trial-expiry (integration)', () => {
  const supabase = adminClient();
  const gyms: TestGym[] = [];

  afterAll(async () => {
    for (const gym of gyms) await deleteTestGym(supabase, gym);
  });

  async function seedTrialGym(trialEndOffsetDays: number, memberCount = 1): Promise<TestGym> {
    const gym = await createTestGym(supabase); // defaults: lite/trialing + trial clock
    gyms.push(gym);
    for (let i = 0; i < memberCount; i++) {
      const { error } = await supabase.rpc('register_member_guarded', {
        p_gym_id: gym.gymId,
        p_member: memberJson(i),
      });
      if (error) throw new Error(error.message);
    }
    await supabase
      .from('gyms')
      .update({
        trial_ends_at: new Date(
          Date.now() + trialEndOffsetDays * 24 * 60 * 60 * 1000
        ).toISOString(),
      })
      .eq('id', gym.gymId);
    return gym;
  }

  it('suspends expired trials (tier preserved), retains running trials and converted accounts, preserves members', async () => {
    const expiredTrial = await seedTrialGym(-1); // suspend
    const runningTrial = await seedTrialGym(+5); // retain
    const converted = await seedTrialGym(-1); // converted before cron: immune
    await supabase.rpc('save_gym_subscription', {
      p_gym_id: converted.gymId,
      p_tier: 'lite',
      p_status: 'active',
      p_payhere_subscription_id: 'PHSUB-CONVERTED',
      p_payhere_customer_id: null,
      p_extend_period: true,
    });

    const membersBefore = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .in('gym_id', gyms.map((g) => g.gymId));

    const { data, error } = await supabase.rpc('process_trial_expiry');
    expect(error).toBeNull();
    expect(data).toBeGreaterThanOrEqual(1);

    const expiredRow = await getGymSubscriptionRow(supabase, expiredTrial.gymId);
    expect(expiredRow.subscription_status).toBe('suspended');
    expect(expiredRow.subscription_tier).toBe('lite'); // tier preserved

    const runningRow = await getGymSubscriptionRow(supabase, runningTrial.gymId);
    expect(runningRow.subscription_status).toBe('trialing');

    const convertedRow = await getGymSubscriptionRow(supabase, converted.gymId);
    expect(convertedRow.subscription_status).toBe('active');

    // Members are NEVER touched
    const membersAfter = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .in('gym_id', gyms.map((g) => g.gymId));
    expect(membersAfter.count).toBe(membersBefore.count);

    // Idempotence: a second pass changes nothing further
    const second = await supabase.rpc('process_trial_expiry');
    expect(second.data).toBe(0);
  }, 120_000);

  it('a suspended (expired-trial) gym cannot register active members but keeps its roster', async () => {
    const gym = await seedTrialGym(-1, 2);
    await supabase.rpc('process_trial_expiry');

    const blocked = await supabase.rpc('register_member_guarded', {
      p_gym_id: gym.gymId,
      p_member: memberJson(99),
    });
    expect(blocked.error?.message).toContain('MEMBER_LIMIT_REACHED');

    const { count } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', gym.gymId);
    expect(count).toBe(2);
  });
});
