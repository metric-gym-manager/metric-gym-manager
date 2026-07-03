# Codebase File Tree

**Generated:** 2026-06-12
**Project:** Gym Management SaaS (Next.js 16 + React 19 + Supabase)
**Location:** `D:\projects\gym-management-saas\`

> This document (FILE_TREE.md) is self-referential and included in the codebase structure below.

---

## Directory Structure

```
gym-management-saas/
│
├── .claude/                              # Claude Code configuration and rules
│   ├── settings.json
│   ├── settings.local.json
│   └── rules/
│       ├── architecture.md               # Architecture patterns and constraints
│       ├── development.md                # TDD workflow and commit standards
│       ├── documentation.md              # JSDoc and README standards
│       ├── performance.md                # Performance targets
│       ├── security.md                   # RBAC and input validation
│       ├── testing.md                    # Testing pyramid (70/20/10)
│       └── versioning.md                 # Semantic versioning with conventional commits
│
├── .husky/                               # Git hooks configuration
│   ├── pre-commit
│   ├── post-commit
│   └── prepare-commit-msg
│
├── public/                               # Static assets and PWA resources
│   ├── favicon.svg
│   ├── logo.svg
│   ├── manifest.json                     # PWA manifest
│   ├── service-worker.js                 # Offline support
│   ├── icon-192.png                      # PWA icon (192x192)
│   ├── icon-512.png                      # PWA icon (512x512)
│   └── screenshots/                      # PWA app store screenshots
│       └── *.png
│
├── src/                                  # Source code (feature-first + clean architecture)
│   │
│   ├── app/                              # Next.js App Router (92 route files)
│   │   │
│   │   ├── (auth)/                       # Public authentication routes
│   │   │   ├── layout.tsx
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   ├── reset-password/
│   │   │   │   └── page.tsx
│   │   │   └── verify-email/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (dashboard)/                  # Gym manager routes (JWT auth)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                  # Dashboard home
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx              # Main metrics dashboard
│   │   │   │
│   │   │   ├── members/                  # Member management
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx              # Member list view
│   │   │   │   └── [id]/
│   │   │   │       ├── layout.tsx
│   │   │   │       └── page.tsx          # Member detail view
│   │   │   │
│   │   │   ├── payment-collection/       # Payment collection interface
│   │   │   │   ├── page.tsx              # Main payment page
│   │   │   │   ├── PaymentCollectionPageClient.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   └── components/
│   │   │   │       ├── RegularPaymentTable.tsx      # Regular payments tab
│   │   │   │       ├── PaymentCollectedTable.tsx    # Collected tab (new)
│   │   │   │       └── PaymentRemindersTable.tsx    # SMS reminders tab
│   │   │   │
│   │   │   ├── revenue/                  # Revenue analytics
│   │   │   │   ├── page.tsx
│   │   │   │   └── RevenuePageClient.tsx
│   │   │   │
│   │   │   ├── billing-setup/            # Plans and discounts
│   │   │   │   ├── page.tsx
│   │   │   │   ├── PlanTypesTab.tsx
│   │   │   │   └── DiscountsTab.tsx
│   │   │   │
│   │   │   ├── settings/                 # Gym settings
│   │   │   │   ├── page.tsx
│   │   │   │   ├── gym/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── security/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── plans/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── discounts/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── make-announcement/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   └── support/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (admin)/                      # SaaS admin routes (Bearer token auth)
│   │   │   ├── layout.tsx
│   │   │   └── system-health/            # Technical monitoring dashboard
│   │   │       ├── page.tsx
│   │   │       ├── CronStatusGrid.tsx    # Cron job monitoring
│   │   │       └── RawSMSFailureTable.tsx # SMS failure tracking
│   │   │
│   │   ├── api/                          # API routes (RESTful endpoints)
│   │   │   │
│   │   │   ├── auth/                     # Authentication endpoints
│   │   │   │   ├── login/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── register/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── logout/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── profile/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── forgot-password/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── reset-password/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── verify-email/
│   │   │   │   │   └── route.ts
│   │   │   │   └── resend-confirmation/
│   │   │   │       └── route.ts
│   │   │   │
│   │   │   ├── members/                  # Member management API
│   │   │   │   ├── route.ts              # GET: list, POST: register
│   │   │   │   ├── suggestions/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── bulk/
│   │   │   │   │   └── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts          # GET: detail, PUT: update
│   │   │   │       ├── detail/
│   │   │   │       │   └── route.ts
│   │   │   │       ├── activate/
│   │   │   │       │   └── route.ts      # POST: activate member
│   │   │   │       ├── suspend/
│   │   │   │       │   └── route.ts      # POST: suspend member
│   │   │   │       ├── cancel/
│   │   │   │       │   └── route.ts      # POST: cancel member
│   │   │   │       ├── payment/
│   │   │   │       │   ├── route.ts      # POST: collect payment
│   │   │   │       │   └── preview/
│   │   │   │       │       └── route.ts  # POST: preview calculation
│   │   │   │       ├── sms-history/
│   │   │   │       │   └── route.ts      # GET: SMS delivery history
│   │   │   │       └── installments/
│   │   │   │           └── route.ts      # GET: member installments
│   │   │   │
│   │   │   ├── payment-collection/       # Payment collection API
│   │   │   │   └── collected/
│   │   │   │       └── route.ts          # GET: collected payments
│   │   │   │
│   │   │   ├── admin/                    # SaaS admin API (bearer token)
│   │   │   │   └── system-health/
│   │   │   │       ├── cron-stats/
│   │   │   │       │   └── route.ts      # GET: cron execution logs
│   │   │   │       └── sms-failures/
│   │   │   │           └── route.ts      # GET: failed SMS with errors
│   │   │   │
│   │   │   ├── cron/                     # Background job endpoints
│   │   │   │   ├── send-reminders/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── cancel-overdue-members/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── expire-suspended-members/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── update-expired-status/
│   │   │   │   │   └── route.ts
│   │   │   │   └── archive-old-members/
│   │   │   │       └── route.ts
│   │   │   │
│   │   │   ├── announcements/            # Announcements management
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   │
│   │   │   ├── billing-setup/            # Plans and discounts API
│   │   │   │   ├── plans/
│   │   │   │   │   └── route.ts
│   │   │   │   └── discounts/
│   │   │   │       └── route.ts
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   └── metrics/
│   │   │   │       └── route.ts
│   │   │   │
│   │   │   ├── revenue/                  # Revenue analytics API
│   │   │   │   ├── route.ts
│   │   │   │   └── summary/
│   │   │   │       └── route.ts
│   │   │   │
│   │   │   └── settings/                 # Settings API
│   │   │       ├── gym/
│   │   │       │   └── route.ts
│   │   │       ├── security/
│   │   │       │   └── route.ts
│   │   │       └── plans/
│   │   │           └── route.ts
│   │   │
│   │   └── middleware.ts                 # Auth middleware for route protection
│   │
│   ├── core/                             # Domain layer (clean architecture)
│   │   ├── domain/                       # Domain entities and business rules
│   │   │   ├── member/
│   │   │   │   ├── Member.ts             # Member entity with state machine
│   │   │   │   ├── types.ts
│   │   │   │   └── constants.ts
│   │   │   ├── payment/
│   │   │   │   ├── Payment.ts
│   │   │   │   ├── PaymentPlan.ts
│   │   │   │   └── types.ts
│   │   │   ├── sms/
│   │   │   │   ├── SMS.ts
│   │   │   │   └── types.ts
│   │   │   └── ...
│   │   │
│   │   ├── use-cases/                    # Application workflows
│   │   │   ├── member/
│   │   │   │   ├── RegisterMember.ts
│   │   │   │   ├── SuspendMember.ts
│   │   │   │   ├── ReactivateMember.ts
│   │   │   │   └── ...
│   │   │   ├── payment/
│   │   │   │   ├── CollectPayment.ts
│   │   │   │   ├── PreviewPayment.ts
│   │   │   │   └── ...
│   │   │   ├── sms/
│   │   │   │   ├── SendAutomatedReminders.ts
│   │   │   │   └── ...
│   │   │   └── ...
│   │   │
│   │   ├── ports/                        # Repository interfaces
│   │   │   ├── IMemberRepository.ts
│   │   │   ├── IPaymentRepository.ts
│   │   │   ├── ISMSRepository.ts
│   │   │   ├── ISMSProvider.ts
│   │   │   └── ...
│   │   │
│   │   ├── utils/                        # Domain utilities
│   │   │   ├── errors.ts                 # Custom domain errors
│   │   │   ├── api/
│   │   │   │   └── ApiResponse.ts        # ResponseBuilder class
│   │   │   ├── cron/
│   │   │   │   ├── CronLogger.ts         # Cron execution auditing
│   │   │   │   └── index.ts
│   │   │   └── ...
│   │   │
│   │   └── __tests__/                    # Domain layer tests
│   │       ├── domain/
│   │       └── use-cases/
│   │
│   ├── features/                         # Feature-first modules (self-contained)
│   │   ├── members/                      # Member management feature
│   │   │   ├── components/
│   │   │   │   ├── MembersTable.tsx
│   │   │   │   ├── MemberDetailModal.tsx
│   │   │   │   ├── EditMemberModal.tsx
│   │   │   │   ├── AddMemberModal.tsx
│   │   │   │   ├── BulkAddMemberModal.tsx
│   │   │   │   └── ...
│   │   │   ├── services/
│   │   │   │   └── members.service.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useMemberList.ts
│   │   │   │   ├── useMemberDetail.ts
│   │   │   │   └── ...
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   ├── schemas/
│   │   │   │   └── member.schemas.ts
│   │   │   ├── __tests__/
│   │   │   │   └── ...
│   │   │   └── index.ts                  # Public API
│   │   │
│   │   ├── sms/                          # SMS delivery feature
│   │   │   ├── components/
│   │   │   │   └── ...
│   │   │   ├── services/
│   │   │   │   ├── sms.service.ts        # SMS status tracking
│   │   │   │   └── sms.provider.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   ├── __tests__/
│   │   │   │   └── sms.service.test.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── revenue/                      # Revenue analytics
│   │   │   ├── components/
│   │   │   │   └── RevenueChart.tsx
│   │   │   ├── services/
│   │   │   │   └── revenue.service.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   ├── __tests__/
│   │   │   │   └── ...
│   │   │   └── index.ts
│   │   │
│   │   ├── auth/                         # Authentication feature
│   │   │   ├── components/
│   │   │   │   └── ...
│   │   │   ├── services/
│   │   │   │   └── auth.service.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── settings/                     # Gym settings feature
│   │   │   ├── components/
│   │   │   │   └── ...
│   │   │   ├── services/
│   │   │   │   └── settings.service.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── announcements/                # System announcements
│   │   │   ├── components/
│   │   │   │   └── AnnouncementList.tsx
│   │   │   ├── services/
│   │   │   │   └── announcements.service.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   └── ...
│   │
│   ├── components/                       # Reusable UI components
│   │   ├── ui/                           # Shadcn UI component library
│   │   │   ├── select.tsx                # Radix Select w/ hydration fix
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── table.tsx
│   │   │   ├── form.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/                       # Layout components
│   │   │   ├── AppLayout.tsx
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── ...
│   │   │
│   │   ├── common/                       # Shared UI components
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── Pagination.tsx
│   │   │   └── ...
│   │   │
│   │   ├── dashboard/                    # Dashboard components
│   │   │   ├── MetricsGrid.tsx
│   │   │   ├── ChartCard.tsx
│   │   │   └── ...
│   │   │
│   │   ├── payment-collection/           # Payment collection components
│   │   │   ├── RegularPaymentTable.tsx   # Regular payments table
│   │   │   ├── PaymentCollectedTable.tsx # Collected tab (new)
│   │   │   ├── PaymentRemindersTable.tsx # SMS reminders tracking
│   │   │   ├── PaymentCollectionModal.tsx
│   │   │   └── ...
│   │   │
│   │   ├── revenue/                      # Revenue components
│   │   │   ├── RevenueChart.tsx
│   │   │   ├── SummaryCard.tsx
│   │   │   └── ...
│   │   │
│   │   ├── settings/                     # Settings components
│   │   │   ├── GymSettingsForm.tsx
│   │   │   ├── SecurityForm.tsx
│   │   │   ├── PlanForm.tsx
│   │   │   └── ...
│   │   │
│   │   ├── announcements/                # Announcements components
│   │   │   ├── AnnouncementForm.tsx
│   │   │   ├── AnnouncementList.tsx
│   │   │   └── ...
│   │   │
│   │   ├── providers/                    # Context providers
│   │   │   ├── AuthProvider.tsx
│   │   │   ├── ThemeProvider.tsx
│   │   │   └── QueryProvider.tsx
│   │   │
│   │   ├── pwa/                          # PWA components
│   │   │   └── UpdateBanner.tsx          # App update notification
│   │   │
│   │   └── landing/                      # Landing page components
│   │       ├── HeroSection.tsx
│   │       ├── FeatureSection.tsx
│   │       └── ...
│   │
│   ├── infrastructure/                   # Dependency injection & external services
│   │   ├── auth/
│   │   │   └── supabase.ts
│   │   ├── database/
│   │   │   ├── repositories/
│   │   │   │   ├── MemberRepository.ts
│   │   │   │   ├── PaymentRepository.ts
│   │   │   │   ├── SMSRepository.ts
│   │   │   │   └── ...
│   │   │   └── queries.ts
│   │   ├── di/
│   │   │   └── Container.ts              # Dependency injection container
│   │   ├── sms/
│   │   │   └── TextLKProvider.ts         # SMS provider integration
│   │   ├── cron/
│   │   │   └── jobs.ts
│   │   └── storage/
│   │       └── supabase.ts
│   │
│   ├── lib/                              # Third-party integrations
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Anon client
│   │   │   └── admin.ts                  # Service role client
│   │   ├── utils/
│   │   │   ├── date.ts                   # Date formatting utilities
│   │   │   ├── currency.ts               # Currency formatting
│   │   │   ├── validation.ts             # Validation helpers
│   │   │   └── ...
│   │   └── constants/
│   │       ├── StatusConfig.ts           # Member status constants
│   │       ├── PlanTypes.ts              # Plan type constants
│   │       └── ...
│   │
│   ├── hooks/                            # React custom hooks
│   │   ├── useAuth.ts
│   │   ├── useGymProfile.ts
│   │   ├── useMember.ts
│   │   ├── usePaymentCalculation.ts
│   │   └── ...
│   │
│   ├── contexts/                         # React context providers
│   │   ├── AuthContext.tsx
│   │   ├── GymContext.tsx
│   │   └── ...
│   │
│   ├── types/                            # TypeScript definitions
│   │   ├── index.ts
│   │   ├── api.ts
│   │   ├── domain.ts
│   │   ├── member.ts
│   │   ├── payment.ts
│   │   └── ...
│   │
│   ├── utils/                            # Utility functions
│   │   ├── api.ts                        # API helpers
│   │   ├── date.ts                       # Date utilities
│   │   ├── formatting.ts                 # Number/text formatting
│   │   ├── validation.ts                 # Input validation
│   │   └── ...
│   │
│   └── styles/                           # Global styles
│       └── globals.css
│
├── supabase/                             # Database migrations & configuration
│   └── migrations/                       # SQL migration files
│       ├── 001_initial_schema.sql
│       ├── 002_add_rls_policies.sql
│       ├── 003_create_sms_logs.sql
│       ├── 004_create_cron_logs.sql
│       └── ...
│
├── tests/                                # Test suite
│   ├── setup.ts                          # Test configuration
│   │
│   ├── unit/                             # Unit tests (70% target)
│   │   ├── services/
│   │   │   ├── member.service.test.ts
│   │   │   ├── payment.service.test.ts
│   │   │   ├── sms.service.test.ts
│   │   │   └── ...
│   │   ├── utils/
│   │   │   ├── date.test.ts
│   │   │   ├── currency.test.ts
│   │   │   └── ...
│   │   └── features/
│   │       ├── members/
│   │       └── ...
│   │
│   ├── integration/                      # Integration tests (20% target)
│   │   ├── api/
│   │   │   ├── members.test.ts
│   │   │   ├── payment.test.ts
│   │   │   └── ...
│   │   └── database/
│   │       └── ...
│   │
│   └── e2e/                              # End-to-end tests (10% target)
│       ├── member-flow.spec.ts
│       ├── payment-flow.spec.ts
│       └── ...
│
├── docs/                                 # Project documentation
│   ├── CLEAN_ARCHITECTURE.md             # Architecture overview
│   ├── NAVIGATION_SCHEMA.md              # App routing structure
│   ├── USE_CASES.md                      # Business workflows
│   ├── authentication.md                 # Auth implementation
│   ├── multi-gym-implementation-blueprint.md
│   ├── PAYMENT_COLLECTED_TAB_ANALYSIS.md
│   ├── PAYMENT_COLLECTED_TAB_IMPLEMENTATION_TODO.md
│   ├── TIER_IMPLEMENTATION_PLAN.md
│   ├── SYSTEM_MANUAL.md                  # System operations manual
│   ├── pwa-manifest-setup.md
│   ├── pwa-offline-support.md
│   ├── pwa-update-strategy.md
│   ├── MIGRATION_GUIDE_*.md
│   ├── UI-improvements-*.md
│   └── ...
│
├── scripts/                              # Build and utility scripts
│   ├── generate-pwa-assets.js            # PWA manifest and icons
│   ├── version-bump.js                   # Semantic version bumping
│   ├── generate-changelog.js             # Changelog generation
│   ├── install-git-hooks.js              # Git hooks setup
│   ├── identify-gym.js                   # Utility script
│   ├── apply-gym-id-migration.js         # Gym ID migration
│   ├── temp-check-member.js              # Temp utility
│   │
│   ├── hooks/                            # Git hooks
│   │   ├── pre-commit.sh
│   │   ├── post-commit.sh
│   │   └── prepare-commit-msg.sh
│   │
│   ├── versioning-gui/                   # Version manager UI
│   │   ├── server.js
│   │   ├── package.json
│   │   └── ...
│   │
│   └── bulk-members-import.csv           # Sample import data
│
├── .env.example                          # Environment variables template
├── .env.local                            # Local environment config (NOT committed)
├── .gitignore                            # Git ignore rules
├── .mcp.json                             # MCP configuration
│
├── tsconfig.json                         # TypeScript configuration (strict: true)
├── next.config.js                        # Next.js configuration
├── jest.config.js                        # Jest unit test config
├── jest.integration.config.js            # Jest integration test config
├── playwright.config.ts                  # Playwright E2E config
├── tailwind.config.ts                    # Tailwind CSS config
├── postcss.config.js                     # PostCSS config
├── eslint.config.mjs                     # ESLint config
├── .prettierrc                           # Prettier format config
├── components.json                       # Shadcn UI config
│
├── package.json                          # Project manifest & dependencies
├── package-lock.json                     # Dependency lock file
│
├── CLAUDE.md                             # Claude Code project guidance
├── SYSTEM_MANUAL.md                      # System operations manual
├── instructions.md                       # Business requirements (referenced)
├── CHANGELOG.md                          # Release notes and version history
├── README.md                             # Project overview and setup
│
├── vercel.json                           # Vercel deployment config
│
├── FILE_TREE.md                          # This file - comprehensive codebase structure
│
└── .prettierrc                           # Prettier configuration

```

---

## Key Statistics

| Metric | Value |
|--------|-------|
| **API Routes** | 92+ endpoints |
| **UI Components** | 60+ reusable components |
| **Feature Modules** | 7+ self-contained features |
| **Domain Entities** | 10+ business entities |
| **Use Cases** | 30+ application workflows |
| **Test Files** | 50+ test suites |
| **Database Tables** | 15+ with RLS policies |
| **Lines of TypeScript** | 50,000+ |

---

## Architecture Layers

### 1. **Presentation Layer** (`/components`, `/hooks`)
- React components with TypeScript
- Custom hooks for state management
- Form handling with React Hook Form + Zod

### 2. **Application Layer** (`/app/api`, `/features`)
- API routes with request validation
- Feature-specific business logic
- Use case orchestration

### 3. **Domain Layer** (`/core`)
- Pure business logic entities
- State machines and validation rules
- Use case implementations
- Error handling and domain exceptions

### 4. **Infrastructure Layer** (`/infrastructure`, `/lib`)
- Database repositories
- External service integrations (SMS, Auth)
- Dependency injection container
- Configuration management

### 5. **Data Layer** (`/supabase`)
- PostgreSQL database schema
- Row Level Security (RLS) policies
- Migration management

---

## Key Features Implemented

✅ Multi-tenant member management
✅ Payment collection with installments
✅ Automated SMS reminders
✅ Revenue analytics dashboard
✅ Plan and discount management
✅ Role-based access control (RBAC)
✅ PWA (Progressive Web App) support
✅ Real-time notifications
✅ Comprehensive error tracking
✅ Cron job monitoring
✅ Admin system health dashboard
✅ SMS delivery failure tracking

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| **Frontend Framework** | Next.js 16 (App Router) |
| **UI Library** | React 19 |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS |
| **Component Library** | Shadcn UI (Radix UI) |
| **Forms** | React Hook Form + Zod |
| **State Management** | @tanstack/react-query + React Context |
| **Backend** | Next.js API Routes |
| **Database** | PostgreSQL (Supabase) |
| **Authentication** | Supabase Auth + RLS |
| **Testing** | Jest, Playwright |
| **Code Quality** | ESLint, Prettier, TypeScript |
| **Version Control** | Git with Husky hooks |

---

## Architectural Patterns

- **Feature-First Architecture** - Self-contained, independently deletable modules
- **Clean Architecture** - Separated domain, application, and infrastructure layers
- **Dependency Injection** - Loose coupling via DI container
- **State Machine Pattern** - Explicit member lifecycle transitions
- **Response Builder Pattern** - Consistent API response formatting
- **Cron Logger Pattern** - Database-persisted job auditing
- **Multi-Cycle Query Ordering** - Correct handling of time-series data
- **Domain Entity Serialization** - Proper HTTP API formatting
- **User-Facing Error Tracking** - Sanitized UI errors with technical logging
- **SaaS Admin Dashboard** - Protected infrastructure monitoring

---

## Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server

# Building
npm run build            # Build production bundle
npm start                # Start production server

# Testing
npm test                 # Run unit tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
npm run test:integration # Run integration tests
npm run test:e2e        # Run Playwright E2E tests
npm run test:e2e:ui     # Run E2E with UI browser

# Code Quality
npm run type-check      # TypeScript compilation check
npm run lint            # Run ESLint
npm run lint:fix        # Auto-fix ESLint issues
npm run format          # Format code with Prettier
npm run format:check    # Check formatting

# Version Management
npm run version:gui     # Open version manager UI

# PWA
npm run pwa:generate    # Generate PWA assets
```

---

## Multi-Tenant Isolation

The application enforces multi-tenant isolation at multiple levels:

1. **Database Level** - Supabase RLS policies restrict data access
2. **API Level** - All routes validate gym_id from authenticated user
3. **Component Level** - UI filters data by current gym
4. **Type Level** - TypeScript enforces gym_id in all domain entities

---

## Security Layers

1. **Input Validation** - Zod schemas validate all API inputs
2. **Authentication** - Supabase Auth with JWT tokens
3. **Authorization** - RLS policies and role-based access control
4. **Rate Limiting** - Configured via Vercel
5. **Secrets Management** - Environment variables, never hardcoded
6. **Error Handling** - Technical errors hidden from end users

---

## File Tree Self-Reference

This file (`FILE_TREE.md`) documents the complete codebase structure including itself. It's located at:

```
gym-management-saas/
└── FILE_TREE.md  ← You are here
```

**Last Updated:** 2026-06-12
**Format:** Markdown (`.md`)
**Size:** Comprehensive tree covering all directories and key files
**Scope:** Root directory through `/src`, `/tests`, `/supabase`, `/scripts`, `/docs`

