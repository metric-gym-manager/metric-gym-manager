# PayHere Subscription — Production Deployment Checklist

Turnkey version of `SAAS_SUBSCRIPTION_IMPLEMENTATION.md` §7 (runbook) with the
concrete values for this project. Every item here is **owner-only**: it lives in
an external dashboard, an email approval, or the Vercel Firewall — none of it
ships in the repo. Work top to bottom; nothing here blocks a deploy, but PayHere
billing is not live until all of it is done.

- **Production domain:** `metricgymmanager.com` (also `www.metricgymmanager.com`)
- **Vercel project:** `gym-management-saas` (team `shyans-projects-7b2901b0`)
- **Webhook (notify) URL:** `https://metricgymmanager.com/api/webhooks/payhere`
- **Return / cancel URLs:** `https://metricgymmanager.com/settings/billing`

The DB migrations (`20260704000001..3`) are already applied to the production
Supabase project and verified (plan §4 acceptance — all probes pass). This
checklist is only the gateway/edge configuration that has to happen outside the
codebase.

---

## 1. Vercel environment variables

Set these on the `gym-management-saas` project (Settings → Environment
Variables → Production). Keys mirror `.env.example`; values come from the
PayHere dashboard. Never commit real values.

| Key | Value | Notes |
|---|---|---|
| `PAYHERE_MODE` | `live` | `sandbox` for the preview/staging environment |
| `PAYHERE_MERCHANT_ID` | *(dashboard)* | Integrations → your merchant id |
| `PAYHERE_MERCHANT_SECRET` | *(dashboard)* | **per-domain**, server-side only — never `NEXT_PUBLIC_*` |
| `PAYHERE_PRO_PRICE_LKR` | `4900` | must match the amount asserted in checkout |
| `PAYHERE_APP_ID` | *(dashboard)* | REST API key (Subscription Manager) |
| `PAYHERE_APP_SECRET` | *(dashboard)* | REST API secret |

After changing any of these, redeploy (env vars are read at build/runtime).

## 2. PayHere dashboard — domain whitelisting

Two **separate** whitelists in the PayHere dashboard, both keyed to
`metricgymmanager.com`:

1. **Merchant Secret** (Settings → Domains & Credentials): add
   `metricgymmanager.com`. This is what signs/verifies the `md5sig` on the
   checkout hand-off and the notify webhook. Approval can take up to 24h.
2. **API key / App** (the `PAYHERE_APP_ID`): add the same domain to the app so
   the OAuth REST calls (subscription cancel/list) are authorized.

Until (1) is approved, checkout hand-off signatures will not verify; until (2)
is, the cancel flow's gateway call fails (and, by design, leaves local state
untouched — see runbook §5).

## 3. PayHere — live REST server IP whitelisting

**Live** REST (the Subscription Manager `oauth/token` + `subscription/cancel`)
additionally requires PayHere to whitelist the **server egress IP**. Vercel
serverless functions do not have a single stable egress IP, so:

- Email `support@payhere.lk` from the merchant account to request REST access,
  providing the egress IP range. If Vercel functions cannot be pinned to a
  stable IP, route the two outbound PayHere REST calls
  (`PayHereSubscriptionGateway`) through a fixed-IP egress (a small proxy / NAT
  with a static IP) and whitelist that.
- Sandbox REST does **not** need this — cancel can be exercised end-to-end in
  sandbox first.

## 4. Vercel Firewall — per-IP rate limit on the webhook (runbook §7.3, C-27, REQUIRED)

The notify endpoint is public and its `md5sig` signs only a 5-tuple with no
timestamp (see runbook §3 threat model), so a per-IP edge rate limit is a
required compensating control. **Rate-limit — do not IP-allowlist** (PayHere
publishes no stable origin ranges).

This is a Vercel **Firewall** rule (Dashboard → project → Firewall → Rate
Limiting). It is not expressible in `vercel.json` and cannot be set through the
Vercel API tooling available to automation — create it in the dashboard:

| Field | Value |
|---|---|
| Name | `payhere-webhook-per-ip` |
| Condition | Request Path **equals** `/api/webhooks/payhere` **AND** Method **equals** `POST` |
| Rate limit key | Client IP (`ip.src`) |
| Threshold | **60 requests per 60s** per IP |
| Action when exceeded | Deny (HTTP 429) for the window |

Rationale (runbook §7.3): legitimate volume is ≈ one notification per gym per
month plus PayHere's own retries; 60/min/IP is ~5× any realistic peak and only
ever trips a flood. This bounds abuse before the request reaches the function;
the app additionally caps signature-invalid **audit rows** globally at 100/hour
(C-20, `INVALID_WEBHOOK_LOG_HOURLY_CAP`), which is a DB-write guard, not a
request limiter — the two are complementary, both are needed.

## 5. Sandbox smoke (before flipping `PAYHERE_MODE=live`)

- `notify_url` cannot be `localhost`; tunnel the dev server (e.g. ngrok) and set
  `NEXT_PUBLIC_APP_URL` to the tunnel origin so PayHere can reach the webhook.
- Drive a sandbox checkout → confirm the signed notify provisions Pro exactly
  once and a replay is a 200 no-op.
- Drive a sandbox cancel → confirm the gateway call succeeds and local state
  goes `pro/canceled`.

---

## Verification already completed in-repo (for reference)

These are done and need no action — listed so the checklist is self-contained:

- Migrations `20260704000001..3` applied to production Supabase; plan §4 DB
  acceptance probes all pass (backfill equality, one-pending-intent `23505`,
  fail-closed column-guard trigger for `authenticated` **and** a fresh
  unenumerated role, EXECUTE lockdown, dunning branches with members preserved,
  duplicate-payment-id / NULL-id index semantics, C-20 cap index-only scan).
- Integration suites (webhook idempotency / recovery-anchor / identity-guard /
  flood-cap, 60-way quota race, dunning branches, checkout race, cancel
  ordering) and the E2E billing flows (upgrade, return states, quota upsell,
  cancel, past-due banner) pass against a disposable database.
