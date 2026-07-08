import { getPayhereConfig, __resetPayhereConfigForTests } from '@/lib/payhere/config';

const VALID_ENV = {
  PAYHERE_MODE: 'sandbox',
  PAYHERE_MERCHANT_ID: '1211149',
  PAYHERE_MERCHANT_SECRET: 'TESTSECRET_1234',
  PAYHERE_PRO_PRICE_LKR: '2990',
  PAYHERE_ENTERPRISE_PRICE_LKR: '6990',
  PAYHERE_APP_ID: 'app-id',
  PAYHERE_APP_SECRET: 'app-secret',
  NEXT_PUBLIC_APP_URL: 'https://app.example.com',
} as const;

describe('getPayhereConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ...VALID_ENV };
    __resetPayhereConfigForTests();
  });

  afterAll(() => {
    process.env = originalEnv;
    __resetPayhereConfigForTests();
  });

  it('parses a valid environment and derives sandbox URLs', () => {
    const cfg = getPayhereConfig();
    expect(cfg.mode).toBe('sandbox');
    expect(cfg.proPriceLkr).toBe(2990);
    expect(cfg.checkoutUrl).toBe('https://sandbox.payhere.lk/pay/checkout');
    expect(cfg.restBaseUrl).toBe('https://sandbox.payhere.lk/merchant/v1');
    expect(cfg.returnUrl).toBe('https://app.example.com/settings/billing');
    expect(cfg.cancelUrl).toBe('https://app.example.com/settings/billing?canceled=1');
    expect(cfg.notifyUrl).toBe('https://app.example.com/api/webhooks/payhere');
  });

  it('derives live URLs when PAYHERE_MODE=live', () => {
    process.env.PAYHERE_MODE = 'live';
    __resetPayhereConfigForTests();
    const cfg = getPayhereConfig();
    expect(cfg.checkoutUrl).toBe('https://www.payhere.lk/pay/checkout');
    expect(cfg.restBaseUrl).toBe('https://www.payhere.lk/merchant/v1');
  });

  it('throws naming the missing variables', () => {
    delete process.env.PAYHERE_MERCHANT_SECRET;
    delete process.env.PAYHERE_APP_ID;
    __resetPayhereConfigForTests();
    expect(() => getPayhereConfig()).toThrow(/PAYHERE_MERCHANT_SECRET/);
    expect(() => getPayhereConfig()).toThrow(/PAYHERE_APP_ID/);
  });

  it('rejects a non-positive price', () => {
    process.env.PAYHERE_PRO_PRICE_LKR = '0';
    __resetPayhereConfigForTests();
    expect(() => getPayhereConfig()).toThrow(/PAYHERE_PRO_PRICE_LKR/);
  });

  it('caches after first successful parse', () => {
    const first = getPayhereConfig();
    process.env.PAYHERE_MERCHANT_ID = 'changed';
    expect(getPayhereConfig()).toBe(first);
  });
});
