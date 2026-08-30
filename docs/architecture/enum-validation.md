# Enum Validation Pattern (§2.2)

> On-demand reference. Not auto-injected.
> **Rule:** Validate TS domain enums with `z.nativeEnum()`, never a duplicate `z.enum()` string-literal set.

---

### 2.2 Enum Validation Pattern

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
export const MemberStatus = z.enum([
  'active',
  'expired',
  'suspended',
  'cancelled',
])
export type MemberStatus = z.infer<typeof MemberStatus> // Type collision!

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
import { MemberStatus } from '@/core/utils/constants/StatusConfig'

export const memberFiltersSchema = z.object({
  status: z.nativeEnum(MemberStatus).optional(), // ✅ Validates enum type
  // ... other fields
})

export type MemberFiltersInput = z.infer<typeof memberFiltersSchema>
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

---
