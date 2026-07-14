import {
  formatAmount,
  generateCheckoutHash,
  verifyNotificationSignature,
} from '@/lib/payhere/crypto';

/**
 * Pinned reference vectors computed independently with the documented PayHere
 * formula (PHP: strtoupper(md5(... . strtoupper(md5(secret))))):
 *   secret        = TESTSECRET_1234
 *   merchant_id   = 1211149
 *   order_id      = SUB-gym1-1751600000000
 *   amount        = 4900 -> '4900.00'
 *   currency      = LKR
 *   status_code   = '2'
 */
const SECRET = 'TESTSECRET_1234';
const MERCHANT = '1211149';
const ORDER = 'SUB-gym1-1751600000000';
const PINNED_CHECKOUT_HASH = '0A978B6BF4F2A9F929D70EFEE1EFFE72';
const PINNED_MD5SIG = 'BAC325EB12DA068F6E04025A0D4D81F9';

const validFields = {
  merchant_id: MERCHANT,
  order_id: ORDER,
  payhere_amount: '4900.00',
  payhere_currency: 'LKR',
  status_code: '2',
  md5sig: PINNED_MD5SIG,
};

describe('formatAmount', () => {
  it('formats to exactly two decimals with no thousands separator', () => {
    expect(formatAmount(4900)).toBe('4900.00');
    expect(formatAmount(4900.5)).toBe('4900.50');
    expect(formatAmount(1234567.891)).toBe('1234567.89');
  });
});

describe('generateCheckoutHash', () => {
  it('matches the pinned PHP-formula reference vector', () => {
    expect(generateCheckoutHash(MERCHANT, SECRET, ORDER, 4900, 'LKR')).toBe(
      PINNED_CHECKOUT_HASH
    );
  });

  it('changes when any input changes', () => {
    expect(generateCheckoutHash(MERCHANT, SECRET, ORDER, 4900.01, 'LKR')).not.toBe(
      PINNED_CHECKOUT_HASH
    );
    expect(generateCheckoutHash(MERCHANT, 'WRONG', ORDER, 4900, 'LKR')).not.toBe(
      PINNED_CHECKOUT_HASH
    );
  });
});

describe('verifyNotificationSignature', () => {
  it('accepts the pinned valid vector', () => {
    expect(verifyNotificationSignature(SECRET, validFields)).toBe(true);
  });

  it('rejects a wrong secret', () => {
    expect(verifyNotificationSignature('WRONG_SECRET', validFields)).toBe(false);
  });

  it('rejects a tampered amount (raw-string rule: the exact bytes are hashed)', () => {
    expect(
      verifyNotificationSignature(SECRET, { ...validFields, payhere_amount: '1.00' })
    ).toBe(false);
    // Same numeric value, different raw string -> different signature
    expect(
      verifyNotificationSignature(SECRET, { ...validFields, payhere_amount: '4900.0' })
    ).toBe(false);
  });

  it('rejects a tampered status_code', () => {
    expect(verifyNotificationSignature(SECRET, { ...validFields, status_code: '-2' })).toBe(
      false
    );
  });

  it('rejects truncated and empty signatures', () => {
    expect(
      verifyNotificationSignature(SECRET, { ...validFields, md5sig: PINNED_MD5SIG.slice(0, 30) })
    ).toBe(false);
    expect(verifyNotificationSignature(SECRET, { ...validFields, md5sig: '' })).toBe(false);
  });
});
