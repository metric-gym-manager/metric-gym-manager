import {
  PayHereSubscriptionGateway,
  __resetPayhereTokenCacheForTests,
} from '@/infrastructure/payments/PayHereSubscriptionGateway';
import { __resetPayhereConfigForTests } from '@/lib/payhere/config';
import { ExternalServiceError } from '@/core/utils/errors';
import { createHash } from 'crypto';

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

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('PayHereSubscriptionGateway', () => {
  const originalEnv = process.env;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env = { ...originalEnv, ...ENV };
    __resetPayhereConfigForTests();
    __resetPayhereTokenCacheForTests();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    process.env = originalEnv;
    __resetPayhereConfigForTests();
    __resetPayhereTokenCacheForTests();
  });

  const tokenResponse = jsonResponse({ access_token: 'TOK1', expires_in: 599 });

  const md5U = (x: string) => createHash('md5').update(x, 'utf8').digest('hex').toUpperCase();
  /** Response md5sig over our request tuple (same 5-tuple as notifications). */
  const chargeSig = (orderId: string, amount: string, statusCode: string) =>
    md5U('1211149' + orderId + amount + 'LKR' + statusCode + md5U('TESTSECRET_1234'));

  const chargeInput = {
    orderId: 'REN-gym-1-1',
    amount: 4990,
    currency: 'LKR' as const,
    customerToken: 'CUST-TOKEN-1',
    items: 'Pro Plan — Monthly',
    gymId: 'gym-1',
  };

  describe('chargeCustomerToken (Charging API)', () => {
    it('POSTs the charge with Bearer auth and returns a verified success', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse)
        .mockResolvedValueOnce(
          jsonResponse({
            status: 1,
            msg: 'Payment success',
            data: {
              payment_id: 320025300,
              status_code: '2',
              status_message: 'Successfully completed the payment.',
              md5sig: chargeSig('REN-gym-1-1', '4990.00', '2'),
            },
          })
        );

      const result = await new PayHereSubscriptionGateway().chargeCustomerToken(chargeInput);

      const [chargeUrl, chargeInit] = fetchMock.mock.calls[1];
      expect(chargeUrl).toBe('https://sandbox.payhere.lk/merchant/v1/payment/charge');
      expect(chargeInit.headers.Authorization).toBe('Bearer TOK1');
      const body = JSON.parse(chargeInit.body);
      expect(body).toMatchObject({
        type: 'PAYMENT',
        order_id: 'REN-gym-1-1',
        amount: '4990.00',
        currency: 'LKR',
        customer_token: 'CUST-TOKEN-1',
        custom_1: 'gym-1',
      });

      expect(result.statusCode).toBe(2);
      expect(result.paymentId).toBe('320025300');
      expect(result.signatureValid).toBe(true);
      expect(result.rawPayload.md5sig).toBe('[REDACTED]');
    });

    it('flags a tampered response signature (never act on it)', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse)
        .mockResolvedValueOnce(
          jsonResponse({
            status: 1,
            data: {
              payment_id: 1,
              status_code: '2',
              md5sig: 'F'.repeat(32),
            },
          })
        );

      const result = await new PayHereSubscriptionGateway().chargeCustomerToken(chargeInput);
      expect(result.statusCode).toBe(2);
      expect(result.signatureValid).toBe(false);
    });

    it('maps a declined charge (data.status_code -2) to a definite failure result', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse)
        .mockResolvedValueOnce(
          jsonResponse({
            status: -1,
            msg: 'Payment failed',
            data: {
              payment_id: 2,
              status_code: '-2',
              status_message: 'Insufficient funds',
              md5sig: chargeSig('REN-gym-1-1', '4990.00', '-2'),
            },
          })
        );

      const result = await new PayHereSubscriptionGateway().chargeCustomerToken(chargeInput);
      expect(result.statusCode).toBe(-2);
      expect(result.statusMessage).toBe('Insufficient funds');
      expect(result.signatureValid).toBe(true);
    });

    it('maps a pre-processing rejection (no data envelope) to a failure result', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse)
        .mockResolvedValueOnce(jsonResponse({ status: -1, msg: 'Invalid customer token' }));

      const result = await new PayHereSubscriptionGateway().chargeCustomerToken(chargeInput);
      expect(result.statusCode).toBe(-2);
      expect(result.paymentId).toBeNull();
      expect(result.statusMessage).toContain('Invalid customer token');
    });

    it('throws ExternalServiceError on transport faults (outcome unknown — caller must not retry inline)', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse)
        .mockRejectedValueOnce(new Error('socket hang up'));

      await expect(
        new PayHereSubscriptionGateway().chargeCustomerToken(chargeInput)
      ).rejects.toThrow(ExternalServiceError);
    });
  });

  it('fetches an OAuth token with Basic auth then cancels with Bearer', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse)
      .mockResolvedValueOnce(jsonResponse({ status: 1, msg: 'Subscription cancelled' }));

    await new PayHereSubscriptionGateway().cancelSubscription('SUB-123');

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe('https://sandbox.payhere.lk/merchant/v1/oauth/token');
    expect(tokenInit.headers.Authorization).toBe(
      `Basic ${Buffer.from('app-id:app-secret').toString('base64')}`
    );
    expect(tokenInit.body).toBe('grant_type=client_credentials');

    const [cancelUrl, cancelInit] = fetchMock.mock.calls[1];
    expect(cancelUrl).toBe('https://sandbox.payhere.lk/merchant/v1/subscription/cancel');
    expect(cancelInit.headers.Authorization).toBe('Bearer TOK1');
    expect(JSON.parse(cancelInit.body)).toEqual({ subscription_id: 'SUB-123' });
  });

  it('caches the token across calls and refreshes only after expiry', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse)
      .mockResolvedValueOnce(jsonResponse({ status: 1 }))
      .mockResolvedValueOnce(jsonResponse({ status: 1 }));

    const gateway = new PayHereSubscriptionGateway();
    await gateway.cancelSubscription('SUB-1');
    await gateway.cancelSubscription('SUB-2');

    // 1 token fetch + 2 cancels
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Simulate expiry: reset cache, next call re-fetches the token
    __resetPayhereTokenCacheForTests();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'TOK2', expires_in: 599 }))
      .mockResolvedValueOnce(jsonResponse({ status: 1 }));
    await gateway.cancelSubscription('SUB-3');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('treats already-cancelled as success (idempotent)', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse)
      .mockResolvedValueOnce(
        jsonResponse({ status: -1, msg: 'Subscription already cancelled' })
      );

    await expect(
      new PayHereSubscriptionGateway().cancelSubscription('SUB-123')
    ).resolves.toBeUndefined();
  });

  it('throws ExternalServiceError on auth errors', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse)
      .mockResolvedValueOnce(jsonResponse({ status: -2, msg: 'Authentication error' }));

    await expect(
      new PayHereSubscriptionGateway().cancelSubscription('SUB-123')
    ).rejects.toThrow(ExternalServiceError);
  });

  it('throws ExternalServiceError on network failure', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse)
      .mockRejectedValueOnce(new Error('ECONNRESET'));

    await expect(
      new PayHereSubscriptionGateway().cancelSubscription('SUB-123')
    ).rejects.toThrow(ExternalServiceError);
  });

  it('lists subscription payments with typed rows', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse)
      .mockResolvedValueOnce(
        jsonResponse({
          status: 1,
          data: [{ payment_id: 320093, date: '2026-07-01', amount: '2990.00', status: 'RECEIVED' }],
        })
      );

    const rows = await new PayHereSubscriptionGateway().listSubscriptionPayments('SUB-123');
    expect(rows).toEqual([
      { paymentId: '320093', date: '2026-07-01', amount: '2990.00', status: 'RECEIVED' },
    ]);
  });
});
