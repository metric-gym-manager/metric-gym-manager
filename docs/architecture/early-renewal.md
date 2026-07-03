# Early Renewal Pattern (§2.5.1)

> On-demand reference. Not auto-injected.
> **Rule:** Property updates that do not change state get dedicated domain methods, separate from state-transition methods.

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


---
