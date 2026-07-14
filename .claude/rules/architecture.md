# Architecture Rules

> **Auto-loaded rulebook — keep lean.** Directives live here. Detailed patterns (code, rationale, tests, bug post-mortems) live in `docs/architecture/` and are read on demand, not injected every session. Each rule below names its reference file. When you touch that area, open the reference first.

---

## 1. Project Initialization Protocol

### 1.1 First Command Template

Initialize a production-ready `[project-type]` following these constraints.

**Stack**
- Frontend: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn UI
- Backend: Next.js API Routes / Supabase Edge Functions
- Database: PostgreSQL (via Supabase)
- Auth: Supabase Auth with RLS
- Validation: Zod schemas
- Payments: Stripe (if applicable)

**Structure** — create this exact directory layout:

```
/src
  /app              # Next.js App Router
    /(dashboard)    # Gym manager routes (standard auth)
    /(admin)        # SaaS admin routes (Bearer token auth)
      /system-health/
        page.tsx                  # System Health Dashboard
        CronStatusGrid.tsx        # Cron job monitoring component
        RawSMSFailureTable.tsx    # SMS failure tracking component
      layout.tsx                  # Admin layout with secret validation
    /api
      /members/     # Member management endpoints (JWT auth)
      /admin/       # Admin-only endpoints (Bearer token auth)
        /system-health/
          /cron-stats/route.ts    # GET cron execution logs
          /sms-failures/route.ts  # GET failed SMS with error_message
      /cron/        # Scheduled job endpoints (CRON_SECRET auth)
  /components       # Reusable UI components
  /features         # Feature-first modules (e.g., /features/subscriptions)
  /lib              # Third-party configs (stripe, supabase)
  /services         # Business logic layer
  /hooks            # React hooks
  /types            # TypeScript definitions
  /utils            # Pure utility functions
/tests              # Unit and integration tests
/docs               # Architecture decisions and API docs
```

**Route Groups & Authorization**
**Route Groups & Authorization**:
- `/(dashboard)`: Standard gym manager routes with JWT session auth
- `/(admin)`: SaaS admin routes requiring ADMIN_API_SECRET Bearer token (route group, not part of URL)
- `/api/admin/*`: Admin-only API endpoints with strict authorization checks BEFORE database queries
- **CRITICAL RULE**: The `/system-health` frontend page and `/api/admin/system-health/*` API endpoints are strictly isolated from standard gym managers and require SaaS Admin authorization. Technical infrastructure details (error messages, stack traces, database errors) are NEVER exposed to gym managers.

**Mandatory files**
MANDATORY FILES:
- .env.example (document all required variables)
- tsconfig.json (strict: true)
- instructions.md (project-specific rules)
- CHANGELOG.md
- README.md (setup instructions)

### 1.2 Environment Configuration

**Rule:** all secrets in `.env`, never committed. `.env.example` must document:

```bash
DATABASE_URL=postgresql://...

# Auth
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Payments (if applicable)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

---

## 2. Architecture Mandates

### 2.1 Twelve-Factor App Compliance

| Factor | Implementation |
|---|---|
| Codebase | Single repo tracked in Git |
| Dependencies | Explicitly declared in `package.json` |
| Config | Environment variables only |
| Backing Services | Treat DB/cache as attached resources |
| Build/Release/Run | Strict separation (Vercel/Docker) |
| Processes | Stateless, share-nothing |
| Port Binding | Self-contained (Next.js server) |
| Concurrency | Horizontal scaling via serverless |
| Disposability | Fast startup, graceful shutdown |
| Dev/Prod Parity | Same stack locally and in production |
| Logs | Stream to stdout, aggregate externally |
| Admin Processes | Run as one-off scripts (e.g. migrations) |

### 2.2 Type Safety Rules

Absolute requirements:
Absolute Requirements:

strict: true in tsconfig.json
Zero use of any (use unknown then narrow)
All API responses typed with Zod schemas
Database queries return typed results (Prisma/Drizzle/Supabase types)

```typescript
// ❌ NEVER
const user: any = await getUser();

// ✅ ALWAYS
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'trainer']),
});

type User = z.infer<typeof UserSchema>;
const user = UserSchema.parse(await getUser());
```

Enum validation (domain enums via `z.nativeEnum()`, not duplicate `z.enum()`): see `docs/architecture/enum-validation.md`.

### 2.4 Feature-First Architecture

Organize by domain, not by layer:
```
/features
  /subscriptions
    /components     # UI specific to subscriptions
    /services       # Business logic
    /hooks          # State management
    /types          # TypeScript interfaces
    /tests          # Feature tests
    index.ts        # Public API
  /attendance
    ...
```

**Rule:** a feature folder should be deletable without breaking other features.


---

## Pattern Index

Each pattern is a directive here plus full detail in a reference file. Open the reference before working in that area.

| # | Rule | Reference |
|---|---|---|
| 2.2 | Validate domain enums with `z.nativeEnum()`, never a duplicate `z.enum()` set | `docs/architecture/enum-validation.md` |
| 2.3 | All API routes build responses via the `ResponseBuilder` utility (consistent shape, typed payload, machine-readable error codes) | `docs/architecture/api-patterns.md` |
| 2.5 | Enforce entity state transitions through dedicated operational endpoints, never generic update endpoints | `docs/architecture/state-machine.md` |
| 2.5.1 | Property updates that do not change state get dedicated domain methods, separate from transitions | `docs/architecture/early-renewal.md` |
| 2.6 | Every cron job persists execution results to a DB audit log | `docs/architecture/cron-logging.md` |
| 2.7 | Every SMS send logs success and failure to the DB — no silent fire-and-forget | `docs/architecture/sms-logging.md` |
| 2.8 | Distinguish pending vs. error states to end users; sanitize technical detail before display | `docs/architecture/user-facing-errors.md` |
| 2.9 | Separate Bearer-token-protected admin dashboard for infra health; never expose technical errors to gym managers | `docs/architecture/admin-dashboard-pattern.md` |
| 2.10 | Sort time-series records by timestamp DESC before `.find()` to get the most-recent record | `docs/architecture/query-ordering.md` |
| 2.11 | Never serialize domain entities directly; use serialization helpers (YYYY-MM-DD dates, camelCase + snake_case) | `docs/architecture/api-patterns.md` |
| 2.12 | Radix Select + React 19 `useId()` mismatch mitigated with targeted `suppressHydrationWarning` | `docs/architecture/frontend-patterns.md` |
| 2.13 | SaaS billing: **PAID-ONLY** ladder Lite 100 / Pro ∞ / Enterprise ∞ **ACTIVE members** (status='active' only; non-active members unlimited), tiers lite\|pro\|enterprise, statuses trialing\|active\|past_due\|suspended\|canceled; onboarding = **trial status** (lite/trialing, 14d `TRIAL_PERIOD_DAYS`), grace 7d, complimentary=lifetime (active+no gateway+no period end) (`SubscriptionConfig.ts`); access-control hardware = sole per-tier feature gate (Enterprise), reminders/announcements universal — feature switches ONLY via the `PlanRestrictions` capability matrix; active-member quota enforced ONLY via `assert_gym_can_add_active_member` (registration through `register_member_guarded`, into-active flips through the `trg_enforce_active_member_quota` BEFORE trigger; canceled = paid-through within cap until period end, no grace; suspended blocks on every tier); `gyms.member_count` = active count, trigger-maintained; unpaid actives expire 7d past due (`MEMBER_EXPIRY_GRACE_DAYS`); PayHere webhook always-200 idempotent contract; **token billing** — checkout = Preapproval (card tokenized, `hasSavedCard` boolean only), daily `charge-renewals` cron charges `gyms.next_charge_at` via the Charging API through the `saas_charge_attempts` ledger (one pending per gym; ambiguous outcomes resolved by webhook/TTL), one-click `change-plan` switches tiers in place; period extension = `GREATEST(boundary, now()) + 1 month` (unused days BANKED, C-33); dunning + trial-expiry crons **SUSPEND (tier preserved — no downgrade landing tier)**; members never deleted by billing code | `docs/architecture/saas-subscription.md` |