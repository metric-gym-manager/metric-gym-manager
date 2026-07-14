# Comprehensive System Review & Improvement Plan

**Scope:** Full-repository analysis — architecture, framework usage, UI presentation, user flows, backend structure, database design, and codebase organization.
**Audience:** The product owner. The end consumer optimized for throughout is the **independent, everyday gym manager/owner** (per PRD: small/medium Sri Lankan gyms, single admin per gym).
**Method:** Static analysis only. No code, configuration, or data was modified. Every finding cites the file(s) it was observed in.
**Date:** 2026-07-05

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What the Product Is Today](#2-what-the-product-is-today)
3. [Current-State Assessment](#3-current-state-assessment)
   - 3.1 Architecture
   - 3.2 Backend & API Surface
   - 3.3 Database & Multi-Tenancy
   - 3.4 Security Posture
   - 3.5 Reliability & Operations
   - 3.6 UI Presentation & User Flows
   - 3.7 Codebase Organization & Hygiene
   - 3.8 Testing & Quality Gates
   - 3.9 Performance
4. [Findings Register (Severity-Ranked)](#4-findings-register-severity-ranked)
5. [The Improvement Plan](#5-the-improvement-plan)
   - Phase 0 — Security & Reliability Hotfixes
   - Phase 1 — Consolidation: One Architecture, One Truth
   - Phase 2 — UX Overhaul for the Gym Owner
   - Phase 3 — Data Model & Quality Foundation
   - Phase 4 — Growth Features
6. [What NOT to Do (Deliberate Non-Goals)](#6-what-not-to-do-deliberate-non-goals)
7. [Success Metrics](#7-success-metrics)
8. [Risk Register](#8-risk-register)

---

## 1. Executive Summary

This is a genuinely promising product with a clear, well-chosen niche: **payment collection and SMS reminders for small Sri Lankan gyms**. The domain core (member lifecycle state machine, payment calculation, immutable domain entities) is thoughtfully engineered, the multi-tenant RLS model is fundamentally sound, and the mobile-first PWA orientation is exactly right for the target market.

However, the codebase is in a **mid-migration state between three coexisting architectures**, carries **production-deployed debug endpoints that leak cross-tenant data**, exposes an **admin secret in the client JavaScript bundle**, and has a **cron configuration that almost certainly means no automated reminder has ever fired in production** — which is the product's core value proposition. The UI is competent but organized around the *system's* nouns (8 navigation items, three separate "money" sections) rather than the *gym owner's* daily loop ("who owes me money today, and how do I collect it in two taps").

The plan below is sequenced by risk: **stop the bleeding (days), consolidate (weeks), then invest in the owner experience (month two onward)**. It deliberately avoids a rewrite — the domain core is worth keeping — and instead prescribes deletion, unification, and refocusing.

**Top 5 most urgent items** (detail in §4/§5):

| # | Item | Why it's first |
|---|------|----------------|
| 1 | Remove/lock down `/api/test-*` and `/api/demo/*` routes | Unauthenticated, service-role-backed endpoints leaking all gyms' data across tenants |
| 2 | Eliminate `NEXT_PUBLIC_ADMIN_API_SECRET` | Any `NEXT_PUBLIC_` var ships in the browser bundle — the admin secret is public |
| 3 | Fix cron invocation (GET 405 in production) | Automated reminders/status updates — the core product promise — likely never run |
| 4 | Schedule the orphaned `expire-suspended-members` job | The documented state machine transition Suspended→Expired can never happen |
| 5 | Remove the `'dev-secret-key'` CRON_SECRET fallback | Fail-open auth default on privileged endpoints |

---

## 2. What the Product Is Today

From `PRD.md`, `docs/NAVIGATION_SCHEMA.md`, and the implemented routes:

- **One admin user per gym** (a `gyms` row keyed to a Supabase Auth `user_id`), managing **members** who are *not* users of the system — they exist as records and receive SMS.
- **Core loop:** register members → track `next_due_date` per plan → automated SMS reminders via Text.lk (7 days / 3 days / due date) → owner marks payments collected → revenue reporting.
- **Feature surface:** Dashboard metrics, Members CRUD (+ bulk CSV import), Fee Collection (dues / reminders / collected), Revenue charts, SMS Announcements, Plan & Discount configuration, Gym/Security settings, Support, and a Bearer-token SaaS-admin system-health dashboard.
- **Stack:** Next.js 16 App Router + React 19 + TypeScript (strict), Supabase (Postgres + Auth + RLS), TanStack Query, Zod, Tailwind + Radix/shadcn, Recharts, PWA (custom service worker + versioning GUI), Vercel deployment with `vercel.json` crons.

This is a *good* product definition. The problems are almost entirely in execution consistency, security hygiene, and UX prioritization — not in product direction.

---

## 3. Current-State Assessment

### 3.1 Architecture

**Observation: three architectural paradigms coexist, and only one is load-bearing.**

| Paradigm | Location | Status |
|---|---|---|
| Clean/hexagonal (entities, use-cases, ports, DI container) | `src/core/`, `src/infrastructure/`, `src/presentation/` | Live for member/payment/reminder flows; `src/presentation/` is **dead** (zero imports found) |
| Feature-first modules | `src/features/{members,auth,sms,revenue,settings,announcements}` | Live, but inconsistent — `members` has components+schemas but no services; others have services but no components |
| Legacy technical layering | `src/lib/services/`, `src/components/{dashboard,payment-collection,revenue,...}` | Partially live; `src/lib/services/sms.ts` is **dead** (zero imports found) |

Concrete evidence of the split:

- `src/app/api/members/route.ts` goes through the DI container (`getContainer()` → repository → domain entity), while `src/app/api/members/route.ts:100-104` *also* reaches around the repository to query `discounts` directly with a raw Supabase client — both patterns in one handler.
- **Four SMS implementations exist**, three of them live, each used by a different part of the app:
  - `src/infrastructure/sms/providers/TextLkSMSProvider.ts` — used by use-cases via DI (cron reminders, registration welcome SMS)
  - `src/features/sms/services/textlk.service.ts` — used by `announcement.service.ts` and `/api/demo/send-sms`
  - `src/features/sms/services/sms.service.ts` — used by `/api/sms/send`, `/api/sms/reminders`, `/api/test-direct-sms`
  - `src/lib/services/sms.ts` — dead code
  A change to SMS behavior (rate limiting, logging, sender ID, provider switch) currently requires finding and updating three code paths, and the per-path logging guarantees in `.claude/rules/architecture.md` §2.7 ("every SMS send logs success and failure") cannot be enforced in one place.
- The documentation mirrors the churn: `legacy_architecture.md`, `docs/NEW_ARCHITECTURE.md`, `docs/CLEAN_ARCHITECTURE.md`, and `docs/ARCHITECTURAL_SIMULATION_LEDGER.md` all describe different states of the system. `CLAUDE.md` and `README.md` both point to an **`instructions.md` that does not exist in the repository**, and `CLAUDE.md` describes feature folders (`subscriptions/`, `attendance/`, `classes/`) that were never built.

**Why this matters for the end consumer:** architectural indecision doesn't show up as an abstract "code smell" — it shows up as *inconsistent product behavior*. Example: an SMS sent by the reminder cron is logged through one pipeline, an announcement SMS through another; when a gym owner asks "did my member get the message?", the answer depends on which code path sent it. Consolidation is a customer-facing reliability investment, not a refactor for its own sake.

**What's genuinely good and must be preserved:**

- `src/core/domain/member/Member.ts` — immutable entity with enforced state transitions.
- `src/core/utils/constants/StatusConfig.ts` — an explicit, documented state machine (Active/Expired/Suspended/Cancelled with `canTransition()`), exactly the right way to encode the business rule that matters most (who owes money and what happens when they don't pay).
- `src/core/utils/constants/PlanConfig.ts` — single-source plan duration logic (correctly using calendar-month arithmetic rather than "30 days").
- Dedicated operational endpoints per state transition (`/api/members/[id]/{activate,suspend,cancel}`) instead of a generic PATCH — this prevents illegal state transitions at the API boundary.
- The `ResponseBuilder` (`src/core/utils/api/ApiResponse.ts`) consistent-envelope pattern.

### 3.2 Backend & API Surface

**~45 API route files.** Structural issues:

1. **Duplicate/overlapping namespaces.** Plans: `/api/settings/plans` *and* `/api/billing-setup/plans`. Discounts: `/api/settings/discounts`, `/api/billing-setup/discounts`, *and* `/api/discounts` — three endpoints for one resource. Payment data splits across `/api/regular-payments`, `/api/payment-collection/collected`, and `/api/members/[id]/payment`. Rationale for concern: every duplicate is a second cache key, a second validation path, and a second surface to secure; the UI already mixes them (`MembersTable.tsx:105` fetches `/api/billing-setup/plans` while the settings feature service presumably uses `/api/settings/plans`).
2. **Dual-case response serialization.** `src/app/api/members/route.ts:23-56` emits every field in *both* camelCase and snake_case "for backward compatibility". This roughly doubles member-list payload size (a real cost on Sri Lankan mobile data plans) and means neither naming convention can ever be trusted as canonical.
3. **Mixed auth helper usage.** Three overlapping helpers — `requireAuth`/`getCurrentGymProfile` (`src/lib/middleware/auth.ts`), `requireApiAuth`/`getApiGymProfile` (`src/lib/middleware/api-auth.ts`) — with routes choosing arbitrarily. Duplicated gym-profile lookups; no single place to add e.g. an account-suspended check.
4. **Error responses leak internals.** Cron routes return `error.stack` in the response body via `ResponseBuilder.internalError(..., error.stack)` (`src/app/api/cron/send-reminders/route.ts:76-80`), contradicting the project's own rule (`.claude/rules/architecture.md` §2.8: sanitize technical detail).
5. **Debug/test routes deployed with the product** — see §3.4; this is the single worst backend issue.

**What's good:** consistent Zod validation at boundaries in the newer routes, the state-transition endpoints, cron execution logging to a DB audit table (`CronLogger`), SMS failure capture with `error_message` (migration `20260328000001`), and a separate Bearer-protected system-health surface (concept is right, implementation flawed — §3.4).

### 3.3 Database & Multi-Tenancy

Schema (from `supabase/migrations/`): `gyms` (tenant root, `user_id` → auth), `members`, `payments` (immutable, insert-only — good audit design), `plan_types` + `discounts` (per-gym config), `sms_logs`, `otp_tokens`, `email_confirmations`, `cron_logs`.

**Strengths:**
- RLS on every table with ownership checks routed through `gyms.user_id = auth.uid()` (`20260211000005_enable_rls_policies.sql`) — the correct pattern for this tenancy model.
- Sensible indexing, including a partial index for the overdue query (`idx_members_overdue`).
- Payments immutability by policy omission (no UPDATE/DELETE policies) — audit-trail by construction.
- Disciplined migration history that shows real iteration (OTP hashing added, frozen status removed, reminder flags consolidated).

**Weaknesses:**

1. **Three sources of truth for "plan".** `member_plan_type` Postgres ENUM, the `PlanType` TypeScript enum + `PLAN_CONFIGS` durations (`src/core/utils/constants/PlanConfig.ts`), and the per-gym `plan_types` table. The ENUM had to be altered by migration when plans changed (`20260325000001_sync_enums...`), and a gym's "custom" plan can only be custom in *price*, never in *duration*, because duration lives in hardcoded TS config. For the end consumer this is a real product ceiling: a gym selling a "6-week bootcamp" or "10-visit pass" cannot be modeled.
2. **`otp_tokens` RLS is world-open**: `FOR INSERT WITH CHECK (true)` and `FOR SELECT USING (true)` (`20260211000005_enable_rls_policies.sql:224-232`). Hashing the codes (`20260212000001`) mitigated the worst, but any holder of the public anon key can still read/insert rows in this table (phone-number enumeration, token-spray inserts). OTP verification should be a server-only path (service role), with no anon policies at all.
3. **A stray migration sits at repo root** — `20260214000000_multi_gym_refactor.sql` outside `supabase/migrations/` — so the migration directory no longer provably describes the production schema. Whether it was applied manually is unknowable from the repo; that ambiguity is itself the problem.
4. `payments` policies route ownership through a `members` join; `gym_id` was later added to payments (`20260303000001`) but the policies were not simplified to use it — extra join per row-visibility check on the hottest reporting table.

### 3.4 Security Posture

Ranked; each item includes the evidence and the rationale.

**S1 — CRITICAL: Unauthenticated cross-tenant data exposure via test routes.**
`src/app/api/test-admin/route.ts` — no auth check, uses `createAdminClient()` (service role, bypasses RLS), returns **every gym's id and name on the platform** to any anonymous caller. `src/app/api/test-members/route.ts` — same pattern, with a **hardcoded production gym UUID**, returning that gym's member names, phone numbers, and due dates. `/api/test-direct-sms`, `/api/test-reminders`, `/api/demo/*` sit in the same deployed surface. These are debug scaffolding that shipped. *Why critical:* it is a live PII breach vector for a multi-tenant product (phone numbers of gym members), reachable by URL guessing, with no tenant boundary.

**S2 — CRITICAL: Admin secret compiled into the client bundle.**
`.env.example` documents `NEXT_PUBLIC_ADMIN_API_SECRET` alongside `ADMIN_API_SECRET`, and `src/app/(admin)/layout.tsx:24` reads the `NEXT_PUBLIC_` variant. Anything prefixed `NEXT_PUBLIC_` is embedded in the shipped JavaScript. If both vars hold the same value (as the naming implies), the Bearer token protecting `/api/admin/system-health/*` is extractable by any user who views source. The layout's own comment admits it's "dev/testing only" — but it's the deployed protection. *Why critical:* the admin surface exposes cross-tenant infrastructure data (SMS failures with raw error messages, cron stats) — exactly the data the project's rules say gym managers must never see.

**S3 — HIGH: Fail-open cron authentication.**
`src/app/api/cron/send-reminders/route.ts:20`: `const cronSecret = process.env.CRON_SECRET || 'dev-secret-key'`. If the env var is ever unset in production, the effective secret becomes a publicly known string in the repository. Privileged endpoints must fail *closed* (500/misconfigured), never fall back to a known constant.

**S4 — HIGH: World-open `otp_tokens` policies** (detail in §3.3, item 2).

**S5 — MEDIUM: Stack traces in API responses** (cron routes; §3.2 item 4).

**S6 — MEDIUM: No rate limiting visible on auth or SMS-triggering endpoints.** A `clear-rate-limits.js` script implies some mechanism exists (likely DB-based), but `/api/auth/login`, OTP issuance, and manual reminder sends are the abuse-prone surfaces; SMS sends cost real money per message, so an unthrottled reminder endpoint is a direct financial exposure for the platform operator.

**What's good:** the middleware session handling (`src/lib/middleware/auth.ts`) carefully follows the official Supabase SSR cookie pattern including the subtle response-reassignment trap; remember-me handling is deliberate; security headers (nosniff, DENY framing, referrer policy) are set in `next.config.js`; RLS is the backstop for all standard-path queries.

### 3.5 Reliability & Operations

**R1 — CRITICAL: The scheduled crons very likely never execute in production.**
`vercel.json` schedules four cron paths. **Vercel Cron invokes endpoints with GET.** Every cron route in this codebase implements the real, authenticated work in `POST` and explicitly answers GET with **405 in production** (`src/app/api/cron/update-expired-status/route.ts:83-89`, same pattern in all four). Net effect, unless an external scheduler is POSTing with the secret (nothing in the repo indicates one): members never auto-expire, overdue members are never auto-cancelled, and **no automated payment reminder is ever sent** — the product's headline feature. The `cron_logs` table gives immediate verifiability: if this diagnosis is right, it contains no production entries from Vercel-triggered runs.

**R2 — HIGH: Orphaned state-machine transition.** `src/app/api/cron/expire-suspended-members/route.ts` exists, and `StatusConfig.ts` documents "Suspended → Expired: time passes (system)" — but the job is absent from `vercel.json`. Suspended members stay suspended forever unless manually handled.

**R3 — MEDIUM: No CI pipeline.** No `.github/` directory exists. The quality gates (type-check, lint, tests) run only via local git hooks — and `.husky/` is absent too; hooks are installed by a custom `postinstall` script (`scripts/install-git-hooks.js`) into `.git/hooks`, which means a fresh clone that skips `npm install` (or any CI environment) enforces nothing. Commits titled "Update JS/React components" in the history — violating the project's own Conventional Commits mandate — confirm the hooks aren't consistently active.

**R4 — MEDIUM: No error monitoring.** No Sentry/equivalent integration found; production failures surface only if a user reports them or someone reads Vercel logs. For a product whose failures are *silent* (an SMS not sent is invisible), passive logging is insufficient — the system-health dashboard concept exists precisely because of this, but it requires someone to look at it.

### 3.6 UI Presentation & User Flows

Grounded in the persona: a gym owner, probably on an Android phone on the gym floor, with 30 seconds between customers. Their entire mental model is: **"Who owes me money? Collect it. Did my reminders go out?"**

**U1 — Information architecture is system-shaped, not owner-shaped.**
Eight top-level destinations (`src/components/layout/Sidebar.tsx:13-54`): Dashboard, Members, Revenue, Fee Collection, Announcements, Billing Setup, Settings, Support. Three of them are money-related with overlapping meanings — "Revenue" (reports), "Fee Collection" (operations), "Billing Setup" (configuration) — and "Billing Setup" reads like *the gym's SaaS subscription billing*, not "define my membership plans". A confused first-time owner has to learn the app's internal vocabulary before they can do their job.

**U2 — The mobile bottom nav scrolls.**
All 8 items render in a horizontally swipeable, snap-scrolling strip (`Sidebar.tsx:216-248`, `min-w-[80px]` each). On a typical phone, 3–4 items are off-screen with no visual affordance that more exist. Bottom navigation is the primary navigation on the primary device of the primary user; hidden destinations are effectively deleted features. Also: icons are hardcoded `text-blue-600` in both active and inactive states — only the tiny label changes color — so the "where am I" signal is weak; and labels shrink to 10px (`text-[10px]`) for long names, below comfortable legibility.

**U3 — No onboarding path from signup to first value.**
The flow today: 2-step registration (`src/app/(auth)/register/page.tsx`) → email verification → login → an empty dashboard. To get value the owner must, in the right order: configure plan types (buried in "Billing Setup", 6th nav item) → add or bulk-import members → understand reminders are automatic. Nothing sequences this. For a non-technical solo owner, the distance from "created account" to "first reminder sent" is where churn happens. There is no first-run checklist, no empty-state guidance observed at the layout level, and no sample-data mode.

**U4 — The daily loop takes too many steps.**
The dashboard cards (overdue / revenue / due-this-week / active — `DashboardClient.tsx`) are the right four numbers. But collecting a payment from the dashboard means: navigate to Members or Fee Collection → find the member → open a modal → confirm. The single most frequent action in the entire product (mark a payment collected) deserves a first-class fast path from the overdue list itself. Meanwhile `PaymentCollectionPageClient.tsx:24` defaults to the **Collected** tab — a rear-view mirror — rather than **Dues**, the actionable list.

**U5 — English-only UI for a Sinhala/Tamil-speaking market.**
Currency is localized ("Rs." prefix), phone format is +94-aware, timezone handling references Sri Lanka — but every label, button, and SMS-adjacent instruction is English. For "everyday independent gym owners" outside Colombo, this is plausibly the #1 adoption barrier. No i18n framework is present, which also means SMS templates (member-facing!) can't be per-gym language-selected.

**U6 — Parallel component forks create UX drift.**
`MemberDetailModal.tsx` (634 lines) and `MemberDetailModalMobile.tsx` (524 lines) are two hand-maintained implementations of the same feature, switched by `MemberDetailModalResponsive.tsx`. The landing page has a complete duplicate generation: `HeroSection`/`NewHeroSection`, `PricingSection`/`NewPricingSection`, `Footer`/`NewFooter`, `FeaturesSection`/`NewFeaturesSection`, `TestimonialsSection`/`NewTestimonialsSection` — the `New*` set is live (`src/app/page.tsx`), the old set is dead weight. Forked UI is how mobile and desktop users end up seeing different behavior for the same action.

**U7 — Route/URL inconsistencies.** `/make-announcement` names an action, not a place (everything else is a noun); `src/app/dashboard/layout.tsx` is a localhost-only guard layout coexisting confusingly with the `(dashboard)/dashboard` route group page — leftover scaffolding in the routing tree.

**What's good — and worth calling out explicitly:**
- The **PWA investment** (manifest, service worker, install button, update banner, versioned assets) is exactly right for this market: low-end Android, no app-store friction.
- Loading skeletons, debounced search with suggestions (`MembersTable.tsx:67-99`), optimistic-feeling React Query usage, `sonner` toasts, lazy-loaded modals via `next/dynamic` — the interaction layer is genuinely polished in places.
- Urgency-tiered overdue badges (critical/warning/mild) map well to how owners actually triage.
- The reminders tab explains the automation in plain language (`PaymentCollectionPageClient.tsx:69-73`) — good pattern, should be everywhere.

### 3.7 Codebase Organization & Hygiene

**The repository root is a working directory, not a codebase root.** At root: ~15 status/analysis artifacts (`BUILD_ERROR_ANALYSIS.txt`, `TYPE_CHECK_ERROR_ANALYSIS.txt`, `MARK_PAID_ERROR_ANALYSIS.txt`, `type-check-output.txt`, `SYSTEM_TEST_EARLY_RENEWAL_HOTFIX.txt`, `FROZEN_STATUS_REMOVAL_SUMMARY.md`, …), committed log files (`dev.log`, `.dev.log`), ad-hoc scripts (`test-reminder.js`, `test-welcome-sms.js`, stray `index.ts`), and the orphaned SQL migration. `FILE_TREE.md` describes a structure that no longer matches reality.

*Why it matters:* this isn't aesthetics. Root clutter is (a) how secrets/PII eventually get committed (log files at root are one `git add .` away from leaking), (b) a tax on every new contributor and every AI-assisted session (contradictory docs actively mislead), and (c) evidence the docs can't be trusted, which nullifies their value.

**Dead code inventory (safe deletions):** `src/presentation/**` (unused hooks layer), `src/lib/services/sms.ts`, the non-`New` landing components, old analysis artifacts at root, `/api/test-*` + `/api/demo/*` routes (after S1 remediation), duplicate discount/plan API routes (after client migration).

### 3.8 Testing & Quality Gates

The project mandates TDD with a 70/20/10 pyramid (`.claude/rules/testing.md`). Reality: **14 test files** against ~230 source files, `tests/` contains only `setup.ts`, there are **zero Playwright specs** despite full Playwright config and npm scripts, and no CI to run any of it (§3.5 R3). Coverage concentrates in the right place (domain: `Member.test.ts`, date math, status config — the money logic), which validates the core-domain design, but the API layer (auth, tenancy enforcement, serialization) and every user flow are untested.

*Rationale for concern:* the mandated-vs-actual gap is worse than having no mandate, because it creates false confidence ("the rules say TDD"). The plan (§5, Phase 3) proposes a *risk-based* target instead of the aspirational pyramid.

### 3.9 Performance

Mostly healthy for current scale:

- Good: `optimizePackageImports` for heavy libs, `next/dynamic` for modals/tabs/charts, immutable static-asset caching + correct SW no-cache headers (`next.config.js`), DB indexes matched to query patterns, React Query dedupes the double `gym-profile` fetch (Header + Sidebar share a query key).
- Concerns, in priority order:
  1. **Dual-case serialization doubles list payloads** (§3.2.2) — the cheapest meaningful win, directly relevant on mobile data.
  2. **Everything data-driven is client-fetched.** Pages render as Server Components only in the trivial sense; all data arrives via client-side React Query waterfalls (profile → metrics → lists). First meaningful paint on a mid-range phone pays JS parse + fetch round-trips. Next.js App Router's main advantage (server-rendered data with streaming) is unused.
  3. The members list does a second round-trip for discounts (`route.ts:91-112`) instead of a repository-level join — batched, so acceptable, but it belongs in `SupabaseMemberRepository`.
  4. Middleware calls `supabase.auth.getUser()` (a network call to Supabase) on every page navigation — standard pattern, but worth caching awareness as traffic grows.

---

## 4. Findings Register (Severity-Ranked)

| ID | Severity | Area | Finding | Evidence |
|----|----------|------|---------|----------|
| F-01 | **Critical** | Security | Unauthenticated service-role test routes leak cross-tenant data (all gyms; one gym's member PII via hardcoded UUID) | `src/app/api/test-admin/route.ts`, `src/app/api/test-members/route.ts` |
| F-02 | **Critical** | Security | Admin Bearer secret exposed via `NEXT_PUBLIC_ADMIN_API_SECRET` in client bundle | `.env.example:26`, `src/app/(admin)/layout.tsx:24` |
| F-03 | **Critical** | Reliability | Vercel Cron sends GET; all cron routes 405 GET in production → automated reminders/expiry likely never run | `vercel.json`, all `src/app/api/cron/*/route.ts` GET handlers |
| F-04 | **High** | Security | `CRON_SECRET` falls back to the literal `'dev-secret-key'` | `src/app/api/cron/send-reminders/route.ts:20` |
| F-05 | **High** | Security | `otp_tokens` RLS: anonymous SELECT/INSERT on the whole table | `supabase/migrations/20260211000005:224-232` |
| F-06 | **High** | Reliability | `expire-suspended-members` cron exists but is unscheduled → documented state transition unreachable | `vercel.json` vs `src/app/api/cron/expire-suspended-members/` |
| F-07 | **High** | Architecture | Three coexisting architectures; 3 live + 1 dead SMS implementations; dead `presentation/` layer | §3.1 |
| F-08 | **High** | UX | Mobile bottom nav hides half the app; 8-item IA with three overlapping "money" sections | `Sidebar.tsx:216-248` |
| F-09 | **High** | UX | No onboarding sequence from signup to first reminder sent | `(auth)/register`, absence of any first-run flow |
| F-10 | **High** | Data model | Plan concept split across DB ENUM, TS enum w/ hardcoded durations, and per-gym table; custom durations impossible | `PlanConfig.ts`, `20260211000002`, `plan_types` |
| F-11 | **Medium** | Backend | Triplicated discount endpoints, duplicated plan endpoints | `src/app/api/{discounts,settings,billing-setup}/…` |
| F-12 | **Medium** | Backend | Dual camelCase+snake_case serialization doubles payloads | `src/app/api/members/route.ts:23-56` |
| F-13 | **Medium** | Security | Stack traces returned in error responses; violates own rule 2.8 | cron routes' `ResponseBuilder.internalError(..., stack)` |
| F-14 | **Medium** | Quality | No CI; hooks unenforceable on fresh clones; non-conventional commits in history | absent `.github/`, absent `.husky/`, `git log` |
| F-15 | **Medium** | Quality | 14 test files, zero E2E specs, `tests/` empty shell — vs. mandated TDD pyramid | §3.8 |
| F-16 | **Medium** | Hygiene | Root-level clutter incl. committed logs, stray migration outside `supabase/migrations/` | §3.7 |
| F-17 | **Medium** | UX | Forked desktop/mobile member modal (1,150 combined lines); dead duplicate landing sections | `src/features/members/components/`, `src/components/landing/` |
| F-18 | **Medium** | Docs | `instructions.md` (canonical requirements per CLAUDE.md/README) missing; 4 contradictory architecture docs; stale `FILE_TREE.md` | repo root, `docs/` |
| F-19 | **Low** | UX | English-only UI for Sinhala/Tamil market (strategic gap, low severity only as a *defect*) | global |
| F-20 | **Low** | Backend | `payments` RLS still joins through `members` despite denormalized `gym_id` | `20260303000001` vs policies |
| F-21 | **Low** | UX | `/make-announcement` verb-URL; localhost-only `app/dashboard/layout.tsx` scaffolding in routing tree | `src/app/` |

---

## 5. The Improvement Plan

Sequencing philosophy: **(1) nothing else matters if data leaks or the core automation doesn't run; (2) consolidate before building, because every new feature added to three architectures multiplies future cost; (3) then spend the majority of ongoing effort on the owner experience, which is where revenue lives.** Effort labels assume one experienced full-stack developer.

### Phase 0 — Security & Reliability Hotfixes *(1–3 days; do before anything else)*

| Step | Action | Rationale |
|------|--------|-----------|
| 0.1 | **Delete** `/api/test-admin`, `/api/test-members`, `/api/test-direct-sms`, `/api/test-reminders`, `/api/demo/*` from the deployed app. Recreate needed harnesses as `scripts/` executed with explicit credentials, never as HTTP routes. | Closes the live cross-tenant leak (F-01). Debug tooling must not share an origin with production data; scripts require deliberate credential access, routes are one URL guess away. |
| 0.2 | Remove `NEXT_PUBLIC_ADMIN_API_SECRET` everywhere; keep only server-side `ADMIN_API_SECRET`; rotate the secret. Gate `(admin)` pages by server-side check (secret entered per-session or, better, a `is_platform_admin` flag on a dedicated auth user). | A secret with `NEXT_PUBLIC_` prefix is public by definition (F-02). Rotation is mandatory because the current value must be presumed compromised. |
| 0.3 | Fix cron invocation: make GET the authenticated production handler (verify `Authorization: Bearer ${CRON_SECRET}` — Vercel sends this header automatically when `CRON_SECRET` is set), keep POST for manual triggers. Then **verify via `cron_logs`** that jobs actually fire post-deploy. | Restores the core product promise (F-03). The `cron_logs` audit table the team already built is the perfect verification instrument — use it. |
| 0.4 | Add `expire-suspended-members` to `vercel.json` (e.g. `45 0 * * *`). | Makes the documented state machine true (F-06). |
| 0.5 | Delete the `'dev-secret-key'` fallback; if `CRON_SECRET` is unset, return 500 and log loudly. | Privileged endpoints fail closed (F-04). |
| 0.6 | Drop anonymous policies on `otp_tokens`; perform OTP verify/insert exclusively through server routes using the service-role client. | Removes phone-enumeration/token-spray surface (F-05); OTP flows are inherently server-mediated anyway. |
| 0.7 | Stop passing `error.stack` into responses; log server-side, return sanitized envelope. | F-13; aligns with the project's own rule 2.8. |

### Phase 1 — Consolidation: One Architecture, One Truth *(2–4 weeks)*

**1.1 Adopt and write down the target architecture (1 ADR, half a day).**
Recommendation — *feature-first modules around a shared domain core*:

- **Keep** `src/core` (domain entities, state machine, use-cases, ports) for the domains where correctness is money: members, payments, reminders. It is the best-engineered, best-tested code in the repo; discarding it would be waste, and completing "clean architecture everywhere" would be ceremony for CRUD config screens.
- **Keep** `src/infrastructure` (repositories, SMS providers, DI container) as the only place that touches Supabase for those domains.
- **Fold** simple CRUD domains (settings, announcements, revenue reads) into `src/features/<x>/` with plain service functions — no ports/DI required. *Rationale:* hexagonal machinery pays for itself only where invariants are complex; a discounts CRUD screen has none.
- **Delete** `src/presentation/` (dead) and `src/lib/services/` (dead/legacy).
- **Rule going forward:** every API route handler = auth → Zod parse → one use-case or one feature-service call → `ResponseBuilder`. No raw Supabase queries in route files (the discount lookup in `members/route.ts` moves into the repository).

**1.2 Unify SMS behind the port (3–5 days).**
`ISMSProvider` + `SupabaseSMSRepository` become the *only* send path. `announcement.service.ts` and `/api/sms/*` migrate onto it; `textlk.service.ts` and `sms.service.ts` are deleted. Add a single choke point for: per-gym rate limiting, cost accounting, guaranteed `sms_logs` writes, and a future provider/channel switch (WhatsApp — Phase 4). *Rationale:* SMS is the product's cost center and its trust center; both demand exactly one code path.

**1.3 Unify duplicated API namespaces (2–3 days).**
Canonical: `/api/plans`, `/api/discounts` (one each). The `billing-setup/*` and `settings/*` variants become 308 redirects for one release, then are removed. Simultaneously **end dual-case serialization**: canonical camelCase, one shared serializer per entity, coordinated client update (the team controls all clients — "backward compatibility" with itself is pure cost, F-12).

**1.4 Repository hygiene (1–2 days).**
Move root analysis artifacts to `docs/archive/` (or delete); remove committed logs and add to `.gitignore`; move/reconcile the stray root migration into `supabase/migrations/` **after confirming production schema state against it**; delete dead landing components and the localhost `app/dashboard/` scaffold; delete `FILE_TREE.md` (generated docs that can go stale silently are net-negative — regenerate on demand instead).

**1.5 Documentation reset (1–2 days).**
One `docs/architecture/OVERVIEW.md` (the ADR from 1.1 + a current diagram) supersedes `legacy_architecture.md`, `NEW_ARCHITECTURE.md`, `CLEAN_ARCHITECTURE.md` (archive them). Either restore `instructions.md` as the real requirements doc (PRD is a good seed) or purge references to it from `CLAUDE.md`/`README.md`. Fix `CLAUDE.md`'s phantom feature list. *Rationale:* this repo is heavily AI-agent-developed (per `.claude/` setup); for agent-driven development, stale instructions aren't just unhelpful — they actively generate wrong code.

**1.6 CI pipeline (1 day).**
GitHub Actions on PR + main: install → type-check → lint → unit tests → build. E2E smoke added in Phase 3. *Rationale:* every guarantee currently lives in optional local hooks (F-14); CI is the only enforcement point that can't be skipped, and it unblocks safe execution of Phases 2–4.

### Phase 2 — UX Overhaul for the Gym Owner *(3–5 weeks; highest product ROI)*

**2.1 Restructure the IA from 8 items to 5 (3–4 days).**

```
Home        (dashboard — today's actions, not just metrics)
Members     (list, detail, add, bulk import)
Payments    (tabs: Dues • Collected • Reminders)   ← absorbs "Fee Collection"
Announce    (announcements)
Settings    (Gym profile • Plans & Pricing • Discounts • Security • Support)
```

*Rationale per choice:* "Billing Setup" is configuration, not a daily destination — it belongs under Settings, renamed **"Plans & Pricing"** so it can't be mistaken for SaaS billing (U1). "Revenue" merges into Home (the summary card) + a "Reports" view reachable from it — a solo owner checks revenue weekly, not hourly; it doesn't earn a permanent slot. Support is a settings-level concern. Five items fit a **fixed, non-scrolling bottom nav** (U2/F-08) — every destination always visible, active state on both icon *and* label, minimum 12px labels.

**2.2 First-run onboarding checklist (1 week).**
After email verification, land on Home with a persistent 4-step card: **① Confirm gym details → ② Create your first plan → ③ Add your members (single or CSV) → ④ Reminders are on — see tomorrow's queue.** Each step deep-links; card dismisses on completion; progress persists server-side (a `gyms.onboarding_state` JSONB). *Rationale:* F-09/U3 — the current path to first value requires discovering the correct setup order across the 6th and 2nd nav items. Checklist onboarding is the lowest-engineering-cost pattern that fixes sequencing without building a wizard flow that would then need maintenance. Step ④ matters most: it converts the product's invisible automation into a visible promise.

**2.3 Two-tap collection fast path (1 week).**
Dashboard overdue card → tappable list, each row exposing **[Collect]** directly (reusing `PaymentCollectionModal` with amount pre-filled from plan+discount) and a secondary **[Remind now]**. Default the Payments page to the **Dues** tab (one-line change; U4). After collection: toast + optional **SMS receipt** to the member (one new template through the unified SMS path from 1.2). *Rationale:* mark-paid is the highest-frequency action in the product; each removed tap is a daily-compounding saving. The SMS receipt closes the trust loop for the *member* (they get proof), which protects the *owner* from disputes — a feature whose beneficiary is one step removed but whose buyer feels the value.

**2.4 Sinhala / Tamil / English localization (2–3 weeks, parallelizable).**
Adopt `next-intl` (App-Router-native, RSC-compatible); extract UI strings; per-gym language setting; **SMS templates localized per gym** (member-facing language is chosen by the gym owner, not the platform). Start with the ~6 highest-traffic screens (auth, home, members, payments) rather than exhaustive coverage. *Rationale:* F-19/U5 — for the stated persona this is a market-expansion feature, not polish; SMS language is arguably more important than UI language since members (not owners) read those. Phasing by screen bounds the cost.

**2.5 Merge the forked member-detail modals (3–4 days).**
One responsive component (Radix Dialog on desktop / bottom-sheet presentation on mobile via CSS + a thin presentational switch), single logic core. *Rationale:* U6/F-17 — 1,150 lines maintained twice guarantees behavioral drift in the app's most information-dense view.

**2.6 Empty states & plain-language explainers (2–3 days).**
Every list gets an empty state with the next action ("No members yet → Add your first member / Import from Excel"). Extend the Reminders-tab explainer pattern (`PaymentCollectionPageClient.tsx:69`) to Dues, Collected, Plans, and Announcements. *Rationale:* the target user has no onboarding buddy and no IT department; the UI is the manual. The team already writes these well — it's an extension of an existing strength, not a new competency.

### Phase 3 — Data Model & Quality Foundation *(3–4 weeks, can interleave with Phase 2)*

**3.1 Plans as data, not enums (1–1.5 weeks incl. migration).**
Add `duration_value`/`duration_unit` to `plan_types`; new `members.plan_id FK → plan_types(id)`; backfill from the enum; keep the enum column read-only for one release, then drop. `PLAN_CONFIGS` durations become seed data; date math reads the plan row. *Rationale:* F-10 — this single change unlocks genuinely custom plans (6-week programs, quarterly specials) that independent gyms actually sell, kills the triple source of truth, and removes the need for a schema migration every time the plan list changes. It is the highest-leverage data-model fix in the codebase.

**3.2 Risk-based test buildout (ongoing; ~1 week initial).**
Priorities, in order: (a) integration tests proving **tenant isolation** on every API namespace (two gyms, assert zero crossover — this is the test suite a multi-tenant product cannot ship without); (b) unit tests around payment/discount/date math (extend existing); (c) **three Playwright smoke flows**: register→verify→login, add member→see in list, mark paid→see in Collected; wire into CI. *Rationale:* replaces the aspirational 70/20/10 pyramid (F-15) with coverage ordered by cost-of-failure: cross-tenant leak > wrong money math > broken flow.

**3.3 Observability (2–3 days).**
Sentry (client+server) with PII scrubbing; alert (email/Slack) when a cron run fails or `sms_logs` failure rate spikes — the `cron_logs`/`sms_logs` infrastructure already captures the data; it just needs an active notifier. *Rationale:* R4 — silent failure is this product's characteristic failure mode; F-03 went unnoticed precisely because nothing screamed.

**3.4 Simplify `payments` RLS to use denormalized `gym_id`** (half a day; F-20) and add integration tests for it (ties into 3.2a).

### Phase 4 — Growth Features *(quarter horizon; sequence by demand signal)*

| Feature | Rationale & prerequisite |
|---|---|
| **PayHere online payments** (docs stub exists: `docs/Payhere_subscritption_integration`) | Lets members pay remotely → directly attacks the collection problem; requires the unified payment path (1.3) and receipts (2.3). Highest revenue-relevance of the growth set. |
| **WhatsApp reminders** | Sri Lanka is a WhatsApp-first market; per-message economics may beat SMS. Cleanly slots behind the `ISMSProvider` port *only if* 1.2 landed — this is the concrete payoff of that consolidation. |
| **Multi-gym accounts** | A complete blueprint already exists (`docs/multi-gym-implementation-blueprint.md`). Gate on real demand (≥N paying owners with 2+ locations); it touches tenancy, the riskiest layer. |
| **Attendance/check-in (optional module)** | Mentioned in `CLAUDE.md` but never built. Validate demand first — the PRD's "simplicity without overwhelming complexity" positioning is a *feature*; scope creep toward full gym-ERP is the main strategic risk. |

---

## 6. What NOT to Do (Deliberate Non-Goals)

Stated explicitly because each was considered and rejected:

1. **No rewrite.** The domain core is good; the problems are duplication and hygiene, which deletion and consolidation fix at ~20% of rewrite cost and near-zero regression risk to the state machine.
2. **No microservices / separate backend.** One Next.js app on Vercel + Supabase is the right shape for a solo-maintainable product at this scale. Twelve-factor compliance (already largely met) matters more than service topology.
3. **No "complete the clean architecture everywhere."** Ports/adapters for a discounts CRUD screen is ceremony. Reserve the pattern for domains with invariants (money, lifecycle) — that's where it already lives.
4. **No multi-user/RBAC yet.** PRD says single admin per gym; the RLS model reflects it. Building roles speculatively would complicate every policy and every screen for a persona that doesn't exist yet.
5. **No native mobile apps.** The PWA route is correct for this market (no store friction, instant updates via the existing update-banner system). Invest in the PWA instead.
6. **No feature expansion before Phase 0–1 complete.** Every feature added now is built three ways on a leaking foundation.

---

## 7. Success Metrics

| Area | Metric | Target |
|---|---|---|
| Reliability | Production cron runs logged in `cron_logs` | 4/4 jobs daily, 30 consecutive days |
| Security | Unauthenticated routes returning tenant data | 0 (verified by automated route-inventory test) |
| Core value | Automated reminders delivered / scheduled | > 95% (PRD's own KPI — currently unmeasurable) |
| Owner efficiency | Taps from app-open → payment recorded | ≤ 3 (today: 5–7) |
| Activation | Median time from signup → first member added | < 15 minutes |
| Activation | % of new gyms completing onboarding checklist in 7 days | > 60% |
| Payload | `/api/members` response size for 20 members | −40% (single-case serialization) |
| Quality | CI green on main; tenant-isolation suite passing | continuous |
| Codebase | Live SMS send paths | exactly 1 |

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cron fix reveals a backlog (members long-unexpired, reminders "owed") — mass SMS burst / mass status flips on first correct run | High | High | Before enabling: dry-run the use-cases against production data (read-only), cap per-run SMS volume, stagger the first executions, notify affected gym owners |
| Enum→table plan migration corrupts due-date math | Medium | High | Dual-write/read-shadow for one release; property-based tests comparing old/new date calculations; migrate `PLAN_CONFIGS` durations verbatim first |
| API namespace unification breaks the deployed PWA (stale service-worker clients calling old routes) | Medium | Medium | 308-redirect grace period one full release cycle; the existing SW update-banner system forces refresh — leverage it |
| Localization stalls at 80% and ships mixed-language screens | Medium | Medium | Screen-by-screen gating (a screen ships localized or not at all); fallback locale always English |
| Consolidation pauses feature delivery and stalls sales momentum | Medium | Medium | Phases 2 and 3 explicitly interleave; Phase 1 is capped at 4 weeks with the ADR preventing scope growth |
| Root-migration reconciliation (stray SQL) mismatches actual prod schema | Medium | High | Diff `supabase/migrations` against live schema (`supabase db diff`) before *any* new migration; treat live schema as truth |

---

*End of review. This document is analysis-only; no source files, configuration, or data were modified in its preparation.*
