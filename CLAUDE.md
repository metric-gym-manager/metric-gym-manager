# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Identity
A production-grade, multi-tenant SaaS platform for gym and fitness center management. Built with Next.js 14 (App Router), PostgreSQL, TypeScript, Stripe, and Redis.

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
- `npm run db:migrate` - Run pending migrations
- `npm run db:migrate:down` - Rollback last migration
- `npm run db:migrate:create <name>` - Create new migration file
- `npm run db:seed` - Seed database with sample data
- `npm run db:reset` - Reset database (down, up, seed)

**Note**: Uses `node-pg-migrate` for database migrations (not Supabase).

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14 with App Router, React 18, TypeScript
- **Database**: PostgreSQL with node-pg-migrate
- **Caching**: Redis (ioredis)
- **Authentication**: JWT (jsonwebtoken + bcrypt)
- **Payments**: Stripe
- **State Management**: @tanstack/react-query
- **Validation**: Zod schemas

### Feature-First Architecture
Code is organized by **domain features**, not by technical layers. Each feature in `src/features/` should be self-contained and deletable without breaking other features.

Expected structure (when implemented):
```
src/features/
  subscriptions/
    components/
    services/
    hooks/
    types/
    tests/
    index.ts
  attendance/
  classes/
  members/
```

### Business Domain
The `instructions.md` file contains comprehensive business requirements including:
- Member lifecycle (registration, active, frozen, expired, cancelled)
- Membership plans (drop-in, class packs, monthly, annual, custom)
- Class management (scheduling, booking, waitlists, cancellation policies)
- Staff roles (owner, admin, trainer, front desk)
- Billing & payments (Stripe integration, recurring billing, failed payment retry)
- Access control (QR code, RFID, check-in validation)
- Multi-tenant isolation (each gym operates independently)

**Always reference `instructions.md` when implementing member/class/billing features.**

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
3. **Verification**: Run `npm run type-check && npm test` after changes
4. **Commit**: Use Conventional Commits format (feat/fix/docs/test)

### Git Hooks
Pre-commit hooks (via husky + lint-staged) automatically:
- Fix ESLint issues
- Format with Prettier
- Run tests on changed files

## Environment Setup
Copy `.env.example` to `.env` and configure:
- Database connection (PostgreSQL, not Supabase)
- Redis connection
- JWT secrets (generate with `openssl rand -base64 32`)
- Stripe API keys
- Email service (SendGrid)
- AWS S3 for file uploads (optional)

## Key Constraints
- Node >= 18.0.0, npm >= 9.0.0
- Multi-tenant: Each gym has isolated data (members, classes, billing)
- Payment retry logic: 3 attempts over 7 days for failed payments
- Access control: Members must have `active` status to check in