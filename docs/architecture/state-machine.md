# State Machine Enforcement Pattern (§2.5)

> On-demand reference. Not auto-injected.
> **Rule:** Enforce entity state transitions through dedicated operational endpoints, never generic update endpoints.

---

### 2.5 State Machine Enforcement Pattern

**CRITICAL RULE**: All entity state transitions MUST be enforced through dedicated operational endpoints, NOT through generic update endpoints.

#### ❌ WRONG: Direct Status Updates

```typescript
// ❌ NEVER allow direct status updates in generic PATCH endpoint
export const updateMemberSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['active', 'expired', 'suspended']), // WRONG
})

// ❌ NEVER bypass state machine validation
async function PATCH(request) {
  const { status } = await request.json()
  await db.update({ status }) // WRONG - bypasses business rules
}
```

#### ✅ CORRECT: Dedicated Operational Endpoints

**Step 1: Define State Machine in Domain Layer**

```typescript
// src/core/domain/member/Member.ts
export class Member {
  suspend(): Member {
    if (!canTransition(this.status, MemberStatus.Suspended)) {
      throw new InvalidStatusTransitionError(
        this.status,
        MemberStatus.Suspended
      )
    }
    return new Member({ ...this.props, status: MemberStatus.Suspended })
  }

  activate(newDueDate: Date): Member {
    if (!canTransition(this.status, MemberStatus.Active)) {
      throw new InvalidStatusTransitionError(this.status, MemberStatus.Active)
    }
    return new Member({
      ...this.props,
      status: MemberStatus.Active,
      nextDueDate: newDueDate,
    })
  }
}
```

**Step 2: Create Dedicated Use Cases**

```typescript
// src/core/use-cases/member/SuspendMember.ts
export class SuspendMember {
  constructor(private memberRepo: IMemberRepository) {}

  async execute(input: { memberId: string; gymId: string }): Promise<Member> {
    const member = await this.memberRepo.findById(input.memberId, input.gymId)
    if (!member) throw new NotFoundError('Member not found')

    const suspended = member.suspend() // State machine enforced here
    return await this.memberRepo.update(suspended)
  }
}
```

**Step 3: Create Dedicated API Endpoints**

```typescript
// src/app/api/members/[id]/suspend/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const gymProfile = await getCurrentGymProfile()
  const container = await getContainer()

  const suspendMember = container.getSuspendMemberUseCase()
  const suspended = await suspendMember.execute({
    memberId: params.id,
    gymId: gymProfile.id,
  })

  return NextResponse.json(ResponseBuilder.success(suspended.toDatabase()))
}
```

**Step 4: Register Use Cases in DI Container**

```typescript
// src/infrastructure/di/Container.ts
export class Container {
  getSuspendMemberUseCase(): SuspendMember {
    return new SuspendMember(this.getMemberRepository())
  }

  getReactivateMemberUseCase(): ReactivateMember {
    return new ReactivateMember(this.getMemberRepository())
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
})
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

---
