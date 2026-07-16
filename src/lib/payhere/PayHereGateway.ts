/**
 * PayHere redirect/form gateway — implements IPaymentGateway.
 *
 * Assembles the Preapproval field set (`POST /pay/preapprove`): the customer
 * authorizes their card on PayHere, the passed `amount` (first month's tier
 * price) is captured as a payment alongside the preapproval, and the
 * notification returns the reusable `customer_token` that powers all
 * subsequent server-initiated charges (Charging API).
 *
 * The Merchant Secret never leaves this module: the returned params contain
 * only what PayHere's form needs, and the signature helpers receive the
 * secret as an argument. The `hash` formula is identical to Checkout's.
 */

import type {
  IPaymentGateway,
  CheckoutCustomer,
  CheckoutRedirect,
} from '@/lib/payhere/IPaymentGateway';
import {
  generateCheckoutHash,
  verifyNotificationSignature,
  formatAmount,
} from '@/lib/payhere/crypto';
import { getPayhereConfig } from '@/lib/payhere/config';
import { TIER_DISPLAY_NAME, SaasTier } from '@/core/utils/constants/SubscriptionConfig';

export class PayHereGateway implements IPaymentGateway {
  buildPreapprovalRedirect(input: {
    orderId: string;
    amount: number;
    currency: 'LKR';
    tier: SaasTier;
    gymId: string;
    customer: CheckoutCustomer;
  }): CheckoutRedirect {
    const config = getPayhereConfig();
    const { orderId, amount, currency, tier, gymId, customer } = input;

    const params: Record<string, string> = {
      merchant_id: config.merchantId,
      return_url: `${config.returnUrl}?order=${encodeURIComponent(orderId)}`,
      cancel_url: config.cancelUrl,
      notify_url: config.notifyUrl,
      first_name: customer.firstName,
      last_name: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      country: 'Sri Lanka',
      order_id: orderId,
      items: `${TIER_DISPLAY_NAME[tier]} Plan — Monthly`,
      currency,
      // A real amount on /pay/preapprove is captured as a payment alongside
      // the tokenization — first month paid AND card saved in one step.
      amount: formatAmount(amount),
      custom_1: gymId, // webhook attribution fallback (unsigned — see plan C-24)
      hash: generateCheckoutHash(
        config.merchantId,
        config.merchantSecret,
        orderId,
        amount,
        currency
      ),
    };

    return { checkoutUrl: config.preapproveUrl, params };
  }

  verifyNotificationSignature(fields: Record<string, string>): boolean {
    const config = getPayhereConfig();
    return verifyNotificationSignature(config.merchantSecret, {
      merchant_id: fields.merchant_id ?? '',
      order_id: fields.order_id ?? '',
      payhere_amount: fields.payhere_amount ?? '',
      payhere_currency: fields.payhere_currency ?? '',
      status_code: fields.status_code ?? '',
      md5sig: fields.md5sig ?? '',
    });
  }
}
