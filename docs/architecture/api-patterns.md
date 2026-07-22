# API Boundary Patterns

> On-demand reference. Loaded when working in this area, not auto-injected.
> Governing rules (also indexed in `.claude/rules/architecture.md`):
- **§2.3 ResponseBuilder** — All API routes construct responses via the `ResponseBuilder` utility for consistent shape, typed payloads, and machine-readable error codes. Routes returning **binary assets** (e.g. the QR poster PNGs, §2.16) use `ResponseBuilder.binary(body, contentType, …)` for the payload and the JSON error builders for failures.
- **§2.11 Serialization** — Never serialize domain entities directly to HTTP. Use dedicated serialization helpers that format dates (YYYY-MM-DD) and emit both camelCase and snake_case fields.

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

**Location:** `src/utils/api/ApiResponse.ts`

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
