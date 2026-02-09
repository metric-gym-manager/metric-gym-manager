1. Project Initialization Protocol
1.1 First Command Template
Initialize a production-ready [project-type] following these constraints:

STACK:
- Frontend: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn UI
- Backend: Next.js API Routes / Supabase Edge Functions
- Database: PostgreSQL (via Supabase)
- Auth: Supabase Auth with RLS
- Validation: Zod schemas
- Payments: Stripe (if applicable)

STRUCTURE:
Create this exact directory structure:
/src
  /app              # Next.js App Router
  /components       # Reusable UI components
  /features         # Feature-first modules (e.g., /features/subscriptions)
  /lib              # Third-party configs (stripe, supabase)
  /services         # Business logic layer
  /hooks            # React hooks
  /types            # TypeScript definitions
  /utils            # Pure utility functions
/tests              # Unit and integration tests
/docs               # Architecture decisions and API docs

MANDATORY FILES:
- .env.example (document all required variables)
- tsconfig.json (strict: true)
- instructions.md (project-specific rules)
- CHANGELOG.md
- README.md (setup instructions)
1.2 Environment Configuration
Rule: All secrets in .env, never committed. .env.example must document:
bash# Database
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

2. Architecture Mandates
2.1 Twelve-Factor App Compliance
FactorImplementationCodebaseSingle repo tracked in GitDependenciesExplicitly declared in package.jsonConfigEnvironment variables onlyBacking ServicesTreat DB/cache as attached resourcesBuild/Release/RunStrict separation (Vercel/Docker)ProcessesStateless, share-nothingPort BindingSelf-contained (Next.js server)ConcurrencyHorizontal scaling via serverlessDisposabilityFast startup, graceful shutdownDev/Prod ParityUse same stack locally and productionLogsStream to stdout, aggregate externallyAdmin ProcessesRun as one-off scripts (e.g., migrations)
2.2 Type Safety Rules
Absolute Requirements:

strict: true in tsconfig.json
Zero use of any (use unknown then narrow)
All API responses typed with Zod schemas
Database queries return typed results (Prisma/Drizzle/Supabase types)

Example:
typescript// ❌ NEVER
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

### 2.3 Feature-First Architecture

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
Rule: A feature folder should be deletable without breaking other features.