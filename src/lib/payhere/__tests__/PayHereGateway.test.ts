import { SaasTier } from '@/core/utils/constants/SubscriptionConfig';
import { PayHereGateway } from '@/lib/payhere/PayHereGateway';
import { __resetPayhereConfigForTests } from '@/lib/payhere/config';
import { generateCheckoutHash } from '@/lib/payhere/crypto';

const ENV = {
  PAYHERE_MODE: 'sandbox',
  PAYHERE_MERCHANT_ID: '1211149',
  PAYHERE_MERCHANT_SECRET: 'TESTSECRET_1234',
  PAYHERE_LITE_PRICE_LKR: '2990',
  PAYHERE_PRO_PRICE_LKR: '4990',
  PAYHERE_ENTERPRISE_PRICE_LKR: '6990',
  PAYHERE_APP_ID: 'app-id',
  PAYHERE_APP_SECRET: 'app-secret',
  NEXT_PUBLIC_APP_URL: 'https://app.example.com',
} as const;

describe('PayHereGateway', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ...ENV };
    __resetPayhereConfigForTests();
  });

  afterAll(() => {
    process.env = originalEnv;
    __resetPayhereConfigForTests();
  });

  const customer = {
    firstName: 'Colombo Fitness',
    lastName: 'Gym',
    email: 'owner@example.com',
    phone: '+94771234567',
    address: '1 Main St',
    city: 'Colombo',
  };

  it('assembles the preapproval params (first month captured + tokenization) with a valid hash and no secret', () => {
    const gateway = new PayHereGateway();
    const { checkoutUrl, params } = gateway.buildPreapprovalRedirect({
      orderId: 'SUB-gym1-1',
      amount: 4990,
      currency: 'LKR',
      tier: SaasTier.Pro,
      gymId: 'gym1',
      customer,
    });

    expect(checkoutUrl).toBe('https://sandbox.payhere.lk/pay/preapprove');
    expect(params.merchant_id).toBe('1211149');
    expect(params.amount).toBe('4990.00');
    expect(params.currency).toBe('LKR');
    // Preapproval has NO recurrence schedule — this app owns the billing clock
    expect(params.recurrence).toBeUndefined();
    expect(params.duration).toBeUndefined();
    expect(params.country).toBe('Sri Lanka');
    expect(params.custom_1).toBe('gym1');
    expect(params.notify_url).toBe('https://app.example.com/api/webhooks/payhere');
    expect(params.return_url).toBe('https://app.example.com/settings/billing?order=SUB-gym1-1');
    expect(params.hash).toBe(
      generateCheckoutHash('1211149', 'TESTSECRET_1234', 'SUB-gym1-1', 4990, 'LKR')
    );

    // The Merchant Secret must never appear in any param value
    expect(Object.values(params)).not.toContain('TESTSECRET_1234');
  });

  it('verifies notification signatures via the shared crypto helper', () => {
    const gateway = new PayHereGateway();
    // Build a self-consistent notification using the documented formula
    const { createHash } = jest.requireActual<typeof import('crypto')>('crypto');
    const md5U = (s: string) => createHash('md5').update(s, 'utf8').digest('hex').toUpperCase();
    const md5sig = md5U('1211149' + 'ORD-1' + '4900.00' + 'LKR' + '2' + md5U('TESTSECRET_1234'));

    const fields = {
      merchant_id: '1211149',
      order_id: 'ORD-1',
      payhere_amount: '4900.00',
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig,
    };
    expect(gateway.verifyNotificationSignature(fields)).toBe(true);
    expect(
      gateway.verifyNotificationSignature({ ...fields, payhere_amount: '1.00' })
    ).toBe(false);
    expect(gateway.verifyNotificationSignature({})).toBe(false);
  });
});
