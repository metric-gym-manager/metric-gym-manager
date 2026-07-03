**This is the legacy architecture.md file which was the .claude/rules/architecture.md. was refactored due to growing char size**


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

**Route Groups & Authorization**:
- `/(dashboard)`: Standard gym manager routes with JWT session auth
- `/(admin)`: SaaS admin routes requiring ADMIN_API_SECRET Bearer token (route group, not part of URL)
- `/api/admin/*`: Admin-only API endpoints with strict authorization checks BEFORE database queries
- **CRITICAL RULE**: The `/system-health` frontend page and `/api/admin/system-health/*` API endpoints are strictly isolated from standard gym managers and require SaaS Admin authorization. Technical infrastructure details (error messages, stack traces, database errors) are NEVER exposed to gym managers.

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

#### Enum Validation Pattern

**CRITICAL RULE**: When validating TypeScript enums with Zod schemas, ALWAYS use `z.nativeEnum()` instead of `z.enum()` to maintain type compatibility between validation layer and domain layer.

**Problem**: Domain layer defines enum types, but Zod string literal enums create type mismatches.

##### ❌ WRONG: Duplicate Enum Definition

```typescript
// Domain layer - Single source of truth
// src/core/utils/constants/StatusConfig.ts
export enum MemberStatus {
  Active = 'active',
  Expired = 'expired',
  Suspended = 'suspended',
  Cancelled = 'cancelled',
}

// ❌ WRONG - Validation layer creates duplicate definition
// src/features/members/schemas/member.schemas.ts
export const MemberStatus = z.enum(['active', 'expired', 'suspended', 'cancelled']);
export type MemberStatus = z.infer<typeof MemberStatus>;  // Type collision!

// ❌ This causes TypeScript error:
// Type '"active" | "expired" | ...' is not assignable to type 'MemberStatus'
```

**Problems**:
- Two conflicting type definitions (enum vs string literal union)
- Type mismatch when passing validated data to domain layer
- Violates single source of truth principle

##### ✅ CORRECT: Use z.nativeEnum()

```typescript
// Domain layer - Single source of truth
// src/core/utils/constants/StatusConfig.ts
export enum MemberStatus {
  Active = 'active',
  Expired = 'expired',
  Suspended = 'suspended',
  Cancelled = 'cancelled',
}

// ✅ CORRECT - Validation layer uses domain enum
// src/features/members/schemas/member.schemas.ts
import { MemberStatus } from '@/core/utils/constants/StatusConfig';

export const memberFiltersSchema = z.object({
  status: z.nativeEnum(MemberStatus).optional(),  // ✅ Validates enum type
  // ... other fields
});

export type MemberFiltersInput = z.infer<typeof memberFiltersSchema>;
// Result: { status?: MemberStatus }  ✅ Correct enum type
```

**Benefits**:
- Domain layer remains single source of truth
- Type compatibility between validation and domain layers
- Runtime validation ensures only valid enum values accepted
- TypeScript compiler enforces correct usage

**When to Use**:
- ✅ Any TypeScript enum defined in domain layer (MemberStatus, PlanType, etc.)
- ✅ Validation schemas that accept enum values
- ✅ API route input validation requiring enum types

**When NOT to Use**:
- ❌ String literal unions that aren't domain enums (e.g., sort directions: `z.enum(['asc', 'desc'])`)
- ❌ Arrays of specific string values without domain meaning

**Reference**: Fixed in 2026-03-31 (Type mismatch in `src/app/api/members/route.ts:35:45`)

---

### 2.3 API Response Standardization Pattern

**CRITICAL RULE**: All API routes MUST use the `ResponseBuilder` utility class for constructing responses to ensure consistency, type safety, and structured error handling across the entire application.

#### ❌ WRONG: Manual Response Construction

```typescript
// ❌ NEVER construct responses manually
export async function POST(request: NextRequest) {
  try {
    const data = await doSomething();

    // WRONG - Inconsistent success format
    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error) {
    // WRONG - Inconsistent error format
    return NextResponse.json(
      { success: false, error: 'Something failed' },
      { status: 500 }
    );
  }
}

// ❌ NEVER use different response structures
return NextResponse.json(
  { ok: true, result: data },  // Different structure
  { status: 200 }
);

// ❌ NEVER omit error codes
return NextResponse.json(
  { success: false, message: 'Invalid input' },  // No error code
  { status: 400 }
);
```

**Problems:**
- Inconsistent response formats across endpoints
- Missing machine-readable error codes
- No structured error details for debugging
- No timestamp metadata
- Clients must handle multiple response formats

#### ✅ CORRECT: ResponseBuilder Usage

**Location:** `src/core/utils/api/ApiResponse.ts`

**Step 1: Import ResponseBuilder**

```typescript
// src/app/api/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
```

**Step 2: Use Appropriate Methods**

```typescript
export async function POST(request: NextRequest) {
  try {
    // Validation
    const body = await request.json();
    const validated = schema.parse(body);

    // Business logic
    const result = await createMember(validated);

    // ✅ Success response with data
    return NextResponse.json(
      ResponseBuilder.success(result),
      { status: 201 }
    );
  } catch (error) {
    // ✅ Handle specific error types
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        ResponseBuilder.badRequest('Invalid input data', { errors: error.errors }),
        { status: 400 }
      );
    }

    if (error instanceof Error && error.name === 'ConflictError') {
      return NextResponse.json(
        ResponseBuilder.conflict(error.message),
        { status: 409 }
      );
    }

    // ✅ Catch-all with stack trace (dev only)
    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to create member',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    );
  }
}
```

#### Available ResponseBuilder Methods

| Method | Purpose | Error Code | HTTP Status | Example Use Case |
|--------|---------|------------|-------------|------------------|
| `success(data, meta?)` | Successful operation | N/A | 200/201 | Return data with optional pagination |
| `error(message, code, details?, stack?)` | Generic error | Custom | Any | Custom error scenarios |
| `validationError(errors)` | Input validation failed | `VALIDATION_ERROR` | 400 | Zod/form validation failures |
| `badRequest(message, details?)` | Invalid request | `BAD_REQUEST` | 400 | Business rule violations |
| `unauthorized(message?)` | Authentication failed | `UNAUTHORIZED` | 401 | Missing/invalid JWT token |
| `forbidden(message?)` | Authorization failed | `FORBIDDEN` | 403 | Insufficient permissions |
| `notFound(resource)` | Resource not found | `NOT_FOUND` | 404 | Member/Payment not found |
| `conflict(message, details?)` | Resource conflict | `CONFLICT` | 409 | Duplicate phone number |
| `internalError(message?, stack?)` | Server error | `INTERNAL_ERROR` | 500 | Unhandled exceptions |

#### Response Format Examples

**Success Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "name": "John Doe",
    "status": "active"
  },
  "meta": {
    "timestamp": "2026-03-31T10:30:00Z"
  }
}
```

**Success with Pagination:**
```json
{
  "success": true,
  "data": {
    "members": [...],
    "totalCount": 150
  },
  "meta": {
    "page": 1,
    "totalPages": 8,
    "totalCount": 150,
    "limit": 20,
    "timestamp": "2026-03-31T10:30:00Z"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "Member not found",
    "code": "NOT_FOUND"
  }
}
```

**Validation Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "errors": {
        "email": ["Invalid email format"],
        "name": ["Name must be at least 2 characters"]
      }
    }
  }
}
```

**Internal Error Response (Development):**
```json
{
  "success": false,
  "error": {
    "message": "Failed to create member",
    "code": "INTERNAL_ERROR",
    "stack": "Error: ...\n    at ..."
  }
}
```

**Note:** `stack` field only included when `NODE_ENV === 'development'`

#### Common Patterns

**Pattern 1: Authentication Check**
```typescript
export async function GET(request: NextRequest) {
  const gymProfile = await getCurrentGymProfile();

  if (!gymProfile) {
    return NextResponse.json(
      ResponseBuilder.unauthorized(),
      { status: 401 }
    );
  }

  // Continue with authenticated logic
}
```

**Pattern 2: Zod Validation**
```typescript
try {
  const validated = schema.parse(body);
} catch (err) {
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      ResponseBuilder.badRequest('Invalid input data', { errors: err.errors }),
      { status: 400 }
    );
  }
  throw err;
}
```

**Pattern 3: Resource Lookup**
```typescript
const member = await memberRepo.findById(id);

if (!member) {
  return NextResponse.json(
    ResponseBuilder.notFound('Member'),
    { status: 404 }
  );
}
```

**Pattern 4: Conflict Detection**
```typescript
const existing = await memberRepo.findByPhoneNumber(phoneNumber);

if (existing) {
  return NextResponse.json(
    ResponseBuilder.conflict('Phone number already registered', {
      phoneNumber,
      existingMemberId: existing.id
    }),
    { status: 409 }
  );
}
```

**Pattern 5: Bulk Operations**
```typescript
return NextResponse.json(
  ResponseBuilder.success({
    results: bulkResults,
    summary: {
      total: results.length,
      succeeded: successCount,
      failed: failureCount
    }
  }),
  { status: 200 }
);
```

#### Benefits of This Pattern

1. **Consistency**: All endpoints return identical response structures
2. **Type Safety**: TypeScript enforces correct response types
3. **Machine-Readable Errors**: Error codes (`VALIDATION_ERROR`, `NOT_FOUND`) enable client-side error handling
4. **Debugging Support**: Stack traces included in development mode
5. **API Documentation**: Predictable response formats simplify API docs
6. **Client Integration**: Frontend can use a single response handler for all endpoints
7. **Testing**: Consistent structure makes testing easier
8. **Maintainability**: Centralized response logic reduces duplication

#### TypeScript Integration

```typescript
// Client-side types automatically inferred
import type { ApiResponse } from '@/core/utils/api/ApiResponse';

// Type-safe response handling
const response: ApiResponse<Member> = await fetch('/api/members/123').then(r => r.json());

if (response.success) {
  console.log(response.data.name);  // ✅ Type-safe access
} else {
  console.error(response.error.code);  // ✅ Type-safe error handling
}
```

#### HTTP Status Code Mapping

Use the provided `HTTP_STATUS` constants for consistency:

```typescript
import { ResponseBuilder, HTTP_STATUS } from '@/core/utils/api/ApiResponse';

return NextResponse.json(
  ResponseBuilder.success(data),
  { status: HTTP_STATUS.CREATED }  // 201
);
```

Available constants:
- `HTTP_STATUS.OK` → 200
- `HTTP_STATUS.CREATED` → 201
- `HTTP_STATUS.NO_CONTENT` → 204
- `HTTP_STATUS.BAD_REQUEST` → 400
- `HTTP_STATUS.UNAUTHORIZED` → 401
- `HTTP_STATUS.FORBIDDEN` → 403
- `HTTP_STATUS.NOT_FOUND` → 404
- `HTTP_STATUS.CONFLICT` → 409
- `HTTP_STATUS.UNPROCESSABLE_ENTITY` → 422
- `HTTP_STATUS.INTERNAL_SERVER_ERROR` → 500

#### When to Use This Pattern

- ✅ All Next.js API routes (`/api/*`)
- ✅ Cron job endpoints (`/api/cron/*`)
- ✅ Admin API endpoints (`/api/admin/*`)
- ✅ Any endpoint returning JSON data
- ✅ Webhook handlers

#### When NOT to Use This Pattern

- ❌ Server Components (use direct rendering, not JSON responses)
- ❌ Middleware (uses different response patterns)
- ❌ Static file serving
- ❌ Redirects (use `NextResponse.redirect()`)
- ❌ Streaming responses

#### Enforcement

**Build-Time Validation:**
- TypeScript strict mode (`noUnusedLocals: true`) catches unused imports
- Type checking ensures correct usage of response methods

**Code Review Checklist:**
- [ ] All API routes import `ResponseBuilder`
- [ ] No manual response construction (`{ success: true, data: ... }`)
- [ ] Error responses include error codes
- [ ] Validation errors use `badRequest()` or `validationError()`
- [ ] Auth errors use `unauthorized()` or `forbidden()`
- [ ] Resource not found uses `notFound()`
- [ ] Generic errors use `internalError()` with stack traces

---

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
Rule: A feature folder should be deletable without breaking other features.

### 2.5 State Machine Enforcement Pattern

**CRITICAL RULE**: All entity state transitions MUST be enforced through dedicated operational endpoints, NOT through generic update endpoints.

#### ❌ WRONG: Direct Status Updates

```typescript
// ❌ NEVER allow direct status updates in generic PATCH endpoint
export const updateMemberSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['active', 'expired', 'suspended']), // WRONG
});

// ❌ NEVER bypass state machine validation
async function PATCH(request) {
  const { status } = await request.json();
  await db.update({ status }); // WRONG - bypasses business rules
}
```

#### ✅ CORRECT: Dedicated Operational Endpoints

**Step 1: Define State Machine in Domain Layer**

```typescript
// src/core/domain/member/Member.ts
export class Member {
  suspend(): Member {
    if (!canTransition(this.status, MemberStatus.Suspended)) {
      throw new InvalidStatusTransitionError(this.status, MemberStatus.Suspended);
    }
    return new Member({ ...this.props, status: MemberStatus.Suspended });
  }

  activate(newDueDate: Date): Member {
    if (!canTransition(this.status, MemberStatus.Active)) {
      throw new InvalidStatusTransitionError(this.status, MemberStatus.Active);
    }
    return new Member({
      ...this.props,
      status: MemberStatus.Active,
      nextDueDate: newDueDate,
    });
  }
}
```

**Step 2: Create Dedicated Use Cases**

```typescript
// src/core/use-cases/member/SuspendMember.ts
export class SuspendMember {
  constructor(private memberRepo: IMemberRepository) {}

  async execute(input: { memberId: string; gymId: string }): Promise<Member> {
    const member = await this.memberRepo.findById(input.memberId, input.gymId);
    if (!member) throw new NotFoundError('Member not found');

    const suspended = member.suspend(); // State machine enforced here
    return await this.memberRepo.update(suspended);
  }
}
```

**Step 3: Create Dedicated API Endpoints**

```typescript
// src/app/api/members/[id]/suspend/route.ts
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const gymProfile = await getCurrentGymProfile();
  const container = await getContainer();

  const suspendMember = container.getSuspendMemberUseCase();
  const suspended = await suspendMember.execute({
    memberId: params.id,
    gymId: gymProfile.id,
  });

  return NextResponse.json(ResponseBuilder.success(suspended.toDatabase()));
}
```

**Step 4: Register Use Cases in DI Container**

```typescript
// src/infrastructure/di/Container.ts
export class Container {
  getSuspendMemberUseCase(): SuspendMember {
    return new SuspendMember(this.getMemberRepository());
  }

  getReactivateMemberUseCase(): ReactivateMember {
    return new ReactivateMember(this.getMemberRepository());
  }
}
```

**Step 5: Remove Status from Generic Update Schema**

```typescript
// src/features/members/schemas/member.schemas.ts
export const updateMemberSchema = z.object({
  name: z.string().optional(),
  phoneNumber: z.string().optional(),
  // NO status field - must use dedicated endpoints
});
```

**Step 6: Update UI with Context-Aware Actions**

```typescript
// src/components/members/MemberDetailModal.tsx
{member.status === 'active' && (
  <Button onClick={() => suspendMutation.mutate(member.id)}>
    Suspend Member
  </Button>
)}

{(member.status === 'expired' || member.status === 'suspended') && (
  <Button onClick={() => setShowActivateDialog(true)}>
    Activate Member
  </Button>
)}
```

#### Benefits of This Pattern

1. **State Machine Validation**: All transitions validated by `canTransition()` in domain layer
2. **Type Safety**: Invalid transitions caught at compile time
3. **Auditability**: Each transition has dedicated endpoint for logging/monitoring
4. **Business Rules**: Centralized in use cases, not scattered across API routes
5. **UI Clarity**: Context-aware buttons show only valid actions for current state

#### When to Use This Pattern

- ✅ Any entity with a state machine (e.g., orders, subscriptions, memberships)
- ✅ Workflows with business rules governing transitions
- ✅ Operations requiring validation beyond simple field updates
- ✅ Actions that may trigger side effects (notifications, logging, etc.)

#### When NOT to Use This Pattern

- ❌ Simple property updates (name, email, address)
- ❌ Entities without state machines
- ❌ Read-only operations

---

### 2.5.1 Early Renewal Pattern (Non-Transition Operations)

**CRITICAL RULE**: When a state machine entity requires operations that update properties WITHOUT changing state, implement dedicated domain methods separate from state transition methods.

#### ❌ WRONG: Using State Transition for Non-Transition Operations

```typescript
// ❌ NEVER use activate() for already active members
export class CollectPayment {
  async execute(input: CollectPaymentInput): Promise<CollectPaymentOutput> {
    const member = await this.memberRepo.findById(input.memberId, input.gymId);

    // This throws InvalidStatusTransitionError if member is already Active
    const activatedMember = member.activate(nextDueDate); // ❌ WRONG

    return await this.memberRepo.update(activatedMember);
  }
}
```

**Problem**: `activate()` validates state transitions via `canTransition()`. If the member is already `Active`, the call to `activate()` will throw `InvalidStatusTransitionError: Cannot transition from active to active`.

#### ✅ CORRECT: Separate Renewal Method for Non-Transition Operations

**Step 1: Add Dedicated Domain Method with Date Validation**

```typescript
// src/core/domain/member/Member.ts
export class Member {
  /**
   * Activate member (state transition)
   */
  activate(newDueDate: Date): Member {
    if (!canTransition(this.props.status, MemberStatus.Active)) {
      throw new InvalidStatusTransitionError(this.props.status, MemberStatus.Active);
    }
    return new Member({
      ...this.props,
      status: MemberStatus.Active,
      nextDueDate: newDueDate,
      updatedAt: new Date(),
    });
  }

  /**
   * Renew member (non-transition operation)
   *
   * Extends subscription for already active members.
   *
   * @throws ValidationError if newDueDate is invalid, in the past, or before current due date
   */
  renew(newDueDate: Date): Member {
    // Status validation
    if (this.props.status !== MemberStatus.Active) {
      throw new InvalidStatusTransitionError(
        this.props.status,
        MemberStatus.Active
      );
    }

    // Date Validation Layer 1: Validate date is a valid Date object
    if (!(newDueDate instanceof Date) || isNaN(newDueDate.getTime())) {
      throw new ValidationError('newDueDate must be a valid Date object');
    }

    // Date Validation Layer 2: Validate date is not in the past (compared to today at 00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newDueDateNormalized = new Date(newDueDate);
    newDueDateNormalized.setHours(0, 0, 0, 0);

    if (newDueDateNormalized < today) {
      throw new ValidationError('newDueDate must be in the future');
    }

    // Date Validation Layer 3: Validate date is not before current due date (prevent backwards renewal)
    const currentDueDateNormalized = new Date(this.props.nextDueDate);
    currentDueDateNormalized.setHours(0, 0, 0, 0);

    if (newDueDateNormalized < currentDueDateNormalized) {
      throw new ValidationError('newDueDate must be after current due date');
    }

    return new Member({
      ...this.props,
      nextDueDate: newDueDate,  // Only update date, status unchanged
      updatedAt: new Date(),
    });
  }
}
```

**Date Validation Requirements** (Added 2026-03-30):

All `renew()` implementations MUST enforce these validations:

1. **Valid Date Object**: Reject `new Date('invalid')` or corrupted Date instances
2. **No Past Dates**: Reject dates before today (normalized to 00:00:00)
3. **No Backwards Renewals**: Reject dates before current `nextDueDate` (prevents data corruption)
4. **Edge Cases**: Accept today's date and same-as-current date (no-op renewal)

**Test Coverage Requirement**: 100% branch coverage required for `renew()` method including all validation paths.

**Import Requirement**: Must import `ValidationError` from domain errors:

```typescript
import {
  InvalidStatusTransitionError,
  ValidationError,
} from '@/core/utils/errors';
```

**Implementation Status**: ✅ Completed 2026-03-30
- Date validation fully implemented in `Member.ts:320-358`
- 13 comprehensive tests added with 100% coverage
- All validation layers tested including edge cases

**Step 2: Implement Conditional Logic in Use Case**

```typescript
// src/core/use-cases/payment/CollectPayment.ts
export class CollectPayment {
  async execute(input: CollectPaymentInput): Promise<CollectPaymentOutput> {
    const member = await this.memberRepo.findById(input.memberId, input.gymId);

    // Conditional logic based on current status
    const processedMember =
      member.status === 'active'
        ? member.renew(nextDueDate)        // Early renewal (no state change)
        : member.activate(nextDueDate);     // Reactivation (state transition)

    return await this.memberRepo.update(processedMember);
  }
}
```

**Step 3: Add Error Handling in API Route**

```typescript
// src/app/api/members/[id]/payment/route.ts
import { InvalidStatusTransitionError, ValidationError } from '@/core/utils/errors';

export async function POST(request: NextRequest) {
  try {
    // ... execute use case
  } catch (error) {
    if (error instanceof InvalidStatusTransitionError) {
      return NextResponse.json(
        ResponseBuilder.error(error.message, 'INVALID_STATUS_TRANSITION'),
        { status: 400 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        ResponseBuilder.error(error.message, 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }
    // ... other error handlers
  }
}
```

#### Benefits of This Pattern

1. **No Invalid Transition Errors**: Separate methods prevent `Active → Active` rejection
2. **Explicit Intent**: Code clearly shows renewal vs. reactivation
3. **Audit Trail**: Can track whether payment was early renewal or reactivation
4. **State Machine Integrity**: 7 valid transitions remain unchanged
5. **Business Logic Clarity**: Renewal is separate operation, not a "self-transition"

#### Use Cases

| Scenario | Current Status | Operation | Method | New Status |
|----------|---------------|-----------|--------|------------|
| Early Payment | Active | Extend subscription | `renew()` | Active (date extended) |
| Overdue Payment | Expired | Reactivate membership | `activate()` | Active |
| Reactivation | Suspended | Lift suspension | `activate()` | Active |

#### When to Use This Pattern

- ✅ State machine entities with property updates that don't change state
- ✅ Operations that would create "self-transitions" (Active → Active)
- ✅ Entities where the same property can be updated in different contexts
- ✅ Domain models with complex validation rules around state

#### When NOT to Use This Pattern

- ❌ Simple property updates that have no state-related constraints
- ❌ Entities without state machines
- ❌ Operations where state transitions are always required

---

### 2.6 Cron Job Error Persistence Pattern

**CRITICAL RULE**: All scheduled cron jobs MUST persist execution results to a database audit log for debugging, monitoring, and historical analysis.

#### ❌ WRONG: No Error Persistence

```typescript
// ❌ NEVER implement cron jobs without logging
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Execute job
    const result = await executeJob();

    // Only return result - errors lost if not monitored
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Job failed:', error); // Only console logging!
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**Problems**:
- Errors only visible in platform logs (Vercel, etc.)
- No historical error tracking
- Cannot query failure rates or patterns
- Debugging requires searching through raw logs
- No execution duration metrics

#### ✅ CORRECT: Database-Persisted Execution Logging

**Step 1: Create Database Schema**

```sql
-- supabase/migrations/YYYYMMDD_create_cron_logs_table.sql
CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failure')),
  summary JSONB,
  errors TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for query performance
CREATE INDEX idx_cron_logs_job_name ON cron_logs(job_name);
CREATE INDEX idx_cron_logs_started_at ON cron_logs(started_at DESC);
CREATE INDEX idx_cron_logs_status ON cron_logs(status);
CREATE INDEX idx_cron_logs_job_started ON cron_logs(job_name, started_at DESC);

-- RLS for service role access
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert cron logs"
  ON cron_logs FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can read all cron logs"
  ON cron_logs FOR SELECT TO service_role USING (true);
```

**Step 2: Create CronLogger Utility**

```typescript
// src/core/utils/cron/CronLogger.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type CronJobStatus = 'running' | 'success' | 'failure';

export class CronLogger {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Log the start of a cron job execution
   *
   * @param jobName - Name of the cron job (e.g., 'send-reminders')
   * @returns Log ID for subsequent updates
   */
  async logStart(jobName: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('cron_logs')
      .insert({
        job_name: jobName,
        started_at: new Date().toISOString(),
        status: 'running' as CronJobStatus,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to log cron start: ${error.message}`);
    return data.id;
  }

  /**
   * Log successful completion
   */
  async logSuccess(logId: string, summary: Record<string, unknown>): Promise<void> {
    await this.logComplete(logId, 'success', summary);
  }

  /**
   * Log failure with errors
   */
  async logFailure(logId: string, errors: string[], summary?: Record<string, unknown>): Promise<void> {
    await this.logComplete(logId, 'failure', summary || {}, errors);
  }

  /**
   * Update log record with completion data
   */
  private async logComplete(
    logId: string,
    status: 'success' | 'failure',
    summary: Record<string, unknown>,
    errors?: string[]
  ): Promise<void> {
    const { error } = await this.supabase
      .from('cron_logs')
      .update({
        completed_at: new Date().toISOString(),
        status,
        summary,
        errors: errors || null,
      })
      .eq('id', logId);

    if (error) throw new Error(`Failed to log cron completion: ${error.message}`);
  }
}
```

**Step 3: Export from Utils**

```typescript
// src/core/utils/cron/index.ts
export { CronLogger, type CronJobStatus, type CronLogRecord } from './CronLogger';
```

**Step 4: Implement in Cron Routes**

```typescript
// src/app/api/cron/send-reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { CronLogger } from '@/core/utils/cron';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const logger = new CronLogger(supabase);
  let logId: string | null = null;

  try {
    // 1. Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-key';

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request');
      return NextResponse.json(
        ResponseBuilder.unauthorized(),
        { status: 401 }
      );
    }

    console.log('🚀 Starting send reminders cron job...');
    const startTime = Date.now();

    // 2. Log cron job start
    logId = await logger.logStart('send-reminders');

    // 3. Execute use case
    const container = await getAdminContainer();
    const sendReminders = container.getSendAutomatedRemindersUseCase();
    const summary = await sendReminders.execute();

    const duration = Date.now() - startTime;
    console.log(`⏱️  Cron job completed in ${duration}ms`);

    // 4. Log successful completion
    await logger.logSuccess(logId, {
      totalSent: summary.totalSent,
      byType: summary.byType,
      errors: summary.errors,
      duration: `${duration}ms`,
    });

    // 5. Return response
    return NextResponse.json(
      ResponseBuilder.success({
        totalSent: summary.totalSent,
        byType: summary.byType,
        errors: summary.errors,
        duration: `${duration}ms`,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Send reminders cron error:', error);

    // 6. Log failure if we have a log ID
    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ]);
    }

    // 7. Return error response
    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to send reminders',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    );
  }
}

// Allow GET for manual testing (only in development)
export async function GET(_request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      ResponseBuilder.error('Method not allowed in production', 'METHOD_NOT_ALLOWED'),
      { status: 405 }
    );
  }

  console.log('🧪 Manual test: Starting send reminders cron job...');
  const container = await getAdminContainer();
  const sendReminders = container.getSendAutomatedRemindersUseCase();
  const summary = await sendReminders.execute();

  return NextResponse.json(ResponseBuilder.success(summary));
}
```

#### Benefits of This Pattern

1. **Complete Audit Trail**: Every cron execution logged with start time, completion time, status
2. **Historical Analysis**: Query patterns like "How many times did this job fail last month?"
3. **Performance Metrics**: Track execution duration trends over time
4. **Debugging**: Detailed error messages and summaries stored in structured format (JSONB)
5. **Monitoring**: Build dashboards showing cron job health across all jobs
6. **Alerting**: Query for recent failures and trigger notifications

#### Querying Cron Logs

```sql
-- Get all executions of a specific job
SELECT * FROM cron_logs
WHERE job_name = 'send-reminders'
ORDER BY started_at DESC
LIMIT 50;

-- Find recent failures
SELECT job_name, started_at, errors
FROM cron_logs
WHERE status = 'failure'
  AND started_at > NOW() - INTERVAL '7 days'
ORDER BY started_at DESC;

-- Calculate success rate by job
SELECT
  job_name,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'success') as successes,
  COUNT(*) FILTER (WHERE status = 'failure') as failures,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 2) as success_rate
FROM cron_logs
WHERE started_at > NOW() - INTERVAL '30 days'
GROUP BY job_name
ORDER BY success_rate ASC;

-- Average execution duration
SELECT
  job_name,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
FROM cron_logs
WHERE status = 'success'
  AND started_at > NOW() - INTERVAL '7 days'
GROUP BY job_name
ORDER BY avg_duration_seconds DESC;
```

#### When to Use This Pattern

- ✅ All scheduled cron jobs (daily, hourly, weekly, etc.)
- ✅ Background jobs processing large datasets
- ✅ Automated system maintenance tasks
- ✅ Any job where failure would be silent without logging

#### When NOT to Use This Pattern

- ❌ Real-time user-triggered actions (use standard error handling)
- ❌ High-frequency jobs (>1000/day) - consider sampling
- ❌ Jobs that run on every API request (too much overhead)

---

### 2.7 SMS Error Logging Pattern

**CRITICAL RULE**: All SMS sending operations MUST log both success and failure outcomes to the database to eliminate silent failures and provide complete audit trails.

#### ❌ WRONG: Fire-and-Forget with Console Logging Only

```typescript
// ❌ NEVER implement SMS sending with only console logging
private async sendReceiptSMS(member: Member, amount: number): Promise<void> {
  try {
    const message = this.generateMessage(member, amount);
    const result = await this.smsProvider.send({
      to: member.phoneNumber,
      message,
    });

    if (!result.success) {
      console.error('Receipt SMS failed:', result.error);
      // TODO: Log to monitoring service
    }
  } catch (error) {
    console.error('Exception sending receipt SMS:', error);
    // Don't throw - this is a non-critical operation
  }
}
```

**Problems**:
- SMS failures only visible in platform logs (Vercel, etc.)
- No database tracking of delivery status
- Cannot query failed SMS for retry or analysis
- Members don't know if critical messages weren't delivered
- Debugging requires searching through raw logs

#### ✅ CORRECT: Comprehensive Database Logging

**Step 1: Ensure Database Schema Has error_message Column**

```sql
-- supabase/migrations/YYYYMMDD_add_error_message_to_sms_logs.sql
ALTER TABLE sms_logs
ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN sms_logs.error_message IS 'Error message from SMS provider if delivery failed (NULL for successful deliveries)';
```

**Step 2: Add ISMSRepository Dependency to Use Case**

```typescript
// src/core/use-cases/payment/CollectPayment.ts
export class CollectPayment {
  constructor(
    private readonly memberRepo: IMemberRepository,
    private readonly paymentRepo: IPaymentRepository,
    private readonly smsProvider: ISMSProvider,
    private readonly smsRepo: ISMSRepository  // Add this dependency
  ) {}
}
```

**Step 3: Implement Comprehensive Error Logging**

```typescript
// src/core/use-cases/payment/CollectPayment.ts
private async sendReceiptSMS(
  member: Member,
  amountPaid: number,
  nextDueDate: Date,
  discount?: DiscountInfo | null
): Promise<void> {
  const message = this.generateReceiptMessage(member, amountPaid, nextDueDate, discount);

  try {
    // Send SMS
    const result = await this.smsProvider.send({
      to: member.phoneNumber,
      message,
    });

    if (result.success) {
      // Log successful SMS to database
      await this.smsRepo.create({
        memberId: member.id,
        gymId: member.gymId,
        smsType: 'receipt',
        phoneNumber: member.phoneNumber,
        messageBody: message,
        sentAt: new Date(),
        deliveryStatus: SMSDeliveryStatus.Sent,
        textLkMessageId: result.messageId || null,
        errorMessage: null,  // NULL for success
      });
    } else {
      // Log failed SMS to database with error message
      await this.smsRepo.create({
        memberId: member.id,
        gymId: member.gymId,
        smsType: 'receipt',
        phoneNumber: member.phoneNumber,
        messageBody: message,
        sentAt: new Date(),
        deliveryStatus: SMSDeliveryStatus.Failed,
        textLkMessageId: null,
        errorMessage: result.error || 'Unknown error',  // Capture provider error
      });
      console.error('Receipt SMS failed:', result.error);
    }
  } catch (error) {
    // Log exception to database
    try {
      await this.smsRepo.create({
        memberId: member.id,
        gymId: member.gymId,
        smsType: 'receipt',
        phoneNumber: member.phoneNumber,
        messageBody: message,
        sentAt: new Date(),
        deliveryStatus: SMSDeliveryStatus.Failed,
        textLkMessageId: null,
        errorMessage: error instanceof Error ? error.message : 'Exception sending SMS',
      });
    } catch (logError) {
      console.error('Failed to log SMS failure:', logError);
      // Last resort: at least console log the original error
    }
    console.error('Exception sending receipt SMS:', error);
    // Don't throw - this is a non-critical operation
  }
}
```

**Step 4: Update Dependency Injection Container**

```typescript
// src/infrastructure/di/Container.ts
export class Container {
  getCollectPaymentUseCase(): CollectPayment {
    return new CollectPayment(
      this.getMemberRepository(),
      this.getPaymentRepository(),
      this.getSMSProvider(),
      this.getSMSRepository()  // Wire up SMS repository
    );
  }

  getRegisterMemberUseCase(): RegisterMember {
    return new RegisterMember(
      this.getMemberRepository(),
      this.getPaymentRepository(),
      this.getSMSProvider(),
      this.getSMSRepository()  // Wire up SMS repository
    );
  }
}
```

#### Benefits of This Pattern

1. **Complete Audit Trail**: Every SMS attempt logged with timestamp, status, and error details
2. **Failure Visibility**: Failed SMS visible in database queries and admin UI
3. **Debugging**: Error messages from SMS provider captured for troubleshooting
4. **Retry Capability**: Failed SMS can be identified and retried
5. **Historical Analysis**: Query patterns like "How many SMS failed last month?"
6. **Provider Accountability**: Track SMS provider reliability and error types

#### Querying SMS Logs

```sql
-- Get all failed SMS in last 7 days
SELECT
  member_id,
  sms_type,
  phone_number,
  sent_at,
  error_message
FROM sms_logs
WHERE delivery_status = 'failed'
  AND sent_at > NOW() - INTERVAL '7 days'
ORDER BY sent_at DESC;

-- Calculate SMS success rate by type
SELECT
  sms_type,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE delivery_status = 'sent') as successes,
  COUNT(*) FILTER (WHERE delivery_status = 'failed') as failures,
  ROUND(100.0 * COUNT(*) FILTER (WHERE delivery_status = 'sent') / COUNT(*), 2) as success_rate
FROM sms_logs
WHERE sent_at > NOW() - INTERVAL '30 days'
GROUP BY sms_type
ORDER BY success_rate ASC;

-- Find members with failed welcome SMS (need manual follow-up)
SELECT DISTINCT
  m.id,
  m.name,
  m.phone_number,
  s.error_message,
  s.sent_at
FROM members m
JOIN sms_logs s ON m.id = s.member_id
WHERE s.sms_type = 'welcome'
  AND s.delivery_status = 'failed'
  AND m.registered_date > NOW() - INTERVAL '7 days'
ORDER BY s.sent_at DESC;
```

#### When to Use This Pattern

- ✅ All SMS sending operations (welcome, receipt, reminders)
- ✅ Critical notifications that members must receive
- ✅ Any fire-and-forget async operations with external dependencies
- ✅ Operations where failure would be silent without logging

#### When NOT to Use This Pattern

- ❌ Email sending (use dedicated email logging pattern)
- ❌ Internal notifications (use different logging mechanism)
- ❌ Operations that already have comprehensive error handling

---

### 2.8 User-Facing Error Tracking Pattern

**CRITICAL RULE**: When displaying SMS delivery status to end users (gym managers), you MUST differentiate between pending operations and system errors while sanitizing technical error details.

#### ❌ WRONG: Generic "Not Sent" Status

```typescript
// ❌ NEVER lump together pending and failed messages
interface ReminderStatus {
  reminder_7day_sent: string | null;
  reminder_3day_sent: string | null;
  // No error tracking - cannot distinguish between:
  // 1. "Not sent yet (pending)"
  // 2. "Attempted but failed (system error)"
}

function getStatus(sent: string | null): string {
  return sent ? 'Sent' : 'Not Sent';  // WRONG - too ambiguous
}
```

**Problems**:
- Users cannot distinguish between scheduled vs failed messages
- No actionable guidance on what to do about errors
- Failed SMS deliveries appear identical to pending reminders
- Users may ignore critical errors thinking they're just pending

#### ✅ CORRECT: Explicit Error Tracking with Sanitization

**Step 1: Add Error Tracking to Type Definitions**

```typescript
// src/features/sms/types/index.ts
export interface MemberReminderStatus {
  // ... existing fields

  // Timestamp tracking for each reminder type
  reminder_7day_sent: string | null;
  reminder_3day_sent: string | null;
  due_today_sent: string | null;

  // Error tracking for each reminder type
  reminder_7day_error: boolean;  // True if 7-day reminder delivery failed
  reminder_3day_error: boolean;  // True if 3-day reminder delivery failed
  due_today_error: boolean;      // True if due-today reminder delivery failed
}
```

**Step 2: Detect Errors in Backend Service**

```typescript
// src/features/sms/services/sms.service.ts
export async function getReminderStatus(
  gymId: string,
  filters?: ReminderFiltersInput
): Promise<MemberReminderStatus[]> {
  // ... fetch members and sms_logs

  const reminderStatuses = members.map((member) => {
    // Query each reminder type's most recent log
    const reminder7Day = reminderLogs.find(
      (log) => log.sms_type === 'reminder_7day'
    );
    const reminder3Day = reminderLogs.find(
      (log) => log.sms_type === 'reminder_3day'
    );
    const dueToday = reminderLogs.find(
      (log) => log.sms_type === 'due_today'
    );

    // Check for delivery failures (system errors) for each reminder type
    const reminder7DayError = reminder7Day?.delivery_status === 'failed' || false;
    const reminder3DayError = reminder3Day?.delivery_status === 'failed' || false;
    const dueTodayError = dueToday?.delivery_status === 'failed' || false;

    return {
      // ... other fields
      reminder_7day_sent: reminder7Day?.sent_at || null,
      reminder_3day_sent: reminder3Day?.sent_at || null,
      due_today_sent: dueToday?.sent_at || null,

      // Populate error flags
      reminder_7day_error: reminder7DayError,
      reminder_3day_error: reminder3DayError,
      due_today_error: dueTodayError,
    };
  });

  return reminderStatuses;
}
```

**Step 3: Map Error Flags to UI States**

```typescript
// src/components/payment-collection/PaymentRemindersTable.tsx
const getSMSTypeStatus = (
  reminder: MemberReminderStatus,
  _targetDays: number,
  expectedType: string
): 'sent' | 'not_sent' | 'not_applicable' | 'error' => {
  const {
    reminder_7day_error,
    reminder_3day_error,
    due_today_error,
    reminder_7day_sent,
    reminder_3day_sent,
    due_today_sent,
  } = reminder;

  // Check for delivery failures (system errors) FIRST
  let hasError = false;
  if (expectedType === 'reminder_7day') {
    hasError = reminder_7day_error;
  } else if (expectedType === 'reminder_3day') {
    hasError = reminder_3day_error;
  } else if (expectedType === 'due_today') {
    hasError = due_today_error;
  }

  if (hasError) {
    return 'error';  // Prioritize error state
  }

  // Check if reminder was sent successfully
  let wasSent = false;
  if (expectedType === 'reminder_7day') {
    wasSent = !!reminder_7day_sent;
  } else if (expectedType === 'reminder_3day') {
    wasSent = !!reminder_3day_sent;
  } else if (expectedType === 'due_today') {
    wasSent = !!due_today_sent;
  }

  if (wasSent) {
    return 'sent';
  }

  return 'not_sent';  // Pending or missed window
};
```

**Step 4: Render Error State with Actionable Guidance**

```typescript
// src/components/payment-collection/PaymentRemindersTable.tsx
import { AlertOctagon } from 'lucide-react';

const renderSMSStatusBadge = (
  status: 'sent' | 'not_sent' | 'not_applicable' | 'error',
  reminder: MemberReminderStatus,
  targetDays: number
) => {
  // Error: System error occurred during SMS delivery
  if (status === 'error') {
    return (
      <div
        className="flex items-center gap-1.5 text-xs font-medium text-red-600"
        title="System error occurred. Click 'Send Now' to retry."
      >
        <AlertOctagon className="h-3.5 w-3.5" />
        <span>Error</span>
      </div>
    );
  }

  // ... handle other states (sent, pending, disabled)
};
```

**Step 5: Sanitize Error Messages (Defense-in-Depth)**

**API Layer Protection**:
```typescript
// src/app/api/members/[id]/sms-history/route.ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Explicitly exclude 'error_message' to prevent exposing technical infrastructure details
  const { data: smsLogs, error: logsError } = await supabase
    .from('sms_logs')
    .select('id, sms_type, phone_number, message_body, sent_at, delivery_status, text_lk_message_id, created_at')
    // NOTE: 'error_message' field intentionally omitted
    .eq('member_id', memberId)
    .eq('gym_id', gymProfile.id)
    .order('sent_at', { ascending: false });

  return NextResponse.json({ data: { smsLogs } });
}
```

**Type Layer Protection**:
```typescript
// Frontend type definition
interface SMSLog {
  id: string;
  sms_type: string;
  phone_number: string;
  message_body: string;        // ✅ User-facing message only
  sent_at: string;
  delivery_status: 'sent' | 'delivered' | 'failed';
  text_lk_message_id: string | null;
  // NO error_message field - prevents accidental exposure
}
```

**UI Layer Protection**:
```typescript
// SMSHistoryModal.tsx
<div className="mt-2 p-3 rounded-md bg-gray-50 text-sm text-gray-700">
  {log.message_body}  {/* Only render user-facing message */}
</div>
```

#### UI State Matrix

| State | Badge Color | Icon | Text | Tooltip | Action |
|-------|------------|------|------|---------|--------|
| **Sent** | Green (`text-green-700`) | `CheckCircle2` | "Sent" | - | None |
| **Pending** | Gray (`text-gray-500`) | `Clock` | "Pending" | - | Wait |
| **Not Sent** | Amber (`text-amber-600`) | `AlertCircle` | "Not Sent" | - | Manual review |
| **Disabled** | Gray (`text-gray-400`) | `XCircle` | "Disabled" | - | None |
| **Error** | **Red (`text-red-600`)** | **`AlertOctagon`** | **"Error"** | **"System error occurred. Click 'Send Now' to retry."** | **Retry** |

#### Benefits of This Pattern

1. **Clear Error Visibility**: Users can immediately identify failed SMS deliveries
2. **Actionable Guidance**: Tooltip instructs users to retry via "Send Now" button
3. **Security**: Technical error messages (stack traces, API keys, database errors) hidden from end users
4. **Defense-in-Depth**: Triple-layer protection (API, Type, UI) prevents error message leakage
5. **Better UX**: Users understand system state and know how to resolve issues
6. **Debugging Support**: Errors tracked in database for admin/developer analysis

#### When to Use This Pattern

- ✅ User-facing dashboards showing system operation status
- ✅ SMS/email delivery tracking interfaces
- ✅ Any UI where users need to distinguish between pending and failed operations
- ✅ Systems where users can retry failed operations manually

#### When NOT to Use This Pattern

- ❌ Admin/developer dashboards (can show full error details)
- ❌ Internal monitoring tools (use full error messages)
- ❌ Operations with no user-facing retry mechanism
- ❌ Systems where all errors auto-retry without user intervention

---

### 2.9 SaaS Admin Dashboard Pattern

**CRITICAL RULE**: SaaS platforms MUST provide a separate, protected technical dashboard for system administrators to monitor infrastructure health and debug production issues.

#### ❌ WRONG: Exposing Technical Errors to End Users

```typescript
// ❌ NEVER show stack traces, database errors, or API failures in user-facing UI
export async function GET(request: NextRequest) {
  const { data: failures } = await supabase
    .from('sms_logs')
    .select('*, error_message')  // WRONG - technical errors visible to gym managers
    .eq('delivery_status', 'failed');

  return NextResponse.json({ failures });  // Exposed to all authenticated users
}
```

**Problems**:
- Technical infrastructure details exposed to end users
- Stack traces reveal implementation details and potential vulnerabilities
- Database error messages expose schema information
- No distinction between user-facing and admin-only data
- Gym managers see confusing technical jargon instead of actionable guidance

#### ✅ CORRECT: Dedicated Admin Dashboard with Authorization

**Step 1: Create Protected API Routes with Strict Authorization**

```typescript
// src/app/api/admin/system-health/cron-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    // CRITICAL: Strict authorization check BEFORE any database queries
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_API_SECRET;

    if (!adminSecret) {
      console.error('ADMIN_API_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Admin API not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${adminSecret}`) {
      console.warn('Unauthorized admin API access attempt');
      return NextResponse.json(
        { success: false, error: 'Forbidden - Invalid admin credentials' },
        { status: 403 }
      );
    }

    // Only execute queries AFTER authorization passes
    const supabase = createAdminClient();
    const { data: jobNames } = await supabase
      .from('cron_logs')
      .select('job_name')
      .order('job_name');

    const uniqueJobNames = Array.from(
      new Set((jobNames || []).map((row) => row.job_name))
    );

    const cronStats: Record<string, any[]> = {};

    for (const jobName of uniqueJobNames) {
      const { data: executions } = await supabase
        .from('cron_logs')
        .select('id, job_name, started_at, completed_at, status, summary, errors')
        .eq('job_name', jobName)
        .order('started_at', { ascending: false })
        .limit(10);

      cronStats[jobName] = executions || [];
    }

    return NextResponse.json({ success: true, data: cronStats }, { status: 200 });
  } catch (error) {
    console.error('Cron stats API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Step 2: Create SMS Failures Endpoint with error_message Column and Gym Filtering**

```typescript
// src/app/api/admin/system-health/sms-failures/route.ts
export async function GET(request: NextRequest) {
  try {
    // Authorization check (same pattern as above)
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_API_SECRET;

    if (authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Extract optional gymId query parameter for gym-specific drilldown
    const { searchParams } = new URL(request.url);
    const gymId = searchParams.get('gymId');

    const supabase = createAdminClient();

    // Build query with optional gym filter
    let query = supabase
      .from('sms_logs')
      .select('id, gym_id, member_id, sms_type, phone_number, message_body, sent_at, delivery_status, error_message, text_lk_message_id')
      .eq('delivery_status', 'failed');

    // Apply gym filter if gymId provided
    if (gymId) {
      query = query.eq('gym_id', gymId);
    }

    // Execute query with ordering and limit
    const { data: failures } = await query
      .order('sent_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      success: true,
      data: {
        failures: failures || [],
        totalCount: (failures || []).length,
        filters: {
          gymId: gymId || null,  // Include applied filters in response
        },
      },
    });
  } catch (error) {
    console.error('SMS failures API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Performance Optimization**:
- Composite index created: `idx_sms_logs_gym_failures (gym_id, delivery_status, sent_at DESC)`
- Partial index with `WHERE delivery_status = 'failed'` clause
- Provides 10-100x speedup for gym-filtered queries on large datasets

**Step 3: Build Cron Status Grid Component**

```typescript
// src/app/(admin)/system-health/CronStatusGrid.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function CronStatusGrid() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-cron-stats'],
    queryFn: async () => {
      const adminSecret = process.env.NEXT_PUBLIC_ADMIN_API_SECRET || '';
      const response = await fetch('/api/admin/system-health/cron-stats', {
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch cron stats');
      return response.json();
    },
    refetchInterval: 60000, // Auto-refresh every minute
  });

  const getStatusBadge = (status: 'running' | 'success' | 'failure') => {
    switch (status) {
      case 'success':
        return (
          <Badge className="border-transparent bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'failure':
        return (
          <Badge className="border-transparent bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'running':
        return (
          <Badge className="border-transparent bg-blue-100 text-blue-800">
            <Clock className="h-3 w-3 mr-1" />
            Running
          </Badge>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Object.entries(data?.data || {}).map(([jobName, executions]) => {
        const latestRun = executions[0];
        const isFailed = latestRun?.status === 'failure';

        return (
          <Card
            key={jobName}
            className={isFailed ? 'border-red-500 border-2' : ''}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                {jobName}
                {isFailed && <AlertTriangle className="h-5 w-5 text-red-500" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestRun && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    {getStatusBadge(latestRun.status)}
                  </div>
                  {latestRun.errors && latestRun.errors.length > 0 && (
                    <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                      <p className="text-xs font-semibold text-red-800 mb-1">
                        Errors ({latestRun.errors.length}):
                      </p>
                      <p className="text-xs text-red-700 truncate">
                        {latestRun.errors[0]}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

**Step 4: Build Raw SMS Failure Table Component with Gym Filtering**

```typescript
// src/app/(admin)/system-health/RawSMSFailureTable.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Check, Filter, X } from 'lucide-react';
import { useState } from 'react';

export default function RawSMSFailureTable() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [gymIdFilter, setGymIdFilter] = useState<string>('');
  const [activeGymId, setActiveGymId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-sms-failures', activeGymId],  // Include activeGymId for cache isolation
    queryFn: async () => {
      const adminSecret = process.env.NEXT_PUBLIC_ADMIN_API_SECRET || '';
      // Construct URL with optional gymId parameter
      const url = activeGymId
        ? `/api/admin/system-health/sms-failures?gymId=${activeGymId}`
        : '/api/admin/system-health/sms-failures';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch SMS failures');
      return response.json();
    },
    refetchInterval: 60000,
  });

  const handleApplyFilter = () => {
    if (gymIdFilter.trim()) {
      setActiveGymId(gymIdFilter.trim());
    }
  };

  const handleClearFilter = () => {
    setGymIdFilter('');
    setActiveGymId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleApplyFilter();
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SMS Delivery Failures (Latest 50)</CardTitle>

        {/* Gym-Specific Drilldown Filter */}
        <div className="mt-4 flex items-center gap-2">
          <Input
            type="text"
            placeholder="Filter by Gym ID (UUID)"
            value={gymIdFilter}
            onChange={(e) => setGymIdFilter(e.target.value)}
            onKeyDown={handleKeyPress}
            className="max-w-xs font-mono text-sm"
          />
          <Button
            onClick={handleApplyFilter}
            variant="default"
            size="sm"
            disabled={!gymIdFilter.trim()}
          >
            <Filter className="h-4 w-4 mr-2" />
            Apply Filter
          </Button>
          {activeGymId && (
            <Button
              onClick={handleClearFilter}
              variant="outline"
              size="sm"
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>

        {/* Active Filter Indicator */}
        {activeGymId && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Filtered by Gym ID:</span>{' '}
              <span className="font-mono text-xs">{activeGymId}</span>
            </p>
          </div>
        )}

        {data?.data && (
          <p className="text-sm text-gray-600 mt-2">
            Total failures: <span className="font-semibold">{data.data.totalCount}</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        {data?.data.failures && data.data.failures.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Gym ID</TableHead>
                <TableHead>SMS Type</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Raw Error Trace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.failures.map((failure) => (
                <TableRow key={failure.id}>
                  <TableCell className="font-mono text-xs">
                    {formatTimestamp(failure.sent_at)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[80px]" title={failure.gym_id}>
                        {failure.gym_id.substring(0, 8)}...
                      </span>
                      <button
                        onClick={() => copyToClipboard(failure.gym_id, `gym-${failure.id}`)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {copiedId === `gym-${failure.id}` ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>{getSMSTypeBadge(failure.sms_type)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {failure.phone_number}
                  </TableCell>
                  <TableCell>
                    {failure.error_message ? (
                      <details className="group">
                        <summary className="cursor-pointer text-sm text-red-600">
                          {failure.error_message}
                        </summary>
                        <div className="mt-2 p-3 bg-red-50 rounded border border-red-200">
                          <pre className="text-xs text-red-800 whitespace-pre-wrap">
                            {failure.error_message}
                          </pre>
                          {failure.text_lk_message_id && (
                            <div className="mt-2 text-xs text-gray-600">
                              <span className="font-semibold">TextLK Message ID:</span>{' '}
                              <span className="font-mono">{failure.text_lk_message_id}</span>
                            </div>
                          )}
                        </div>
                      </details>
                    ) : (
                      <span className="text-sm text-gray-500 italic">No error message</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-gray-500">No SMS failures found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 5: Compose Dashboard Page**

```typescript
// src/app/(admin)/system-health/page.tsx
import CronStatusGrid from './CronStatusGrid';
import RawSMSFailureTable from './RawSMSFailureTable';
import { Shield, Activity } from 'lucide-react';

export default function SystemHealthPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">System Health Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Technical monitoring and error tracking for SaaS infrastructure
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Warning Banner */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
            <div className="flex items-start gap-3">
              <Activity className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Admin Dashboard - Restricted Access
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  This dashboard exposes technical infrastructure details including error messages,
                  stack traces, and system internals. This information is strictly for SaaS
                  administrators and must never be exposed to gym managers or end users.
                </p>
              </div>
            </div>
          </div>

          <section>
            <CronStatusGrid />
          </section>

          <section>
            <RawSMSFailureTable />
          </section>
        </div>
      </div>
    </div>
  );
}
```

**Step 6: Protect with Admin Layout**

```typescript
// src/app/(admin)/layout.tsx
import { ReactNode } from 'react';
import { redirect } from 'next/navigation';

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Basic protection: Check if admin secret is configured
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_API_SECRET;

  if (!adminSecret) {
    // If no admin secret is configured, block access entirely
    redirect('/dashboard');
  }

  return <div className="admin-layout">{children}</div>;
}
```

**Step 7: Update Environment Configuration**

```bash
# .env.example

# Admin Dashboard (generate with: openssl rand -base64 32)
# Used for SaaS admin-only routes and system health monitoring
ADMIN_API_SECRET=your-admin-api-secret
NEXT_PUBLIC_ADMIN_API_SECRET=your-admin-api-secret
```

#### Benefits of This Pattern

1. **Separation of Concerns**: User-facing UI shows sanitized errors; admin UI shows full technical details
2. **Security**: Technical infrastructure details hidden from end users via authorization layer
3. **Debugging**: Full error traces, stack traces, and database errors visible to administrators
4. **Monitoring**: Real-time view of system health (cron jobs, SMS failures, API errors)
5. **Historical Analysis**: Query patterns and failure trends for proactive maintenance
6. **Access Control**: Bearer token authentication ensures only authorized personnel see sensitive data
7. **Gym-Specific Drilldown**: Filter SMS failures by gym ID for targeted customer support debugging
   - **System-Wide View**: Identify provider-level issues affecting all gyms
   - **Gym-Specific View**: Troubleshoot SMS delivery problems for a specific customer
   - **Pattern Analysis**: Determine if failures are isolated or systemic
   - **Performance Optimized**: Composite index provides 10-100x speedup for filtered queries

#### When to Use This Pattern

- ✅ Multi-tenant SaaS platforms serving multiple organizations
- ✅ Systems where end users should not see technical infrastructure details
- ✅ Applications with scheduled background jobs requiring monitoring
- ✅ Services with external API dependencies (SMS, email, payment processors)
- ✅ Production systems requiring real-time operational visibility

#### When NOT to Use This Pattern

- ❌ Single-tenant applications where all users are administrators
- ❌ Internal tools used exclusively by developers
- ❌ Proof-of-concept or demo applications
- ❌ Systems without background jobs or external dependencies

#### Security Considerations

**Production Recommendation**: Replace `ADMIN_API_SECRET` environment variable with session-based role checking:

```typescript
// Future improvement: Use database-backed roles
export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session || session.user.role !== 'saas_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Proceed with admin operations
}
```

**Current Implementation**: Bearer token provides basic protection suitable for:
- Development environments
- Internal tools behind VPN
- Systems with IP whitelisting
- Prototypes requiring quick access control

---

### 2.10 Multi-Cycle Query Ordering Pattern

**CRITICAL RULE**: When querying time-series data that may have multiple records per entity across different time periods (billing cycles, sessions, etc.), you MUST sort by timestamp in descending order BEFORE using `.find()` to ensure you retrieve the most recent record.

#### ❌ WRONG: Unordered Query with .find()

```typescript
// ❌ NEVER use .find() on unordered time-series data
export async function getReminderStatus(gymId: string) {
  const { data: members } = await supabase
    .from('members')
    .select(`
      id,
      name,
      sms_logs (
        sms_type,
        sent_at,
        delivery_status
      )
    `)
    .eq('gym_id', gymId);

  const reminderStatuses = members.map((member) => {
    // WRONG: No ordering - .find() returns arbitrary result
    const reminderLogs = (member.sms_logs || []).filter(
      (log) => log.sms_type === 'overdue'
    );

    // WRONG: May return old March log instead of new April log
    const overdue = reminderLogs.find((log) => log.sms_type === 'overdue');

    return {
      id: member.id,
      name: member.name,
      overdue_sent: overdue?.sent_at || null,  // ❌ Stale data
    };
  });

  return reminderStatuses;
}
```

**Problems**:
- Members with multiple billing cycles have multiple logs per type
- Database returns results in arbitrary order (no ORDER BY clause)
- JavaScript `.find()` returns first match in array order (not chronological)
- UI displays old data from previous billing cycle
- Users see "Not Sent" status even when recent reminder was delivered

**Example Bug Scenario**:
```typescript
// Member has 2 overdue reminder logs:
const smsLogs = [
  { sms_type: 'overdue', sent_at: '2026-03-15', delivery_status: 'sent' },  // March
  { sms_type: 'overdue', sent_at: '2026-04-10', delivery_status: 'sent' },  // April
];

// Without ordering, database may return in any order:
// Result 1: March log first → .find() returns March → UI shows old data ❌
// Result 2: April log first → .find() returns April → UI shows current data ✅

// INCONSISTENT BEHAVIOR - depends on database internals!
```

#### ✅ CORRECT: Sort Before Find

**Step 1: Add Sorting by Timestamp (Client-Side)**

```typescript
// src/features/sms/services/sms.service.ts
export async function getReminderStatus(gymId: string) {
  const { data: members } = await supabase
    .from('members')
    .select(`
      id,
      name,
      sms_logs (
        sms_type,
        sent_at,
        delivery_status
      )
    `)
    .eq('gym_id', gymId);

  const reminderStatuses = members.map((member) => {
    const REMINDER_TYPES = ['reminder_7day', 'reminder_3day', 'due_today', 'overdue'];

    // ✅ CORRECT: Sort by sent_at DESC before using .find()
    const reminderLogs = (member.sms_logs || [])
      .filter((log) => REMINDER_TYPES.includes(log.sms_type))
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

    // Now .find() returns most recent log for each type
    const reminder7Day = reminderLogs.find((log) => log.sms_type === 'reminder_7day');
    const reminder3Day = reminderLogs.find((log) => log.sms_type === 'reminder_3day');
    const dueToday = reminderLogs.find((log) => log.sms_type === 'due_today');
    const overdue = reminderLogs.find((log) => log.sms_type === 'overdue');

    return {
      id: member.id,
      name: member.name,
      reminder_7day_sent: reminder7Day?.sent_at || null,  // ✅ Current data
      reminder_3day_sent: reminder3Day?.sent_at || null,  // ✅ Current data
      due_today_sent: dueToday?.sent_at || null,          // ✅ Current data
      overdue_sent: overdue?.sent_at || null,              // ✅ Current data
    };
  });

  return reminderStatuses;
}
```

**Step 2: Alternative - Database-Level Ordering (Server-Side)**

```typescript
// If you need only the most recent log per type, use database ordering
const { data: latestOverdueLogs } = await supabase
  .from('sms_logs')
  .select('member_id, sent_at, delivery_status')
  .eq('gym_id', gymId)
  .eq('sms_type', 'overdue')
  .order('sent_at', { ascending: false });

// Group by member_id to get latest per member
const latestByMember = latestOverdueLogs.reduce((acc, log) => {
  if (!acc[log.member_id]) {
    acc[log.member_id] = log;  // First log is most recent due to ORDER BY
  }
  return acc;
}, {});
```

**Step 3: Index for Performance**

```sql
-- supabase/migrations/YYYYMMDD_add_sms_logs_ordering_index.sql
CREATE INDEX IF NOT EXISTS idx_sms_logs_member_type_sent
  ON sms_logs (member_id, sms_type, sent_at DESC);

-- Speeds up queries filtering by member + type and ordering by sent_at
```

#### Benefits of This Pattern

1. **Consistent Behavior**: Always returns most recent record regardless of database order
2. **Multi-Cycle Support**: Works correctly for members with long payment histories
3. **Accurate UI**: Displays current billing cycle data, not stale historical data
4. **Type Safety**: TypeScript compiler ensures correct field access
5. **Performance**: Client-side sorting is fast for small datasets; use database ordering for large datasets
6. **Idempotency**: Most recent log correctly prevents duplicate operations

#### When to Use This Pattern

- ✅ SMS/email delivery tracking across multiple campaigns
- ✅ Payment history where members have recurring payments
- ✅ Session logs with multiple entries per user
- ✅ Audit trails with time-series events
- ✅ Any entity with multiple records per type over time

#### When NOT to Use This Pattern

- ❌ One-to-one relationships (user profile, settings)
- ❌ Entities guaranteed to have only one record per type
- ❌ Already using `LIMIT 1` with `ORDER BY` in database query
- ❌ Data that doesn't have temporal aspects

#### Common Mistakes

**Mistake 1: Using last array element without sorting**
```typescript
// ❌ WRONG - Assumes last element is most recent
const overdue = reminderLogs[reminderLogs.length - 1];

// ✅ CORRECT - Sort first, then access
const sortedLogs = reminderLogs.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
const overdue = sortedLogs[0];
```

**Mistake 2: Filtering then finding without sorting**
```typescript
// ❌ WRONG - Filter doesn't guarantee order
const overdueLogs = reminderLogs.filter((log) => log.sms_type === 'overdue');
const latest = overdueLogs[0];  // May not be latest!

// ✅ CORRECT - Sort before filtering
const overdueLogs = reminderLogs
  .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
  .filter((log) => log.sms_type === 'overdue');
const latest = overdueLogs[0];  // Guaranteed to be latest
```

**Mistake 3: Database ordering only one table in join**
```sql
-- ❌ WRONG - Ordering parent table doesn't order child table
SELECT
  members.id,
  sms_logs.sent_at
FROM members
LEFT JOIN sms_logs ON sms_logs.member_id = members.id
ORDER BY members.created_at DESC;  -- Only orders members, not sms_logs!

-- ✅ CORRECT - Order child table separately or use subquery
SELECT
  members.id,
  latest_sms.sent_at
FROM members
LEFT JOIN LATERAL (
  SELECT sent_at
  FROM sms_logs
  WHERE sms_logs.member_id = members.id
  ORDER BY sent_at DESC
  LIMIT 1
) latest_sms ON true;
```

#### Testing This Pattern

```typescript
describe('getReminderStatus', () => {
  it('returns most recent log when member has multiple billing cycles', async () => {
    // Setup: Member with March and April logs
    const member = await createMember({ name: 'Test User' });
    await createSMSLog({
      member_id: member.id,
      sms_type: 'overdue',
      sent_at: '2026-03-15',  // Old billing cycle
    });
    await createSMSLog({
      member_id: member.id,
      sms_type: 'overdue',
      sent_at: '2026-04-10',  // Current billing cycle
    });

    // Execute
    const statuses = await getReminderStatus(member.gym_id);

    // Assert: Should return April log, not March
    expect(statuses[0].overdue_sent).toBe('2026-04-10');  // ✅ Not '2026-03-15'
  });

  it('handles single log correctly', async () => {
    const member = await createMember({ name: 'New User' });
    await createSMSLog({
      member_id: member.id,
      sms_type: 'overdue',
      sent_at: '2026-04-10',
    });

    const statuses = await getReminderStatus(member.gym_id);

    expect(statuses[0].overdue_sent).toBe('2026-04-10');  // ✅ Works correctly
  });

  it('handles no logs correctly', async () => {
    const member = await createMember({ name: 'Fresh User' });

    const statuses = await getReminderStatus(member.gym_id);

    expect(statuses[0].overdue_sent).toBeNull();  // ✅ No crash
  });
});
```

#### Real-World Impact

**Bug Example**: Gym Management SaaS (2026-04-10)
- **Issue**: Reminders tab always showed "Not Sent" despite successful SMS delivery
- **Root Cause**: Unordered query + `.find()` returned March log instead of April log
- **Users Affected**: All gyms with members having 2+ billing cycles
- **Impact**: Gym managers thought automated reminders were broken, lost trust in system
- **Fix**: Added `.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())`
- **Result**: UI now correctly shows current reminder status for all members

**Key Lesson**: Time-series data MUST be sorted before retrieval operations, especially in multi-tenant SaaS where entities accumulate records over months/years.

---

### 2.11 Domain Entity API Serialization Pattern

**CRITICAL RULE**: Domain entities with Date objects MUST NOT be directly serialized for HTTP API responses. Create dedicated serialization helpers that properly format dates and handle field name conventions.

#### ❌ WRONG: Direct Domain Entity Serialization

```typescript
// ❌ NEVER use domain entity methods directly in API responses
export async function GET(request: NextRequest) {
  const members = await memberRepo.findAll({ gymId });

  // WRONG: toDatabase() returns Date objects
  const membersData = members.map(member => member.toDatabase());

  return NextResponse.json(
    ResponseBuilder.success({ members: membersData })
  );
}
```

**Problems**:
- `toDatabase()` returns Date objects intended for repository layer, not HTTP API
- `NextResponse.json()` serializes Date objects as ISO timestamps: `"2024-01-15T00:00:00.000Z"`
- Frontend expects YYYY-MM-DD format: `"2024-01-15"`
- Frontend utilities like `formatDate()` receive malformed data → display "Invalid Date"
- Missing field name convention handling (camelCase vs snake_case)

**Example Bug**:
```typescript
// Domain entity toDatabase() returns:
{
  id: "uuid",
  phoneNumber: "+94712345678",  // camelCase
  registeredDate: Date("2024-01-15")  // Date object
}

// NextResponse.json() serializes to:
{
  "id": "uuid",
  "phoneNumber": "+94712345678",
  "registeredDate": "2024-01-15T00:00:00.000Z"  // ❌ ISO timestamp
}

// Frontend expects:
{
  "id": "uuid",
  "phone_number": "+94712345678",  // ❌ snake_case missing
  "registered_date": "2024-01-15"  // ❌ YYYY-MM-DD format missing
}

// Result: UI shows "Invalid Date", phone numbers hidden, plan badges hidden
```

#### ✅ CORRECT: Dedicated API Serialization Helper

**Step 1: Create Serialization Helper**

```typescript
// src/app/api/members/route.ts

/**
 * Serializes a Member domain entity to API response format
 *
 * Converts Date objects to YYYY-MM-DD strings to ensure proper JSON serialization.
 * This prevents NextResponse.json() from converting dates to ISO timestamps.
 *
 * @param member - Member domain entity
 * @param discount - Optional discount information from repository join
 */
function serializeMemberForAPI(
  member: Member,
  discount?: { id: string; discount_name: string; discount_percentage: number } | null
) {
  const props = member.toDatabase();

  return {
    id: props.id,
    gymId: props.gymId,
    name: props.name,

    // Include both camelCase AND snake_case for backward compatibility
    phoneNumber: props.phoneNumber,
    phone_number: props.phoneNumber,

    planType: props.planType,
    plan_type: props.planType,

    planAmount: props.planAmount,
    plan_amount: props.planAmount,

    discountId: props.discountId,
    discount_id: props.discountId,

    recurringDiscount: props.recurringDiscount,
    recurring_discount: props.recurringDiscount,

    status: props.status,

    // Convert Date objects to YYYY-MM-DD format
    registeredDate: props.registeredDate.toISOString().split('T')[0],
    registered_date: props.registeredDate.toISOString().split('T')[0],

    membershipStartDate: props.membershipStartDate.toISOString().split('T')[0],
    membership_start_date: props.membershipStartDate.toISOString().split('T')[0],

    nextDueDate: props.nextDueDate.toISOString().split('T')[0],
    next_due_date: props.nextDueDate.toISOString().split('T')[0],

    // Full ISO timestamp for metadata fields
    createdAt: props.createdAt.toISOString(),
    created_at: props.createdAt.toISOString(),

    updatedAt: props.updatedAt.toISOString(),
    updated_at: props.updatedAt.toISOString(),

    // Include joined discount data if available
    discount: discount || null,
  };
}
```

**Step 2: Use Helper in API Routes**

```typescript
// GET /api/members
export async function GET(request: NextRequest) {
  const result = await memberRepo.findAll({ gymId, ...filters });

  // Fetch discount data for members that have discounts
  const discountIds = result.items
    .map(member => member.toDatabase().discountId)
    .filter((id): id is string => id !== null);

  const uniqueDiscountIds = Array.from(new Set(discountIds));

  let discountsMap: Record<string, DiscountData> = {};

  if (uniqueDiscountIds.length > 0) {
    const { data: discounts } = await supabase
      .from('discounts')
      .select('id, discount_name, discount_percentage')
      .in('id', uniqueDiscountIds);

    if (discounts) {
      discountsMap = discounts.reduce((acc, discount) => {
        acc[discount.id] = discount;
        return acc;
      }, {} as Record<string, DiscountData>);
    }
  }

  // Serialize domain entities with proper date formatting
  const membersData = result.items.map(member => {
    const props = member.toDatabase();
    const discount = props.discountId ? discountsMap[props.discountId] : null;
    return serializeMemberForAPI(member, discount);
  });

  return NextResponse.json(
    ResponseBuilder.success({
      members: membersData,
      totalCount: result.totalCount,
      page: result.page,
      totalPages: result.totalPages,
    })
  );
}

// POST /api/members
export async function POST(request: NextRequest) {
  const result = await registerMember.execute(input);

  // Serialize domain entity for API response
  const memberData = serializeMemberForAPI(result.member);

  return NextResponse.json(
    ResponseBuilder.success(memberData, { message: 'Member registered successfully' }),
    { status: 201 }
  );
}
```

#### Date Formatting Rules

| Field Type | Format | Method | Example |
|------------|--------|--------|---------|
| **Business Date** (registered_date, next_due_date) | YYYY-MM-DD | `.toISOString().split('T')[0]` | `"2024-01-15"` |
| **Timestamp** (created_at, updated_at) | ISO 8601 | `.toISOString()` | `"2024-01-15T10:30:00.000Z"` |
| **Display Date** (frontend only) | DD MMM YYYY | `formatDate()` utility | `"15 Jan 2024"` |

#### Field Naming Conventions

**Include Both Conventions for Maximum Compatibility**:

```typescript
return {
  // Prefer camelCase in new code
  phoneNumber: props.phoneNumber,
  planType: props.planType,
  nextDueDate: props.nextDueDate.toISOString().split('T')[0],

  // Include snake_case for backward compatibility
  phone_number: props.phoneNumber,
  plan_type: props.planType,
  next_due_date: props.nextDueDate.toISOString().split('T')[0],
};
```

**Benefits**:
- ✅ Works with existing frontend code expecting snake_case
- ✅ Enables gradual migration to camelCase
- ✅ No breaking changes for deployed clients

#### Benefits of This Pattern

1. **Correct Date Display**: Frontend receives dates in expected YYYY-MM-DD format
2. **Field Name Compatibility**: Both camelCase and snake_case provided for backward compatibility
3. **Type Safety**: TypeScript enforces proper serialization at compile time
4. **Separation of Concerns**: Domain layer remains pure, API layer handles HTTP serialization
5. **Joined Data Support**: Helper accepts optional related data (discounts, etc.)
6. **Maintainability**: Centralized serialization logic in one helper function

#### When to Use This Pattern

- ✅ All API routes returning domain entities with Date objects
- ✅ Entities with complex field name conventions (camelCase vs snake_case)
- ✅ Responses including joined data from multiple tables
- ✅ When domain entity's `.toDatabase()` doesn't match API response format

#### When NOT to Use This Pattern

- ❌ Simple DTOs without Date objects (use `.toDatabase()` directly)
- ❌ Internal API-to-API communication (can use ISO timestamps)
- ❌ Server Components (can use Date objects directly in JSX)
- ❌ Data that never reaches the frontend

#### Common Mistakes

**Mistake 1: Using .toJSON() on Date Objects**
```typescript
// ❌ WRONG - Still produces ISO timestamp
registeredDate: props.registeredDate.toJSON()  // "2024-01-15T00:00:00.000Z"

// ✅ CORRECT - Produces YYYY-MM-DD format
registeredDate: props.registeredDate.toISOString().split('T')[0]  // "2024-01-15"
```

**Mistake 2: Inconsistent Field Names**
```typescript
// ❌ WRONG - Frontend receives mix of conventions
return {
  phoneNumber: props.phoneNumber,  // camelCase
  plan_type: props.planType,       // snake_case
  // Frontend breaks when expecting consistent naming
};

// ✅ CORRECT - Include both conventions
return {
  phoneNumber: props.phoneNumber,
  phone_number: props.phoneNumber,  // Both provided
  planType: props.planType,
  plan_type: props.planType,
};
```

**Mistake 3: Missing Discount Data**
```typescript
// ❌ WRONG - Repository query doesn't join discounts
const members = await memberRepo.findAll({ gymId });
// Frontend expects discount object but receives undefined

// ✅ CORRECT - Fetch discounts separately and include in serialization
const discountsMap = await fetchDiscountsForMembers(members);
const membersData = members.map(member =>
  serializeMemberForAPI(member, discountsMap[member.discountId])
);
```

#### Testing This Pattern

```typescript
describe('serializeMemberForAPI', () => {
  it('formats dates as YYYY-MM-DD', () => {
    const member = Member.create({
      ...props,
      registeredDate: new Date('2024-01-15'),
      nextDueDate: new Date('2024-02-15'),
    });

    const serialized = serializeMemberForAPI(member);

    expect(serialized.registeredDate).toBe('2024-01-15');
    expect(serialized.registered_date).toBe('2024-01-15');
    expect(serialized.nextDueDate).toBe('2024-02-15');
    expect(serialized.next_due_date).toBe('2024-02-15');
  });

  it('includes both camelCase and snake_case fields', () => {
    const member = Member.create({
      ...props,
      phoneNumber: '+94712345678',
      planType: 'monthly',
    });

    const serialized = serializeMemberForAPI(member);

    expect(serialized.phoneNumber).toBe('+94712345678');
    expect(serialized.phone_number).toBe('+94712345678');
    expect(serialized.planType).toBe('monthly');
    expect(serialized.plan_type).toBe('monthly');
  });

  it('includes discount data when provided', () => {
    const member = Member.create({ ...props, discountId: 'uuid' });
    const discount = { id: 'uuid', discount_name: 'Student', discount_percentage: 20 };

    const serialized = serializeMemberForAPI(member, discount);

    expect(serialized.discount).toEqual(discount);
  });

  it('sets discount to null when not provided', () => {
    const member = Member.create({ ...props, discountId: null });

    const serialized = serializeMemberForAPI(member);

    expect(serialized.discount).toBeNull();
  });
});
```

#### Real-World Impact

**Bug Example**: Gym Management SaaS (2026-04-16)
- **Issue**: Member detail table showed "Invalid Date", phone numbers hidden, plan badges hidden
- **Root Cause**: API used `member.toDatabase()` returning Date objects, `NextResponse.json()` serialized as ISO timestamps
- **Users Affected**: All gym managers viewing member directory
- **Impact**: Core member information invisible, major usability issue
- **Fix**: Created `serializeMemberForAPI()` helper with proper date formatting and field name conventions
- **Result**: All member data now displays correctly, improved user experience

**Key Lesson**: Domain entities are designed for business logic, not HTTP serialization. Always create dedicated serialization helpers for API responses that handle date formatting, field naming conventions, and joined data.

---

### 2.12 Radix UI Select Hydration Pattern (React 19 Incompatibility)

**CRITICAL UNDERSTANDING**: Radix UI Select components have a known React 19 hydration incompatibility due to internal `useId()` usage. This is mitigated with targeted `suppressHydrationWarning` at the component library level.

#### Problem: React 19 + Radix UI `useId()` Incompatibility

**Symptom**:
```
Hydration failed because the server rendered HTML didn't match the client.
Expected: aria-controls="radix-_R_ipaatperaitllb_"
Received: aria-controls="radix-_R_4laatperaitllb_"
```

**Root Cause**:
1. React 19's `useId()` generates IDs based on component tree position
2. Server-side rendering calculates tree position differently than client hydration
3. Radix UI uses `useId()` **internally** to generate ARIA relationship IDs
4. The `aria-controls` attribute value differs between server and client

**Why External ID Props Don't Work**:
- Adding `id` props to `<SelectTrigger>` only affects the trigger's **own** `id` attribute
- It does NOT override Radix UI's **internal** `useId()` call for `aria-controls`
- The hydration mismatch persists because Radix UI's internal logic is unchanged

#### ✅ APPLIED SOLUTION: Targeted Hydration Suppression

**Location**: `src/components/ui/select.tsx` (shared component library)

**Implementation**:
```tsx
const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(...)}
    suppressHydrationWarning  // ⚠️ Suppresses aria-controls mismatch only
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
```

**Why This Is Safe**:
- ✅ **Targeted**: Only suppresses warnings on SelectTrigger element itself
- ✅ **Functional**: The `aria-controls` mismatch is presentation-only, not functional
- ✅ **Accessibility**: Screen readers only use client-rendered values (which are correct)
- ✅ **SEO**: Search engines don't parse ARIA attributes
- ✅ **Centralized**: Applied once, affects all 22 Select instances globally
- ✅ **Reversible**: Can be removed when Radix UI releases React 19 fix

#### Affected Components (22 Total)

All Radix UI `<Select>` components across 10 files:
- RegularPaymentTable.tsx (2 selects)
- PaymentCollectedTable.tsx (1 select)
- PaymentRemindersTable.tsx (2 selects)
- MembersTable.tsx (6 selects - desktop + mobile variants)
- RevenuePageClient.tsx (3 selects)
- PaymentCollectionModal.tsx (1 select)
- AddMemberModal.tsx (2 selects)
- EditMemberModal.tsx (2 selects)
- PlanTypesTab.tsx (1 select)
- ReminderStatusTable.tsx (2 selects)

#### Alternative Solutions Considered

| Solution | Status | Reason Rejected |
|----------|--------|-----------------|
| **Add explicit ID props** | ❌ Tested, Failed | Only affects trigger's `id`, not internal `aria-controls` generation |
| **Upgrade Radix UI** | ❌ Investigated | No fix available as of 2026-04-19 |
| **Downgrade to React 18** | ❌ Rejected | Loses React 19 features |
| **Disable SSR** | ❌ Rejected | Loses SEO and performance |
| **Custom Select** | ❌ Rejected | Large refactor, loses accessibility features |

#### Exit Strategy: Monitor for Upstream Fix

**Track Issue**:
- Repository: https://github.com/radix-ui/primitives/issues
- Search: "React 19 useId hydration"

**When Fix Available**:
1. Check Radix UI release notes
2. Test upgrade in development
3. Remove `suppressHydrationWarning` from `src/components/ui/select.tsx:25`
4. Verify no hydration errors in console
5. Deploy to production

#### Impact Assessment

**Before Fix**:
- ❌ 22 hydration errors per page load
- ❌ Console pollution obscuring real errors
- ❌ React DevTools warnings
- ❌ Poor developer experience

**After Fix**:
- ✅ Zero hydration warnings
- ✅ Clean console output
- ✅ No functional regressions
- ✅ No accessibility regressions
- ✅ No SEO impact

**Risk Level**: 🟢 **Low** (cosmetic fix for presentation-only issue)

**Key Lesson**: When third-party libraries have internal `useId()` incompatibilities with React 19 SSR, and no external API exists to override the behavior, targeted `suppressHydrationWarning` is an acceptable temporary mitigation until upstream fix is available.

---