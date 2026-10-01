# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Initialization Rules

- Invoke the Task Observer skill ("One Skill to Rule Them All") before the first tool call of any session and before proposing a development plan.

## Project Identity

A production-grade, multi-tenant SaaS platform for gym and fitness center management. Built with Next.js 16 (App Router), Supabase (PostgreSQL + Auth), TypeScript, and React 19.

## Core Commands

### Development

- `npm run dev` - Start Next.js development server
- `npm run build` - Build production bundle
- `npm start` - Start production server

### Testing

- `npm test` - Run Jest unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run test:integration` - Run integration tests
- `npm run test:e2e` - Run Playwright E2E tests
- `npm run test:e2e:ui` - Run E2E tests with UI

### Code Quality

- `npm run type-check` - Run TypeScript compiler without emitting files
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Database

Supabase provides migration management through the Supabase CLI or Dashboard:

- Migrations are stored in `supabase/migrations/`
- Use Supabase Studio or CLI to create and apply migrations
- Row Level Security (RLS) policies enforce multi-tenant data isolation

## Architecture Overview

### Tech Stack

- **Frontend**: Next.js 16 with App Router, React 19, TypeScript
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth with Row Level Security (RLS)
- **Realtime**: Supabase Realtime (optional)
- **Storage**: Supabase Storage (for file uploads)
- **State Management**: @tanstack/react-query
- **Validation**: Zod schemas
- **Styling**: Tailwind CSS

### Feature-First Architecture

Code is organized by **domain features**, not by technical layers. Each feature in `src/features/` should be self-contained and deletable without breaking other features.

Realized structure (2026-07 feature-first refactor — the former hexagonal
`src/core` + `src/infrastructure` + DI container were dissolved into features):

```
src/
  app/              # Next.js App Router (routes = auth + Zod validation + one service/factory call)
  components/       # SHARED UI only (ui, common, workspace, landing, auth, legal, providers, pwa)
  features/         # ALL business logic, one folder per domain:
    members/        #   components/ domain/ config/ services/ schemas/ types/ utils/ tests/ index.ts
    payments/       #   gym-member payments & day passes
    subscriptions/  #   SaaS billing (config/SubscriptionConfig.ts is the tier/status authority)
    sms/            #   providers, reminders, delivery logs
    access-control/ #   biometric door hardware (Enterprise-gated) — before
                    #   touching it, read docs/architecture/access-control-master.md,
                    #   the single source of truth for the VFT/ZKTeco integration
    auth/ announcements/ registration/ revenue/ settings/
    marketing/      #   public website: page registry, SEO metadata, JSON-LD, sitemap,
                    #   published pricing (docs/seo/SEO_AUDIT.md; rule 2.23)
  lib/              # third-party glue: supabase/, payhere/, storage/, cron/, auth/, middleware/
  hooks/            # shared React hooks
  utils/            # pure utilities: api/ (ResponseBuilder), errors/, date/, phone/, money/
```

Server composition goes through each feature's `services/factory.ts`
(`create<UseCase>(supabase)`), passing a session (`createClient`) or
service-role (`createAdminClient`) Supabase client as appropriate.

### Business Domain

The `instructions.md` file contains comprehensive business requirements including:

- Member lifecycle (registration, active, expired, cancelled)
- Membership plans (drop-in, class packs, monthly, annual, custom)
- Multi-tenant isolation (each gym operates independently via RLS)
- Authentication and authorization (Supabase Auth + RLS policies)

**Always reference `instructions.md` when implementing features.**

## Engineering Standards

### Mandatory Practices

1. **TDD Required**: Write tests before implementation (Red-Green-Refactor)
2. **Strict TypeScript**: `strict: true`, no `any` types
3. **Zod Validation**: All API inputs must be validated with Zod schemas
4. **Security Layers**: Input validation, role-based access control, database-level security

### Code Quality Rules

Detailed rules are in `.claude/rules/`:

- `architecture.md` - Feature-first structure, Twelve-Factor App compliance, type safety
- `security.md` - Input validation, RBAC, secrets management
- `testing.md` - Testing pyramid (70% unit, 20% integration, 10% E2E)
- `performance.md` - Code splitting, caching, database query optimization
- `development.md` - TDD workflow, commit message standards (Conventional Commits)
- `documentation.md` - JSDoc standards, CHANGELOG maintenance

### Workflow

1. **Before Coding**: Enter Plan Mode to understand impact and explore existing patterns
2. **Implementation**: Follow TDD cycle, reference patterns in `src/features/`
3. **Verification**: Run `npm run type-check && npm test && npm run arch:check`
4. **Commit**: Use Conventional Commits format (feat/fix/docs/test)

### Verification Directives

A green gate is evidence, not proof. Each rule below exists because this repo
shipped a defect straight through a fully passing gate.

1. **Before claiming a UI change works, render it.** `tsc`, ESLint, `arch:check`
   and 1,359 passing tests coexisted with a white `<body>`, a members toolbar
   wrapped onto three rows, and a table reading "1 records". jsdom computes no
   geometry: a screen test proves the screen mounts, never that it looks right.
   Run `npm run dev`, open the page, look at it — or say plainly that you did not.
2. **Before claiming a data change works, query the database.** Unit tests mock
   Supabase, so a column that does not exist and an RLS-refused write are both
   indistinguishable from success. SMS delivery tracking passed its tests for
   seven months while all 1,137 dispatched messages sat frozen on a column default.
3. **Before trusting a test you just wrote, make it fail.** Mutate the source to
   reintroduce the defect the test guards; if it still passes, the test is
   decorative. Three tests here passed for the wrong reason and were caught only
   this way.
4. **Report what you verified, not what you ran.** Name the check and its result.
   "Tests pass" is not a claim that the feature works.

### Git Hooks

Hooks are installed by `scripts/install-git-hooks.js` (runs automatically on
`npm install` via postinstall; husky is not used):

- `pre-commit` — runs lint-staged (ESLint --fix, Prettier, jest --findRelatedTests)
- `commit-msg` — validates Conventional Commits format
- `post-merge` — generates a draft changelog entry

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

- Supabase URL and keys (get from Supabase project settings)
- Application settings (NODE_ENV, etc.)
- Feature flags as needed

**Required variables:**

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (server-side only)

## Key Constraints

- Node >= 18.0.0, npm >= 9.0.0
- Multi-tenant: Each gym has isolated data enforced by Supabase RLS
- Row Level Security (RLS): All tables must have RLS enabled with appropriate policies
- Authentication: Use Supabase Auth for user management
- Server/Client Components: Respect Next.js 16 App Router patterns

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
