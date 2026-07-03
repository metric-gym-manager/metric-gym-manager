# PayHere API — High-Level Reference

## Environments

| | Base |
|---|---|
| Sandbox | `https://sandbox.payhere.lk` |
| Live | `https://www.payhere.lk` |

Redirect/form endpoints live under `/pay/*`. OAuth-secured Merchant REST endpoints live under `/merchant/v1/*`.

## Credentials

| Credential | Scope | Used by |
|---|---|---|
| Merchant ID | Account-wide | All redirect/form APIs |
| Merchant Secret | Per domain/app (approval up to 24h) | Hash generation + `md5sig` verification |
| App ID + App Secret | Per API Key, domain-whitelisted | OAuth token for Merchant REST APIs |

Live Merchant REST APIs additionally enforce server IP whitelisting (email `support@payhere.lk` with the origin IP). From mobile apps, proxy REST calls through an intermediate server on a whitelisted domain/IP; never call REST APIs directly from a client.

The `hash`/`md5sig` computations must run server-side only. Exposing the Merchant Secret client-side compromises the account.

## Two API families

1. **Redirect / form POST APIs** — an HTML form POSTs to `/pay/*`, the customer is redirected to PayHere to enter card data, and the result is delivered to `notify_url` by server callback. Members: Checkout, Recurring, Preapproval, Authorize. The JavaScript SDK (`payhere.js`) is an onsite popup variant of Checkout.
2. **OAuth REST Merchant APIs** — direct HTTP requests to `/merchant/v1/*` secured by a Bearer access token. Members: Charging, Capture, Refund, Retrieval, Subscription Manager.

---

## Redirect/Form APIs

### Common mechanics
- Encoding: `application/x-www-form-urlencoded` (never JSON), including the notification callback.
- `notify_url` must be public (no localhost); it is a server-to-server callback and never renders in a browser.
- `return_url` receives no payment status params. Fetch status in the `notify_url` script, persist it, then display it on `return_url` from your own store.
- Consider a payment final only after `md5sig` verification succeeds.

### Outbound `hash` (redirect request)
```
hash = UPPER( md5( merchant_id + order_id + amount + currency + UPPER(md5(merchant_secret)) ) )
```
`amount` must be formatted to exactly two decimals with no thousands separator (`number_format(amount, 2, '.', '')`).

### Inbound `md5sig` (notification verification)
```
md5sig = UPPER( md5( merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(md5(merchant_secret)) ) )
```
Recompute locally from the received params + local Merchant Secret; accept only if it equals the received `md5sig`. Use the raw received `payhere_amount` and `status_code` strings; do not reformat before hashing.

### Payment status codes (redirect notifications)
`2` success · `0` pending · `-1` canceled · `-2` failed · `-3` chargedback.

### Checkout API — one-time payment
- Endpoint: `POST /pay/checkout`
- Required: `merchant_id`, `return_url`, `cancel_url`, `notify_url`, `first_name`, `last_name`, `email`, `phone`, `address`, `city`, `country`, `order_id`, `items`, `currency` (LKR/USD), `amount`, `hash`.
- Optional: `delivery_address`/`delivery_city`/`delivery_country`, line items (`item_name_N`, `item_number_N`, `amount_N`, `quantity_N`), `platform`, `custom_1`, `custom_2`, `payment_method` (bypass selection: VISA, MASTER, AMEX, HELAPAY, FRIMI, QPLUS).
- Notification params: `merchant_id`, `order_id`, `payment_id`, `payhere_amount`, `payhere_currency`, `status_code`, `md5sig`, `custom_1/2`, `method`, `status_message`; card fields when VISA/MASTER (`card_holder_name`, `card_no` masked, `card_expiry` MMYY).

### Recurring API — subscription with authorized repeat charges
- Endpoint: `POST /pay/checkout` (same as Checkout, plus recurrence fields).
- Additional required: `recurrence` (e.g. `1 Month` — number + `Week|Month|Year` singular), `duration` (`Forever` or number + unit compatible with `recurrence`).
- First payment authorizes the subscription; PayHere then notifies `notify_url` on every installment.
- Notification adds: `subscription_id`, `recurring` (1/0), `message_type` (`AUTHORIZATION_SUCCESS`, `AUTHORIZATION_FAILED`, `RECURRING_INSTALLMENT_SUCCESS`, `RECURRING_INSTALLMENT_FAILED`, `RECURRING_COMPLETE`, `RECURRING_STOPPED`), `item_recurrence`, `item_duration`, `item_rec_status` (`0` active, `-1` cancelled, `1` completed), `item_rec_date_next` (YYYY-MM-DD), `item_rec_install_paid`.
- Verification: identical `md5sig` formula. Each installment carries a distinct `payment_id` under a stable `subscription_id`.

### Preapproval API — tokenize a card for later on-demand charging
- Endpoint: `POST /pay/preapprove`
- Params mirror Checkout minus a settled amount; `hash` still required. If `amount` is omitted use `10.00` (LKR) or `1.01` (other currencies) when generating the hash; if a real `amount` is passed it is captured as a payment alongside preapproval.
- Notification adds `customer_token` (encrypted card token to store securely). Status codes: `2/0/-1/-2` (no chargeback state).
- Verification: identical `md5sig` formula. Act only after verification.

### Authorize API — Hold-on-Card authorization
- Endpoint: `POST /pay/authorize`
- Authorizes (holds) an amount and returns an authorization token via notification for later capture. Notification includes an authorization token plus standard params and card fields.

### JavaScript SDK (`payhere.js`) — onsite popup Checkout
- Include `https://www.payhere.lk/lib/payhere.js`.
- Build a payment object (same fields as Checkout, `sandbox: true` for sandbox), call `payhere.startPayment(payment)`, handle `payhere.onCompleted(orderId)`, `payhere.onDismissed()`, `payhere.onError(error)`.
- `onCompleted` fires for both success and failure; authoritative status still comes from the `notify_url` callback (same contract as Checkout).

---

## OAuth REST Merchant APIs

### Token flow (shared)
1. Create an API Key in the PayHere dashboard with the required permission; copy App ID + App Secret.
2. Authorization code = Base64(`AppID:AppSecret`).
3. `POST /merchant/v1/oauth/token`
   - Headers: `Authorization: Basic <auth_code>`, `Content-Type: application/x-www-form-urlencoded`
   - Body: `grant_type=client_credentials`
   - Response: `{ access_token, token_type: "bearer", expires_in (~599s), scope }`
4. Call endpoints with `Authorization: Bearer <access_token>`. Reuse until expiry; re-fetch only when expired.

Top-level `status`: `1` success, `-1` failed (see `msg`), `-2` authentication error. Token errors return `{ error: "invalid_token", error_description }`.

### Charging API — charge a preapproved token
- `POST /merchant/v1/payment/charge` (JSON)
- Body: `type` (`PAYMENT` default | `AUTHORIZE`), `order_id`, `items`, `currency`, `amount`, `customer_token`; optional `custom_1/2`, `notify_url`, `itemList[]`.
- Response `data`: `payment_id`, `status_code` (`2/0/-1/-2`), `status_message`, `md5sig`, `authorization_token` (non-null only when `type=AUTHORIZE`).
- Errors: invalid/expired token, invalid customer token/currency/amount, authentication error.

### Capture API — settle a Hold-on-Card authorization
- `POST /merchant/v1/payment/capture` (JSON)
- Body: `authorization_token`, plus capture amount (equal or less than authorized).
- Returns payment status params including `status_code` and `status_message`.

### Refund API — refund a payment or an authorization
- `POST /merchant/v1/payment/refund` (JSON)
- Body: `description` plus either `payment_id` (payment refund) or `authorization_token` (authorization refund); optional `amount` for partial refund.
- Response status codes: `1` success, `0` error initiating, `-1` failed. `data` holds the refund reference number.

### Retrieval API — look up successful payments
- `GET /merchant/v1/payment/search?order_id=<id>` (also searchable by other params)
- Returns matched payments with customer info, `amount_detail` (gross/fee/net/exchange), `payment_method` (method + masked card), and per-payment `status`.
- Order IDs are not enforced unique, so multiple records may return.
- Payment statuses: `RECEIVED`, `REFUND REQUESTED`, `REFUNDED` (and error status via top-level `status=-1`).

### Subscription Manager API — manage Recurring subscriptions
- List: `GET /merchant/v1/subscription`
- Payments of a subscription: `GET /merchant/v1/subscription/{subscription_id}/payments`
- Retry failed: `POST /merchant/v1/subscription/retry` — body `{ subscription_id }`. Fails if the subscription never failed or is cancelled.
- Cancel: `POST /merchant/v1/subscription/cancel` — body `{ subscription_id }`. Fails if already cancelled or completed.
- Subscription statuses (`data[i].status`): `ACTIVE`, `COMPLETED`, `FAILED`.

---

## Status code reference

| Context | Codes |
|---|---|
| Redirect payment notification (`status_code`) | `2` success · `0` pending · `-1` canceled · `-2` failed · `-3` chargedback |
| Preapproval / Authorize notification | `2` · `0` · `-1` · `-2` |
| Charging / Capture response (`status_code`) | `2` · `0` · `-1` · `-2` |
| Refund response | `1` success · `0` init error · `-1` failed |
| REST top-level (`status`) | `1` success · `-1` failed · `-2` auth error |
| Recurring `item_rec_status` | `0` active · `-1` cancelled · `1` completed |
| Recurring `message_type` | AUTHORIZATION_SUCCESS · AUTHORIZATION_FAILED · RECURRING_INSTALLMENT_SUCCESS · RECURRING_INSTALLMENT_FAILED · RECURRING_COMPLETE · RECURRING_STOPPED |
| Subscription status | ACTIVE · COMPLETED · FAILED |
| Retrieval payment status | RECEIVED · REFUND REQUESTED · REFUNDED |

## Cross-cutting constraints
- `hash` required on all redirect APIs since 2023-01-16.
- Notification bodies are form-urlencoded server callbacks; verify `md5sig` before acting; never trust `return_url` for status.
- Merchant Secret is per domain/app; App ID/Secret gate REST APIs; live REST requires IP whitelisting.
- Access tokens expire (~10 min); cache and refresh on expiry, not per request.
