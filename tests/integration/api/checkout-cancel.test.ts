/**
 * Checkout race + cancel integration tests (plan §6.2).
 */

import {
  gatedDescribe,
  setPayhereTestEnv,
  adminClient,
  createTestGym,
  deleteTestGym,
  getGymSubscriptionRow,
  type TestGym,
} from '../helpers/billing';

setPayhereTestEnv();

const {
  SupabaseGymSubscriptionRepository,
} = require('@/infrastructure/database/repositories/SupabaseGymSubscriptionRepository');
const {
  SupabaseCheckoutIntentRepository,
} = require('@/infrastructure/database/repositories/SupabaseCheckoutIntentRepository');
const { GenerateCheckoutUrl } = require('@/core/use-cases/subscription/GenerateCheckoutUrl');
const { CancelSubscription } = require('@/core/use-cases/subscription/CancelSubscription');
const { PayHereGateway } = require('@/infrastructure/payments/PayHereGateway');

const customer = {
  firstName: 'IT Gym',
  lastName: 'Gym',
  email: 'it@example.com',
  phone: '+94771234567',
  address: '1 Main St',
  city: 'Colombo',
};

gatedDescribe('checkout race + cancel (integration)', () => {
  const supabase = adminClient();
  let gym: TestGym;

  beforeEach(async () => {
    gym = await createTestGym(supabase);
  });

  afterEach(async () => {
    await deleteTestGym(supabase, gym);
  });

  function buildCheckout() {
    return new GenerateCheckoutUrl(
      new SupabaseGymSubscriptionRepository(supabase),
      new SupabaseCheckoutIntentRepository(supabase),
      new PayHereGateway(),
      4900
    );
  }

  it('two parallel checkouts: exactly one pending intent, the other rejected (409-mapped ConflictError)', async () => {
    const useCase = buildCheckout();
    const results = await Promise.allSettled([
      useCase.execute({ gymId: gym.gymId, customer }),
      useCase.execute({ gymId: gym.gymId, customer }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.name).toBe('ConflictError');

    const { count } = await supabase
      .from('checkout_intents')
      .select('order_id', { count: 'exact', head: true })
      .eq('gym_id', gym.gymId)
      .eq('status', 'pending');
    expect(count).toBe(1);
  });

  it('pro/active gym cannot start a checkout', async () => {
    await supabase.rpc('save_gym_subscription', {
      p_gym_id: gym.gymId,
      p_tier: 'pro',
      p_status: 'active',
      p_payhere_subscription_id: 'PHSUB-ACTIVE',
      p_payhere_customer_id: null,
      p_extend_period: true,
    });

    await expect(
      buildCheckout().execute({ gymId: gym.gymId, customer })
    ).rejects.toMatchObject({ name: 'ConflictError' });
  });

  it('cancel: gateway success persists pro/canceled; gateway failure leaves state untouched', async () => {
    await supabase.rpc('save_gym_subscription', {
      p_gym_id: gym.gymId,
      p_tier: 'pro',
      p_status: 'active',
      p_payhere_subscription_id: 'PHSUB-CANCEL',
      p_payhere_customer_id: null,
      p_extend_period: true,
    });
    const repo = new SupabaseGymSubscriptionRepository(supabase);

    // Gateway failure FIRST: local state must be untouched
    const failingGateway = {
      cancelSubscription: jest.fn().mockRejectedValue(
        Object.assign(new Error('PayHere error: IP not whitelisted'), {
          name: 'ExternalServiceError',
        })
      ),
      listSubscriptionPayments: jest.fn(),
    };
    await expect(
      new CancelSubscription(repo, failingGateway).execute({ gymId: gym.gymId })
    ).rejects.toMatchObject({ name: 'ExternalServiceError' });
    let row = await getGymSubscriptionRow(supabase, gym.gymId);
    expect(row.subscription_status).toBe('active');

    // Gateway success: pro/canceled, period end retained (paid-through)
    const okGateway = {
      cancelSubscription: jest.fn().mockResolvedValue(undefined),
      listSubscriptionPayments: jest.fn(),
    };
    const periodBefore = row.current_period_end;
    const result = await new CancelSubscription(repo, okGateway).execute({
      gymId: gym.gymId,
    });
    expect(okGateway.cancelSubscription).toHaveBeenCalledWith('PHSUB-CANCEL');
    expect(result.status).toBe('canceled');
    expect(result.tier).toBe('pro');

    row = await getGymSubscriptionRow(supabase, gym.gymId);
    expect(row.subscription_status).toBe('canceled');
    expect(row.subscription_tier).toBe('pro');
    expect(row.current_period_end).toBe(periodBefore); // no extension on cancel
  });
});
