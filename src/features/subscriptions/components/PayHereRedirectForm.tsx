'use client';

/**
 * PayHere checkout hand-off.
 *
 * PayHere's redirect API requires a browser-level form POST navigation — a
 * fetch cannot follow the cross-origin redirect into the payment pages. This
 * helper builds a plain (non-React-controlled) hidden form from the params
 * returned by POST /api/billing/checkout and submits it. The params contain
 * no secrets (the hash is signed server-side; the Merchant Secret never
 * reaches the client).
 */

import type { CheckoutRedirectResponse } from '../types';

export function submitPayHereCheckout(redirect: {
  checkoutUrl: CheckoutRedirectResponse['checkoutUrl'];
  params: CheckoutRedirectResponse['params'];
}): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = redirect.checkoutUrl;
  form.style.display = 'none';

  for (const [name, value] of Object.entries(redirect.params)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
