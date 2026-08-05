# Metric Gym OS

A production-grade, multi-tenant SaaS platform for gym and fitness center management. Solution provided by [Holtzman Labs Software](https://holtzmanlabs.com).

## Tech Stack

- **Frontend**: Next.js 16 with App Router, React 19, TypeScript
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth with RLS
- **State Management**: @tanstack/react-query
- **Validation**: Zod schemas
- **Styling**: Tailwind CSS

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase credentials.

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000)**

## Available Commands

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

## Project Structure

```
src/
├── app/              # Next.js App Router (thin routes: auth + validation + service call)
├── components/       # Shared UI only (ui, common, layout, landing, providers, pwa, dashboard)
├── features/         # Feature-first modules — ALL business logic
│                     #   members, payments, subscriptions, sms, auth,
│                     #   announcements, registration, revenue, settings
├── lib/              # Third-party glue (supabase, payhere, storage, cron, auth, middleware)
├── hooks/            # Shared React hooks
└── utils/            # Pure utilities (ResponseBuilder, errors, date, phone, money)
```

Docs are organized under [`docs/`](./docs/README.md) by purpose
(product / reference / setup / ops / architecture / integrations / legal).

> **Growing the codebase?** Feature-first is the sole architecture and it is
> enforced. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) and the binding rulebook
> [`docs/architecture/feature-first-growth-rules.md`](./docs/architecture/feature-first-growth-rules.md)
> before adding or moving code. Structure invariants are checked by
> `npm run arch:check` (also in the pre-commit hook).

## Documentation

- See [CLAUDE.md](./CLAUDE.md) for Claude Code guidance
- See [instructions.md](./instructions.md) for business requirements
- See [docs/multi-gym-implementation-blueprint.md](./docs/product/multi-gym-implementation-blueprint.md) for future multi-gym feature implementation

## Engineering Standards

- **TDD Required**: Write tests before implementation
- **Strict TypeScript**: No `any` types allowed
- **Zod Validation**: All API inputs must be validated
- **Security Layers**: Input validation, RBAC, RLS policies

## Future Features (Planned)

### Multi-Gym Account Support
Complete implementation blueprint available for adding multi-location gym management:
- Gmail-style quick switching between gym locations
- Shared settings (plans, discounts) across organization with per-gym customization
- Aggregated analytics dashboard
- Separate billing per gym location

**Documentation**: [Multi-Gym Implementation Blueprint](./docs/product/multi-gym-implementation-blueprint.md)
**Status**: Design complete, ready for implementation
**Estimated Effort**: 6 weeks

## License

Private - All rights reserved
