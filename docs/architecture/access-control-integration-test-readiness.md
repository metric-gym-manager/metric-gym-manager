# Access Control — Integration Test Readiness

**Compiled 2026-09-22** on branch `claude/access-control-integration-test-sr8t48`.
Scope: what it takes to _test_ the VFT/ZKTeco access-control integration, what
can be tested right now, and what cannot be tested at all yet.

> **Updated later the same day — B1 is largely gone and L4 has begun.** VFT
> supplied a real base URL and account login, and the two device serials were
> read back from their API with `scripts/vft-probe.ts`. The first live call
> immediately found a defect that all 394 unit assertions were blind to (§12).
> Sections 1, 6 and 9 are updated; everything else stands as compiled.

> This file is a **readiness assessment**, not a design document. The design is
> `docs/architecture/access-control-master.md` (§0 routes you to the right
> section). Nothing here supersedes it. Where this file and the master disagree,
> the disagreement is listed in §8 and the repo was the arbiter.

---

## 1. Verdict

**The software is testable; the integration is not.** _(Amended 2026-09-22:
the read half of the integration is now testable, and failed on first contact —
§12.)_

Four distinct test layers exist. Three can be run today against a mock and
prove our side of the boundary. The fourth — anything that proves the _vendor_
side — was blocked on one thing that is not code: a real `VFT_API_BASE_URL`.
That arrived. What remains blocked is every **write** and every **inbound
scan**, because no command has been sent to these readers and VFT has not yet
registered our callback URL.

| Layer                                                   | What it proves                                                            | Runnable now                                    | Blocker                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------- |
| **L1 Unit** (jest)                                      | Domain decisions, command derivation, code tables, services against fakes | ✅ after `npm install`                          | none                            |
| **L2 Integration** (jest, `jest.integration.config.js`) | Route + live-stack behaviour                                              | ⚠️ **no access-control tests exist** — see §7.1 | none technical; it is unwritten |
| **L3 E2E** (Playwright, mock provider)                  | The three screens, outbox enqueue, consent gate, RLS on real writes       | ✅ after install + `.env.local` + seeded gyms   | `.env.local` absent here (§3)   |
| **L4 Vendor** (simulator/hardware)                      | That any of it matches a real terminal                                    | ⚠️ **reads only** — see §12                     | **B6: callback not registered** |

The distinction that matters: **L1 cannot catch the highest-severity defect
class this feature has already shipped twice.** Unit tests mock the repository,
so RLS never executes; five device routes reached production writing through a
session client against SELECT-only tables and every write was refused
(master §6 defect E1, trap 21). **Only L3 catches that class.** Treat L3 as
mandatory, not optional.

---

## 2. What "testing the integration" decomposes into

Ordered by what a failure would cost.

1. **Entitlement boundary** — `requireAccessControlGym`
   (`src/lib/auth/requireAccessControlGym.ts`) fails closed; a non-Enterprise
   gym gets 403 on all 16 gym-facing routes.
2. **Tenant boundary** — a gym reaches only its own devices
   (`findDeviceById(gymId, id)`), and a webhook resolves the gym from
   `device_serial` only, **never** from the payload (trap 6).
3. **Write path / RLS** — every access-control table is SELECT-only for gym
   owners. Writes must go through `createAdminClient()`. An RLS-denied DELETE
   reports success having removed nothing (trap 21).
4. **The outbox** — DB-trigger enqueue → `FOR UPDATE SKIP LOCKED` claim →
   per-member serialisation → stale-`in_flight` reclaim → return-code
   classification deciding retry vs. dead-letter.
5. **The access decision** — `domain/AccessDecision.ts` is the sole authority;
   verdicts derive from `next_due_date`, **not** `members.status`.
6. **The consent gate** — no enrolment command reaches a reader without
   `members.biometric_consent_at`, and the write happens _first_ (trap 11).
7. **Webhook ingress** — path token is the only credential, constant-time
   compared, always-200 for business outcomes, idempotent on the unique
   constraint.
8. **Vendor truth** — endpoint paths, casing, field limits, return/event codes.
   **This is the only layer that needs hardware**, and it is the only one with
   no evidence behind it.

Items 1–7 are ours and are testable today. Item 8 is B1.

---

## 3. State of THIS container (verified 2026-09-22)

| Fact                                                                  | How verified                                                  | Consequence                                                                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node_modules` was **empty** (0 entries)                              | `ls node_modules \| wc -l`                                    | Nothing was runnable. `npm ci` run this session; see §9.                                                                                                         |
| **No `.env.local`** — only `.env.example`                             | `ls -la .env*`                                                | **Every E2E spec would skip, and a skip reports green** (trap 17). L3 cannot run until this file exists.                                                         |
| `.env.example` documents **no `E2E_*` variable**                      | `grep -c 'E2E' .env.example` → `0`                            | The E2E prerequisites are discoverable only from the master doc. See §7.3.                                                                                       |
| `VFT_API_BASE_URL` is the placeholder `https://vft.example.com`       | `.env.example:84`                                             | B1 stands.                                                                                                                                                       |
| `ACCESS_CONTROL_WEBHOOK_TOKEN` placeholder is **rejected at runtime** | `.env.example:96-101`, guard in `describeWebhookTokenProblem` | Copying `.env.example` unchanged yields an endpoint that refuses everything — indistinguishable from a wrong token (both 401).                                   |
| Chromium is pre-installed at `/opt/pw-browsers`                       | container env                                                 | Use `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium`; `playwright.config.ts:40` honours it. **Do not run `playwright install`.**                             |
| Supabase MCP server is **unauthorized** in this session               | session startup notice                                        | No live DB probe is possible from here. The CLAUDE.md directive "before claiming a data change works, query the database" cannot be satisfied in this container. |

---

## 4. Inventory — verified against the repo, not the doc

| Surface                                   | Count                                                                                                                                     | Verified by                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Migrations                                | **8** — `20260810000001/2/3`, `20260812000001`, `20260813000001`, `20260826000001/2`, `20260905000005_pin_access_control_search_path.sql` | `ls supabase/migrations/`   |
| Gym-facing routes                         | **16** `route.ts` under `src/app/api/access-control/`                                                                                     | `find … -name route.ts`     |
| Webhook route                             | 1 — `src/app/api/webhooks/access-control/[token]/route.ts`                                                                                | same                        |
| Crons                                     | 3, schedules match the doc exactly: `drain-access-sync */5 * * * *`, `reconcile-access 30 18 * * *`, `purge-access-events 0 2 * * *`      | `vercel.json`               |
| Provider glue                             | `src/lib/access-control/` — 8 source files + 4 test suites                                                                                | `find`                      |
| Feature services                          | 15 + repository + factory                                                                                                                 | `find`                      |
| Unit test suites                          | **25** in the two access-control test dirs (21 + 4)                                                                                       | `find`                      |
| E2E specs                                 | **3** (`access-control-setup`, `-dashboard`, `-member`), **20** `test(...)` declarations                                                  | `grep -cE '^\s*test'`       |
| Integration tests touching access control | **0**                                                                                                                                     | `ls tests/integration/api/` |

---

## 5. How to run each layer — exact, in this container

### L1 — unit (no prerequisites beyond install)

```bash
npx jest src/features/access-control src/lib/access-control \
  src/app/api/cron/__tests__/access-control-crons.test.ts \
  src/features/members/tests/BiometricConsentPersistence.test.ts
```

The last two live with the code they guard, not with the feature, and are easy
to miss: cron ordering, and the consent round-trip through
`SupabaseMemberRepository` (trap 12 — `update()` writes the whole row, so
dropping `biometric_consent_at` from the _read_ side silently erases consent on
every rename).

Full gate: `npm run arch:check && npx tsc --noEmit && npm test && npm run lint`.

### L3 — E2E against the mock provider

Prerequisites, **all in `.env.local`** (Playwright loads it itself via
`loadEnvConfig`; there is no second place):

```bash
E2E_ACCESS_CONTROL=1                 # without it all specs skip — and skip reports green
E2E_ENTERPRISE_GYM_EMAIL=e2e-enterprise@metricgym.test
E2E_ENTERPRISE_GYM_PASSWORD=…
E2E_LITE_GYM_EMAIL=…                 # optional; only the "not entitled" spec uses it
E2E_LITE_GYM_PASSWORD=…
ACCESS_CONTROL_ENCRYPTION_KEY=…      # MUST base64-decode to exactly 32 bytes: openssl rand -base64 32
# ACCESS_CONTROL_ENABLED unset or false — the specs assume MockAccessControlProvider
# E2E_PORT=3100 (default)
```

Plus the ordinary Supabase vars, since the specs drive a real dev server
against a real database.

```bash
# 1. Seed the gyms. Never by hand — a hand-inserted auth user leaves four token
#    columns NULL and GoTrue then fails every lookup of that user.
npm run seed:e2e

# 2. Clear the two collisions that have each cost a debugging session.
lsof -i :3100 || echo "3100 free"
pkill -f '^next-server' 2>/dev/null || echo "no orphaned dev server"   # anchor the ^ — a bare pattern kills your own shell

# 3. Prove the run is real BEFORE trusting it.
npx playwright test access-control --list    # must print the specs, not zero

# 4. Run.
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test access-control
```

**When it fails, read `test-results/<spec>/error-context.md` first — before the
stack trace.** Through all eleven causes of the 2026-08-27 debugging session the
stack trace pointed at the helper every time and the ARIA snapshot pointed at
the real fault every time.

Two seeding facts that are invisible from the app and have each burned a full
session:

- **`gyms.email_verified` must be `true`.** It is an app column, not Supabase
  auth state. Confirming the address in Supabase does nothing to it, and the
  login route answers 403.
- **Never `INSERT` the auth user by hand** — use the Admin API (which
  `seed-e2e-gyms.js` does), or set `confirmation_token`, `recovery_token`,
  `email_change` and `email_change_token_new` to `''`.

### L4 — vendor simulator

Gate is the pre-flight table in `docs/integrations/vft/vft-simulator-test-plan.md`
(~90 items, Parts A–H). **Work Part A top to bottom before anything else** —
Part A results can change the design rather than confirm it.

If the session is short, the eight that matter: A-1 (do refusals reach the
webhook at all — decides a whole screen), A-3 (`EndDate` inclusive — highest
blast radius), A-8 (does a later write disturb a block), C-1.3 (does an offline
reader still admit valid members — the core premise), B-9+B-10 (cancel then
rejoin without re-enrolling), A-4 (who assigns `EmpId`), A-10 (timezone), G-1
(webhook rejects a bad token).

---

## 6. Blockers, ranked

| #          | Blocker                                                                                  | Owner                | Blocks                                                                          | Status                                                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~B1~~     | ~~Real `VFT_API_BASE_URL` + credentials + a device serial~~                              | —                    | —                                                                               | **Done 2026-09-22** — `https://acccloudlk.com`, login held by the operator, serials `NYU7251900066` / `NYU7254500734`                                                                                                                          |
| **B6**     | VFT registers our callback URL on their account; the readers' own network reaches it     | **VFT / commercial** | Every inbound scan. `access_events` holds 0 rows and nothing can put one there. | **Open — now the whole critical path.** Our half is done and verified live (§12.1): the URL was handed over 2026-09-22 and answers correctly today.                                                                                            |
| **B7**     | Re-enter the vendor credentials through the account form, with the real base URL         | Us — operations      | Every outbound command for that gym                                             | **Open.** 660 `reconcile_member` jobs are `dead` on an AES-GCM decryption failure; the row still points at `https://vft.example.com`. See §12.                                                                                                 |
| **B4**     | Access-control env vars proven present in the **deployed** environment, not just locally | Us — infra           | Every inbound scan; every credential save                                       | **Partly done 2026-09-22.** All four exist on Vercel (`gym-management-saas`) — but scoped to **`production` only**, so every preview deployment silently falls back to the mock and refuses every webhook. Values not verified, only presence. |
| **L3-env** | No `.env.local` in this container                                                        | Us                   | All of L3 here                                                                  | **Open** — see §5                                                                                                                                                                                                                              |
| **B5**     | Promote master onto the custom domains                                                   | Us                   | Shipping the current build to real gyms                                         | **Partly stale.** The webhook route is live on `www.metricgymos.com` (§12.1), so "404 on every access-control route" no longer holds for it. The domain still serves whatever build is current — the V1 fix is **not** deployed yet.           |
| ~~B2~~     | ~~Publicly reachable deployment~~                                                        | —                    | —                                                                               | Done                                                                                                                                                                                                                                           |
| ~~B3~~     | ~~`npm run build` unverified~~                                                           | —                    | —                                                                               | Done 2026-08-27                                                                                                                                                                                                                                |

**B1 is a vendor conversation, not an engineering task.** Master §8.6 items 1,
2, 4 and 5 remain outstanding after the 2026-08-28 call: without credentials
and a serial, `ACCESS_CONTROL_ENABLED=true` has nothing to talk to.

---

## 7. Gaps found in the test estate

### 7.1 The integration tier has zero access-control coverage

`jest.integration.config.js` matches `tests/integration/**/*.test.ts`. Six files
exist — all billing (`checkout-cancel`, `dunning`, `plan-restrictions`, `quota`,
`trial-expiry`, `webhook`). **None touch access control.**

This is the tier that would sit between "repository is mocked" (L1, blind to
RLS) and "drive a browser" (L3, slow and env-heavy). The defect class that has
twice reached production — a write sent through the session client against a
SELECT-only table — is precisely what a route-level integration test against a
live stack would catch cheaply. The highest-value additions, in order:

1. `POST /api/access-control/devices` — the exact route defect E1 broke.
2. `POST /api/webhooks/access-control/[token]` — bad token → 401; unknown
   serial → counted and dropped, never attributed; duplicate delivery →
   idempotent on the unique constraint.
3. `POST /api/access-control/members/[id]/enrol` — consent written before any
   command is dispatched; absent consent → refused.

### 7.2 What E2E structurally cannot reach

`createAccessControlProvider()` returns a **new** mock per request, so nothing
it holds survives one HTTP call. `listSubjects` therefore always answers empty
and `finger_enrolled` can never flip — **the "Fingerprint registered" state is
unreachable from E2E**. Do not try to force it; the options are global mock
state (shared across the whole unit suite) or a test backdoor in the app, and
both cost more than the coverage. That leg is covered by
`useEnrolmentPoll.test.tsx` and the `DetectBiometricEnrolment` tests.

The same lifetime is _why_ the trap-9 assertion works: a reader is never marked
seen, so `unknown` is its real and correct state.

### 7.3 `.env.example` does not document the E2E variables

A fresh checkout cannot discover `E2E_ACCESS_CONTROL`,
`E2E_ENTERPRISE_GYM_EMAIL`/`_PASSWORD` or `E2E_LITE_GYM_*` from
`.env.example` — only from the master doc. Given that the failure mode is a
**silent green skip**, that is the wrong place for it to be written down.

### 7.4 One E2E leg is skipped by design

The fingerprint-withdrawal test. Recorded as an honest skip (master §8.2/8.3),
not a defect.

---

## 8. Discrepancies between the master doc and the repo

None are severe; all are recorded so the next reader does not re-derive them.

| Master doc says                                                                           | Repo shows                                                                                     | Note                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §4.1 heading: "**5 migrations**"                                                          | 7 rows are listed in the table under that heading; 8 files exist including the search-path pin | Heading is stale; the table is right.                                                                                                                                                              |
| §4.7: "**371** across 26 suites"; §8.2 table: "1,330 passing (**333** in access-control)" | **388 tests across 27 suites**, measured (§9)                                                  | The doc is both internally inconsistent (371 vs 333) and stale-low. The feature has grown since. Take §9.                                                                                          |
| §4.7: "E2E … **15 tests** across 3 specs"                                                 | **15**, confirmed by `--list`                                                                  | **No discrepancy.** Recorded because a static `grep -c '^\s*test'` over the specs returns **20** — it counts the `test.skip(condition, …)` guard lines as tests. Do not count E2E tests with grep. |

---

## 9. Measured this session

Filled from an actual run in this container on 2026-09-22, not from the doc.

| Check                            | Command                                     | Result                                                                                                                                                                          |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependencies                     | `npm ci`                                    | ✅ exit 0 (from an empty `node_modules`)                                                                                                                                        |
| **L1 access-control unit suite** | the §5 `npx jest …` command                 | ✅ **27 suites, 388 tests, 388 passed, 0 failed** — 4.8 s                                                                                                                       |
| `arch:check`                     | `npm run arch:check`                        | ✅ feature-first invariants hold                                                                                                                                                |
| `tsc --noEmit`                   | `npx tsc --noEmit`                          | ✅ exit 0, zero errors                                                                                                                                                          |
| **L3 collection**                | `npx playwright test access-control --list` | ✅ **15 tests in 3 files** — the suite collects. **This does not mean it runs:** with no `.env.local` every one of the 15 skips at runtime, and a skip reports green (trap 17). |
| L3 execution                     | —                                           | ❌ **not run.** No `.env.local`, no seeded gyms, no Supabase credentials in this container.                                                                                     |
| Live database probe              | —                                           | ❌ **not possible.** The Supabase MCP server is unauthorized in this session. No claim in this file about database state is verified against the database.                      |

`RegistrationAndLog.test.ts` prints a `console.error` from
`provisionMemberAccessBestEffort` during its run. That is the test asserting the
best-effort path logs and does not throw — expected output, not a failure.

---

## 10. The traps that specifically bite a _test_ session

The full list is master §9 (25 items). These are the ones that make a test run
lie to you:

- **17 — a test that skips reports green.** Every env-gated Playwright spec in
  this repo was skipping silently for months. Check a suite is running at all
  before trusting it.
- **18 — a lint rule that matches nothing fails the same way.** Verify a new
  rule by deliberately breaking the code and watching it fire.
- **19 — `reuseExistingServer` does not check the server is yours.** It adopts
  anything answering on the port. Hence 3100.
- **24 — a leaked `next dev` blocks later runs and names the wrong port** (3001,
  not 3100). `pkill -f '^next-server'` — anchor the `^`.
- **21 — unit tests mock the repository, so RLS never runs.** An RLS-denied
  DELETE removes zero rows and reports success.
- **25 — never narrow a vendor-table transcription to make its coverage test
  pass.** `vendorTables.test.ts` once asserted full coverage against 127 of 165
  codes and passed with 38 unclassified. Source of truth is
  `docs/integrations/vft/vft-code-tables.md`.
- **3 — do not add `reconcile-access` to `cron-schedule-order.test.ts`.** It sits
  outside the pinned chain on purpose.
- **20 — `npm run dev` dirties `public/service-worker.js`.** Expect it after any
  E2E run; do not commit the churn.

---

## 11. Recommended sequence

1. `npm ci` — nothing runs without it.
2. L1 in full. Cheap, and it establishes the baseline the rest is measured
   against.
3. Create `.env.local` (§5), `npm run seed:e2e`, then `--list` before `run`.
4. L3. Treat a green run as evidence only after confirming the test count.
5. Write the three L2 integration tests in §7.1. They are the cheapest coverage
   of the defect class that has actually shipped.
6. L4 only once B1 lands. Until then there is nothing to point at, and the
   single most valuable question in the plan — A-1, whether refused scans reach
   the webhook at all — cannot be asked.

**Treat a green result as evidence rather than confirmation.** P2 and P5 in the
simulator pre-flight were both written, reviewed, merged and unit-tested, and
both were broken until something exercised them end to end.

---

## 12. First live vendor contact (2026-09-22)

Run with `npx tsx scripts/vft-probe.ts`, which signs in and issues three `GET`s
and nothing else. It is read-only by construction: no command is enqueued, so
running it cannot change the state of a terminal.

The script exists because of one property of our client: `listDevices()` parses
with `safeParse` and returns `[]` on a shape it does not recognise. Against a
live account that is indistinguishable from "this gym owns no readers". So the
probe prints the **raw** payload beside the **parsed** result and says so
loudly when they disagree. On the first run they disagreed.

| Check                                        | Result                                                                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/user/` (trailing slash)           | ✅ 200, 160-character JWT. Base URL, credentials, path and the `ApiToken` header are all correct as built.                                                                         |
| `GET /api/device` — raw                      | ✅ 200, bare array, **2 devices**, 27 fields each                                                                                                                                  |
| `GET /api/device` — **as our client saw it** | ❌ **0 devices.** `"TimeZone": null` failed the array parse; `.optional()` rejects `null`. Fixed, re-probed, now 2. See master §6 V1–V3.                                           |
| `GET /api/template`                          | ✅ 200, empty array — no employees on the account, so no member has ever been provisioned                                                                                          |
| `GET /api/devicecmd`                         | ✅ 200, empty array — no command has ever been queued to either reader                                                                                                             |
| `access_events` (our side)                   | **0 rows.** Nothing has ever arrived from a reader.                                                                                                                                |
| `access_sync_jobs`                           | **660 rows, all `dead`**, all on `Unsupported state or unable to authenticate data` — the stored credential cannot be decrypted with the deployed key. ~10/night since 2026-08-28. |

**The serials, which is what VFT asked for:**

| Serial          | Name    | LAN IP        | Firmware               | Area           |
| --------------- | ------- | ------------- | ---------------------- | -------------- |
| `NYU7251900066` | Device1 | 192.168.8.127 | ZAM70-NF24HA-Ver3.0.15 | 1 Default Area |
| `NYU7254500734` | Device2 | 192.168.8.186 | ZAM70-NF24HA-Ver3.3.12 | 1 Default Area |

### 12.1 The callback URL — verified end to end, 2026-09-22

Handed to VFT for registration:

```
https://www.metricgymos.com/api/webhooks/access-control/<ACCESS_CONTROL_WEBHOOK_TOKEN>
```

Probed against production, not reasoned about:

| Probe                                                       | Result                                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET` the path                                              | **405** — the route is deployed. (404 would have meant the custom domain serves a build without it.) |
| `POST []` with the real token                               | **200 `{"received":true}`** — the token in the handed-over URL **equals the deployed env value**     |
| `POST []` with a wrong token                                | **401** — so the 200 above is the token matching, not the endpoint accepting anything                |
| `POST []` to `metricgymos.com` / `www.metricgymmanager.com` | **308** to the `www.metricgymos.com` form                                                            |

An empty array is a genuine no-op — `RecordAccessEvents.execute` returns on
`length === 0` before touching the database — so this probe stores nothing and
can be repeated.

**That closes the half of B4 that mattered most.** The failure it rules out is
the one with no symptom: an unset or placeholder token answers `401` to every
reader, identically to a wrong one, and nothing anywhere reports a problem.

Still true, and still why the `www` form is the one to hand over: the apex and
`www.metricgymmanager.com` answer **308**. Compliant clients preserve the method
across a 308, but embedded reader firmware frequently does not follow redirects
at all, and a dropped POST is silent on both sides.

### What this changes about the test plan

- **L4 has started, and it found something on the first call.** The readiness
  verdict above argued that only L3 can catch the RLS defect class. V1 is the
  same argument one layer further out: **only a live vendor call can catch a
  schema that does not match the vendor**, and it was invisible to 28 suites
  and 394 assertions because the mock returns what we expected. Simulator
  pre-flight items that only _read_ (A-2 among them) can be answered now.
- **A-2 is answered without hardware.** The vendor sends none of the three
  presence fields we guessed at. Presence must come from `LastRequestTime` or
  from webhook contact time; `LastUpdateTime` is a decoy.
- **A second consequence of V1, worth naming.** `RefreshDeviceStatus` compares
  our registered readers against the vendor's list, so an empty vendor list
  does not merely show nothing — it marks **every** registered reader
  `unknownToVendor`. The defect would have presented as "the vendor has never
  heard of your hardware", a far more alarming and misleading symptom than an
  empty list.
- **Everything that writes is still untested.** Sign-in and three reads are not
  evidence about `add`, `syncsometoone`, `validperiod`, `accessgrant`,
  `accessblock`, `enrollfinger`, `dooropen` or `reboot`. The first write to a
  real reader should be one whose failure is harmless, on Device2, watched from
  the vendor console.
- **Next, in order:** re-enter the credentials + real base URL through the
  account form (B7), register both serials, give VFT the callback URL (B6),
  then work the simulator pre-flight Part A against real hardware.
