# instructions.md — Business Requirements Index

Canonical entry point for the project's business rules, required by
`.claude/rules/architecture.md` §1.1. It is a **map**, not the full spec:
detailed requirements live in the documents linked below. Read this first,
then follow the pointers for the area you are working in.

## What this product is

Metric Gym Manager is a production-grade, **multi-tenant SaaS** for gym and
fitness-center management:

- Each gym is an isolated tenant; a gym owner sees only their own data.
- Core domain: **members** (register → active → expired/suspended/cancelled),
  **payments** (per-member dues with snapshotted discounts), **plan types**,
  **discounts**, **SMS** reminders/receipts, and **announcements**.
- Platform billing is a paid SaaS subscription (PayHere) layered on top of the
  gym-facing product, with a SaaS-admin system-health surface.
- Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Supabase
  (Postgres + Auth + RLS), Zod, Tailwind. See `README.md` and `CLAUDE.md`.

## Where the detailed requirements live

| Topic | Document |
|---|---|
| Full product requirements | [`docs/product/PRD.md`](./docs/product/PRD.md) |
| System behavior reference | [`docs/reference/SYSTEM_MANUAL.md`](./docs/reference/SYSTEM_MANUAL.md) |
| Use-case catalog | [`docs/reference/USE_CASES.md`](./docs/reference/USE_CASES.md) |
| SaaS subscription/billing contract | [`docs/architecture/saas-subscription.md`](./docs/architecture/saas-subscription.md) and [`docs/reference/SAAS_SUBSCRIPTION_IMPLEMENTATION.md`](./docs/reference/SAAS_SUBSCRIPTION_IMPLEMENTATION.md) |
| Scheduled jobs | [`docs/ops/CRON_JOBS.md`](./docs/ops/CRON_JOBS.md) |
| Authentication | [`docs/reference/authentication.md`](./docs/reference/authentication.md) |

## Non-negotiable domain invariants

These hold across the whole codebase; changing one is a product decision, not a
refactor:

1. **Member statuses** are `active`, `expired`, `suspended`, `cancelled`.
   There is **no `frozen` status** (removed 2026-03-26; `suspended` now covers
   both policy holds and voluntary holds).
2. **Multi-tenant isolation** is enforced at the database by Row Level Security
   on every table — never rely on application-layer filtering alone.
3. **SaaS billing ladder** is paid-only: **Lite = 100 active members, Pro = ∞,
   Enterprise = ∞**. Only `status = 'active'` members count against the cap;
   non-active members are never quota-gated. Tiers `lite|pro|enterprise`;
   statuses `trialing|active|past_due|suspended|canceled`.
4. **Active-member quota** is enforced only via the database function
   `assert_gym_can_add_active_member` (registration goes through
   `register_member_guarded`; status flips into `active` go through the
   `trg_enforce_active_member_quota` trigger). `gyms.member_count` is the
   trigger-maintained active count.
5. **PayHere webhook** is an always-200, idempotent contract — never return a
   non-2xx that would make PayHere retry a successfully-recorded event.
6. **Billing code never deletes members.** Dunning/expiry suspend or expire;
   they do not remove data.
7. **Technical errors are never exposed to gym managers.** Infrastructure
   detail is confined to the Bearer/session-gated SaaS-admin system-health
   surface.

## Project rules

- **Conventional Commits** for every commit (`feat`/`fix`/`docs`/`refactor`/…).
- **Never** bump the version in `package.json` or edit released `CHANGELOG.md`
  sections by hand — releases are user-triggered via the versioning tooling
  (see [`docs/ops/versioning-system-guide.md`](./docs/ops/versioning-system-guide.md)).
- **TDD** (Red-Green-Refactor) and **strict TypeScript** — no `any` (use
  `unknown` then narrow); validate all API inputs with Zod.

Detailed engineering rules are in [`.claude/rules/`](./.claude/rules/).
