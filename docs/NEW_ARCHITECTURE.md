# 🏗️ Centralized Architecture Proposal

**Version**: 1.0
**Date**: 2026-03-24
**Status**: Proposed

---

## Table of Contents

1. [Overview](#overview)
2. [Current Problems](#current-problems)
3. [Architectural Principles](#architectural-principles)
4. [New File Structure](#new-file-structure)
5. [Layer Descriptions](#layer-descriptions)
6. [Key Improvements](#key-improvements)
7. [Migration Plan](#migration-plan)
8. [Benefits](#benefits)
9. [Examples](#examples)

---

## Overview

This document proposes a complete architectural overhaul of the gym management SaaS application to address critical issues identified in the codebase:

- **Scattered business logic** across 4+ locations
- **Duplicate calculations** (date math, discounts, etc.)
- **No single source of truth** for domain concepts
- **Inconsistent patterns** across features
- **Missing abstractions** for common operations
- **Difficult to test** due to tight coupling

The new architecture follows **Clean Architecture** (Onion Architecture) principles with strict separation of concerns, dependency inversion, and feature-based organization.

---

## Current Problems

### 1. Next Due Date Calculation - Duplicated 4+ Times

**Found in**:
- `member.service.ts:175-194` (registration)
- `payment.service.ts:131-150` (payment collection)
- `PaymentCollectionModal.tsx:153-163` (UI preview)
- `reminder.service.ts:314-340` (billing period)

**Bug**: Monthly calculation inconsistent (1 month vs 30 days)

### 2. Reminder Tracking - Triple System

- **System A**: SMS Logs Table
- **System B**: Boolean Flags (4 columns)
- **System C**: Calculated from Billing Period

All three can disagree, causing data inconsistency.

### 3. Reminder Rules - Hardcoded

"Monthly members don't get 7-day reminders" scattered across:
- `reminder.service.ts:236-239`
- `PaymentRemindersTable.tsx:116-118`
- SMS templates

### 4. Exact Day Matching - Guaranteed Failures

```typescript
if (daysUntilDue === 7) → send 7-day reminder
```

Misses members if calculation skips day 7.

### 5. Database/TypeScript Mismatch

- TypeScript allows 6 plan types
- Database only supports 3
- Runtime errors guaranteed

### 6. No State Machine

Status can transition any way (active → cancelled directly), bypassing business rules.

### 7. Inefficient Queries

Fetches ALL overdue members (5000+) on every page load.

---

## Architectural Principles

### 1. Onion Architecture (Clean Architecture)

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │  ← UI, API Routes
│  ┌─────────────────────────────────┐   │
│  │     Application Layer           │   │  ← Use Cases, Commands, Queries
│  │  ┌─────────────────────────┐   │   │
│  │  │  Core Domain Layer      │   │   │  ← Business Logic, Entities
│  │  │   (No Dependencies)     │   │   │
│  │  └─────────────────────────┘   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
         Infrastructure Layer               ← Database, SMS, Storage
         (Implements Interfaces)
```

**Dependency Rules**:
- Core depends on **nothing**
- Application depends on **core only**
- Infrastructure implements **core interfaces**
- Presentation depends on **all layers**

### 2. Single Responsibility Principle

Each module has ONE reason to change:
- Domain models: Business rules change
- Use cases: Application flow changes
- Repositories: Database changes
- Controllers: API contract changes

### 3. Dependency Inversion

High-level modules don't depend on low-level modules. Both depend on abstractions.

```typescript
// ❌ BAD: Use case depends on Supabase
import { createClient } from '@/lib/supabase/server';

// ✅ GOOD: Use case depends on interface
import { IMemberRepository } from '@/core/ports/repositories';
```

### 4. CQRS Pattern

Separate **Commands** (writes) from **Queries** (reads):
- Commands: Change state, return success/failure
- Queries: Read data, return DTOs, no side effects

### 5. Feature-First Organization

Group by domain feature, not by technical layer:
```
✅ members/MemberList/, members/MemberForm/
❌ components/MemberList.tsx, modals/AddMemberModal.tsx
```

### 6. Tree-Shakeable Modules

Each module exports only what's needed:
```typescript
// index.ts
export { Member } from './Member';
export { MemberStatus } from './MemberStatus';
// Internal helpers NOT exported
```

---

## New File Structure

```
gym-management-saas/
├── src/
│   ├── core/                                    # 🎯 CORE DOMAIN LOGIC
│   │   ├── domain/                              # Business entities & rules
│   │   │   ├── member/
│   │   │   │   ├── Member.ts                    # Member entity
│   │   │   │   ├── MemberStatus.ts              # Status enum
│   │   │   │   ├── MemberLifecycle.ts           # ⭐ State machine
│   │   │   │   └── index.ts
│   │   │   ├── payment/
│   │   │   │   ├── Payment.ts
│   │   │   │   ├── PaymentCalculator.ts         # ⭐ CENTRALIZED calculations
│   │   │   │   └── index.ts
│   │   │   ├── plan/
│   │   │   │   ├── Plan.ts
│   │   │   │   ├── PlanType.ts
│   │   │   │   ├── PlanDuration.ts              # ⭐ CENTRALIZED durations
│   │   │   │   └── index.ts
│   │   │   ├── reminder/
│   │   │   │   ├── Reminder.ts
│   │   │   │   ├── ReminderRule.ts              # ⭐ CENTRALIZED rules
│   │   │   │   ├── ReminderTiming.ts            # ⭐ When to send
│   │   │   │   └── index.ts
│   │   │   ├── sms/
│   │   │   │   ├── SMS.ts
│   │   │   │   ├── SMSTemplate.ts               # ⭐ Message templates
│   │   │   │   └── index.ts
│   │   │   └── gym/
│   │   │       ├── Gym.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── use-cases/                           # ⭐ APPLICATION LOGIC
│   │   │   ├── member/
│   │   │   │   ├── RegisterMember.ts            # Create member
│   │   │   │   ├── UpdateMemberStatus.ts        # Change status
│   │   │   │   ├── SearchMembers.ts             # Search
│   │   │   │   └── index.ts
│   │   │   ├── payment/
│   │   │   │   ├── CollectPayment.ts            # ⭐ SINGLE payment flow
│   │   │   │   ├── CalculateNextDueDate.ts      # ⭐ CENTRALIZED
│   │   │   │   └── index.ts
│   │   │   ├── reminder/
│   │   │   │   ├── SendAutomatedReminders.ts
│   │   │   │   ├── DetermineReminderType.ts
│   │   │   │   └── index.ts
│   │   │   └── auth/
│   │   │       ├── RegisterUser.ts
│   │   │       ├── AuthenticateUser.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── ports/                               # 🔌 INTERFACES
│   │   │   ├── repositories/
│   │   │   │   ├── IMemberRepository.ts
│   │   │   │   ├── IPaymentRepository.ts
│   │   │   │   ├── ISMSRepository.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   ├── ISMSProvider.ts
│   │   │   │   ├── IStorageProvider.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   └── utils/                               # 🛠️ PURE UTILITIES
│   │       ├── date/
│   │       │   ├── DateCalculator.ts            # ⭐ All date math
│   │       │   ├── BillingPeriodCalculator.ts
│   │       │   ├── DaysUntilDue.ts
│   │       │   └── index.ts
│   │       ├── validation/
│   │       │   ├── PhoneValidator.ts
│   │       │   ├── EmailValidator.ts
│   │       │   └── index.ts
│   │       ├── formatters/
│   │       │   ├── CurrencyFormatter.ts
│   │       │   ├── DateFormatter.ts
│   │       │   └── index.ts
│   │       ├── constants/
│   │       │   ├── PlanConfig.ts                # ⭐ Plan definitions
│   │       │   ├── ReminderConfig.ts            # ⭐ Reminder timing
│   │       │   ├── StatusConfig.ts              # ⭐ State transitions
│   │       │   └── index.ts
│   │       └── index.ts
│   │
│   ├── infrastructure/                          # 🔌 EXTERNAL INTEGRATIONS
│   │   ├── database/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts
│   │   │   │   ├── server.ts
│   │   │   │   ├── admin.ts
│   │   │   │   └── index.ts
│   │   │   ├── repositories/                    # ⭐ Concrete implementations
│   │   │   │   ├── MemberRepository.ts
│   │   │   │   ├── PaymentRepository.ts
│   │   │   │   ├── SMSRepository.ts
│   │   │   │   └── index.ts
│   │   │   └── migrations/
│   │   │
│   │   ├── sms/
│   │   │   ├── providers/
│   │   │   │   ├── TextLkProvider.ts
│   │   │   │   ├── MockSMSProvider.ts
│   │   │   │   └── index.ts
│   │   │   └── SMSService.ts
│   │   │
│   │   ├── storage/
│   │   │   ├── SupabaseStorageProvider.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── SupabaseAuthProvider.ts
│   │   │   ├── middleware.ts
│   │   │   └── index.ts
│   │   │
│   │   └── cron/
│   │       ├── jobs/
│   │       │   ├── SendRemindersJob.ts
│   │       │   ├── UpdateExpiredStatusJob.ts
│   │       │   ├── CancelOverdueJob.ts
│   │       │   └── ArchiveOldMembersJob.ts
│   │       └── index.ts
│   │
│   ├── application/                             # 🚀 APPLICATION LAYER
│   │   ├── api/
│   │   │   └── http/
│   │   │       ├── controllers/                 # ⭐ Thin controllers
│   │   │       │   ├── MemberController.ts
│   │   │       │   ├── PaymentController.ts
│   │   │       │   ├── ReminderController.ts
│   │   │       │   └── index.ts
│   │   │       ├── middleware/
│   │   │       │   ├── authMiddleware.ts
│   │   │       │   ├── errorMiddleware.ts       # ⭐ CENTRALIZED
│   │   │       │   ├── validationMiddleware.ts
│   │   │       │   └── index.ts
│   │   │       ├── validators/
│   │   │       │   ├── memberSchemas.ts
│   │   │       │   ├── paymentSchemas.ts
│   │   │       │   └── index.ts
│   │   │       └── responses/                   # ⭐ STANDARDIZED
│   │   │           ├── ApiResponse.ts
│   │   │           ├── ErrorResponse.ts
│   │   │           └── index.ts
│   │   │
│   │   ├── queries/                             # ⭐ CQRS: Reads
│   │   │   ├── GetMemberList.ts
│   │   │   ├── GetMemberDetail.ts
│   │   │   ├── GetPaymentHistory.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── commands/                            # ⭐ CQRS: Writes
│   │   │   ├── CreateMember.ts
│   │   │   ├── UpdateMember.ts
│   │   │   ├── CollectPayment.ts
│   │   │   └── index.ts
│   │   │
│   │   └── dto/
│   │       ├── MemberDTO.ts
│   │       ├── PaymentDTO.ts
│   │       └── index.ts
│   │
│   ├── presentation/                            # 🎨 UI LAYER
│   │   ├── app/                                 # Next.js routes
│   │   │   ├── (auth)/
│   │   │   ├── (dashboard)/
│   │   │   ├── api/                             # ⭐ Thin routes
│   │   │   │   ├── members/
│   │   │   │   │   ├── route.ts                 # Delegates to controller
│   │   │   │   │   └── [id]/
│   │   │   │   ├── payments/
│   │   │   │   ├── reminders/
│   │   │   │   └── cron/
│   │   │   └── layout.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── shared/                          # ⭐ Reusable
│   │   │   │   ├── ui/                          # Primitives
│   │   │   │   ├── layout/
│   │   │   │   ├── common/
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── features/                        # ⭐ Feature-specific
│   │   │       ├── members/
│   │   │       │   ├── MemberList/
│   │   │       │   ├── MemberDetail/
│   │   │       │   ├── MemberForm/
│   │   │       │   └── index.ts
│   │   │       ├── payments/
│   │   │       ├── reminders/
│   │   │       └── dashboard/
│   │   │
│   │   ├── hooks/
│   │   │   ├── api/                             # ⭐ React Query wrappers
│   │   │   │   ├── useMembers.ts
│   │   │   │   ├── useMember.ts
│   │   │   │   └── index.ts
│   │   │   └── common/
│   │   │       ├── useDebounce.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── ToastContext.tsx
│   │   │   └── index.ts
│   │   │
│   │   └── providers/
│   │       ├── QueryProvider.tsx
│   │       └── index.ts
│   │
│   ├── shared/                                  # 🔄 SHARED ACROSS LAYERS
│   │   ├── types/
│   │   │   ├── api.types.ts
│   │   │   ├── common.types.ts
│   │   │   └── index.ts
│   │   ├── config/
│   │   │   ├── app.config.ts
│   │   │   ├── api.config.ts
│   │   │   └── index.ts
│   │   ├── constants/
│   │   │   ├── routes.ts
│   │   │   ├── errors.ts
│   │   │   └── index.ts
│   │   └── errors/
│   │       ├── AppError.ts
│   │       ├── ValidationError.ts
│   │       └── index.ts
│   │
│   └── __tests__/                               # ⭐ Tests mirror src/
│       ├── core/
│       ├── infrastructure/
│       ├── application/
│       └── integration/
│
├── supabase/
│   └── migrations/
├── docs/
│   ├── architecture/
│   ├── api/
│   └── development/
├── package.json
└── README.md
```

---

## Layer Descriptions

### 1. Core Layer (`src/core/`)

**Purpose**: Pure business logic, no external dependencies.

#### `domain/`
Contains business entities and domain rules.

**Example**: `Member.ts`
```typescript
export class Member {
  constructor(
    public id: string,
    public name: string,
    public status: MemberStatus,
    public nextDueDate: Date
  ) {}

  // Domain methods
  canCheckIn(): boolean {
    return this.status === MemberStatus.Active;
  }

  isOverdue(): boolean {
    return new Date() > this.nextDueDate;
  }
}
```

#### `use-cases/`
Application-specific business logic (orchestration).

**Example**: `CollectPayment.ts`
```typescript
export class CollectPayment {
  constructor(
    private memberRepo: IMemberRepository,
    private paymentRepo: IPaymentRepository,
    private smsService: ISMSProvider
  ) {}

  async execute(memberId: string, amount: number): Promise<Payment> {
    // 1. Get member
    const member = await this.memberRepo.findById(memberId);

    // 2. Calculate next due date (centralized logic)
    const nextDueDate = CalculateNextDueDate.forPlan(
      member.planType,
      new Date()
    );

    // 3. Create payment
    const payment = await this.paymentRepo.create({
      memberId,
      amount,
      date: new Date()
    });

    // 4. Update member
    await this.memberRepo.update(memberId, {
      status: MemberStatus.Active,
      nextDueDate
    });

    // 5. Send receipt SMS
    await this.smsService.sendReceipt(member, payment);

    return payment;
  }
}
```

#### `ports/`
Interfaces (contracts) for external dependencies.

**Example**: `IMemberRepository.ts`
```typescript
export interface IMemberRepository {
  findById(id: string): Promise<Member | null>;
  findAll(filters: MemberFilters): Promise<Member[]>;
  create(data: CreateMemberDTO): Promise<Member>;
  update(id: string, data: UpdateMemberDTO): Promise<Member>;
  delete(id: string): Promise<void>;
}
```

#### `utils/`
Pure utility functions (no side effects).

**Example**: `DateCalculator.ts`
```typescript
export class DateCalculator {
  static addDuration(date: Date, planType: PlanType): Date {
    const result = new Date(date);

    switch (planType) {
      case PlanType.Daily:
        result.setDate(result.getDate() + 1);
        break;
      case PlanType.Monthly:
        result.setMonth(result.getMonth() + 1);
        break;
      case PlanType.Annual:
        result.setFullYear(result.getFullYear() + 1);
        break;
    }

    return result;
  }
}
```

---

### 2. Infrastructure Layer (`src/infrastructure/`)

**Purpose**: External service implementations.

#### `database/repositories/`
Concrete repository implementations.

**Example**: `MemberRepository.ts`
```typescript
export class MemberRepository implements IMemberRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<Member | null> {
    const { data, error } = await this.supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new DatabaseError(error.message);
    return data ? this.toDomain(data) : null;
  }

  private toDomain(row: any): Member {
    return new Member(
      row.id,
      row.name,
      row.status,
      new Date(row.next_due_date)
    );
  }
}
```

#### `sms/providers/`
SMS service implementations.

**Example**: `TextLkProvider.ts`
```typescript
export class TextLkProvider implements ISMSProvider {
  async send(to: string, message: string): Promise<void> {
    const response = await fetch('https://api.text.lk/send', {
      method: 'POST',
      body: JSON.stringify({ to, message })
    });

    if (!response.ok) {
      throw new SMSError('Failed to send SMS');
    }
  }
}
```

---

### 3. Application Layer (`src/application/`)

**Purpose**: API orchestration, validation, error handling.

#### `api/http/controllers/`
Thin controllers that delegate to use cases.

**Example**: `MemberController.ts`
```typescript
export class MemberController {
  constructor(
    private createMemberUseCase: CreateMember,
    private getMemberListQuery: GetMemberList
  ) {}

  async create(req: Request): Promise<ApiResponse<MemberDTO>> {
    try {
      // Validate
      const data = memberSchema.parse(await req.json());

      // Execute use case
      const member = await this.createMemberUseCase.execute(data);

      // Return standardized response
      return ApiResponse.success(MemberDTO.fromDomain(member));
    } catch (error) {
      return ApiResponse.error(error);
    }
  }
}
```

#### `queries/` (CQRS)
Read operations (optimized for retrieval).

**Example**: `GetMemberList.ts`
```typescript
export class GetMemberList {
  constructor(private memberRepo: IMemberRepository) {}

  async execute(filters: MemberFilters): Promise<MemberDTO[]> {
    const members = await this.memberRepo.findAll(filters);
    return members.map(MemberDTO.fromDomain);
  }
}
```

#### `commands/` (CQRS)
Write operations (change state).

**Example**: `CreateMember.ts`
```typescript
export class CreateMember {
  constructor(private registerMemberUseCase: RegisterMember) {}

  async execute(data: CreateMemberDTO): Promise<Member> {
    return await this.registerMemberUseCase.execute(data);
  }
}
```

---

### 4. Presentation Layer (`src/presentation/`)

**Purpose**: UI components, API routes, user interaction.

#### `app/api/`
Next.js API routes (thin wrappers).

**Example**: `members/route.ts`
```typescript
import { MemberController } from '@/application/api/http/controllers';

const controller = new MemberController(
  new CreateMember(new RegisterMember(...)),
  new GetMemberList(...)
);

export async function POST(req: Request) {
  return controller.create(req);
}
```

#### `components/features/`
Feature-specific components.

**Example**: `members/MemberList/MemberList.tsx`
```typescript
export function MemberList() {
  // Use centralized hook
  const { data, isLoading } = useMembers();

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div>
      {data?.map(member => (
        <MemberListItem key={member.id} member={member} />
      ))}
    </div>
  );
}
```

#### `hooks/api/`
React Query wrappers.

**Example**: `useMembers.ts`
```typescript
export function useMembers(filters?: MemberFilters) {
  return useQuery({
    queryKey: ['members', filters],
    queryFn: async () => {
      const response = await fetch('/api/members');
      return response.json();
    }
  });
}
```

---

## Key Improvements

### 1. Centralized Business Logic

| Concept | Before (Scattered) | After (Centralized) |
|---------|-------------------|---------------------|
| Next Due Date | 4+ files | `CalculateNextDueDate.ts` |
| Days Until Due | 3+ files | `DaysUntilDue.ts` |
| Discount Calculation | 3 layers | `PaymentCalculator.ts` |
| Reminder Rules | Hardcoded | `ReminderRule.ts` |
| Status Transitions | No validation | `MemberLifecycle.ts` |
| SMS Templates | 2 files | `SMSTemplate.ts` |

### 2. Single Source of Truth

**Example**: Plan Configuration

**Before**:
```typescript
// member.service.ts
case 'monthly':
  nextDueDate.setMonth(nextDueDate.getMonth() + 1);

// PaymentModal.tsx
case 'monthly':
  nextDue.setDate(nextDue.getDate() + 30);  // BUG!
```

**After**:
```typescript
// core/utils/constants/PlanConfig.ts
export const PLAN_CONFIG = {
  [PlanType.Monthly]: {
    durationDays: 30,
    durationMethod: 'month',  // Uses setMonth()
    reminderDays: [3, 0],     // 3-day, due-day only
  }
} as const;

// Used everywhere
import { PLAN_CONFIG } from '@/core/utils/constants';
```

### 3. Dependency Inversion

**Before**: Tight coupling
```typescript
// Use case depends on Supabase directly
import { createClient } from '@/lib/supabase/server';

export async function createMember(data) {
  const supabase = createClient();
  const { data: member } = await supabase
    .from('members')
    .insert(data);
}
```

**After**: Depend on abstraction
```typescript
// Use case depends on interface
export class RegisterMember {
  constructor(private memberRepo: IMemberRepository) {}

  async execute(data: CreateMemberDTO): Promise<Member> {
    return await this.memberRepo.create(data);
  }
}

// Infrastructure provides implementation
export class MemberRepository implements IMemberRepository {
  constructor(private supabase: SupabaseClient) {}

  async create(data: CreateMemberDTO): Promise<Member> {
    // Supabase details hidden
  }
}
```

**Benefits**:
- Easy to swap database (Supabase → Prisma → MongoDB)
- Easy to mock for testing
- Core logic testable without database

### 4. State Machine Enforcement

**Before**: No validation
```typescript
// Can change active → cancelled directly
await supabase
  .from('members')
  .update({ status: 'cancelled' })
  .eq('id', memberId);
```

**After**: Enforced transitions
```typescript
// core/domain/member/MemberLifecycle.ts
export class MemberLifecycle {
  private static readonly TRANSITIONS: Record<MemberStatus, MemberStatus[]> = {
    [MemberStatus.Active]: [MemberStatus.Expired, MemberStatus.Suspended],
    [MemberStatus.Expired]: [MemberStatus.Active, MemberStatus.Cancelled],
    [MemberStatus.Suspended]: [MemberStatus.Active, MemberStatus.Cancelled],
    [MemberStatus.Cancelled]: [],  // Terminal state
  };

  static canTransition(from: MemberStatus, to: MemberStatus): boolean {
    return this.TRANSITIONS[from]?.includes(to) ?? false;
  }

  static transition(member: Member, newStatus: MemberStatus): Member {
    if (!this.canTransition(member.status, newStatus)) {
      throw new InvalidStatusTransitionError(
        `Cannot transition from ${member.status} to ${newStatus}`
      );
    }
    return new Member({ ...member, status: newStatus });
  }
}
```

### 5. Standardized API Responses

**Before**: Inconsistent
```typescript
// Route 1
return NextResponse.json({ data: members });

// Route 2
return NextResponse.json({ success: true, result: member });

// Route 3
return NextResponse.json(member);  // No wrapper
```

**After**: Consistent
```typescript
// application/api/http/responses/ApiResponse.ts
export class ApiResponse<T> {
  constructor(
    public success: boolean,
    public data?: T,
    public error?: ErrorResponse,
    public meta?: ResponseMeta
  ) {}

  static success<T>(data: T, meta?: ResponseMeta): ApiResponse<T> {
    return new ApiResponse(true, data, undefined, meta);
  }

  static error(error: Error): ApiResponse<never> {
    return new ApiResponse(false, undefined, ErrorResponse.from(error));
  }
}

// All routes
return NextResponse.json(ApiResponse.success(member));
```

### 6. CQRS Pattern

**Separation of Reads and Writes**

**Commands** (writes):
```typescript
export class CreateMemberCommand {
  async execute(data: CreateMemberDTO): Promise<Member> {
    // Validate
    // Apply business rules
    // Save to database
    // Send events
    return member;
  }
}
```

**Queries** (reads):
```typescript
export class GetMemberListQuery {
  async execute(filters: MemberFilters): Promise<MemberDTO[]> {
    // Optimized read query
    // No business logic
    // Return DTOs
    return members;
  }
}
```

**Benefits**:
- Optimize reads separately from writes
- Scale reads and writes independently
- Clear intent (read vs. write)

### 7. Feature-Based Components

**Before**: Flat structure
```
components/
  MembersTable.tsx
  AddMemberModal.tsx
  EditMemberModal.tsx
  MemberDetailModal.tsx
  PaymentCollectionModal.tsx
```

**After**: Grouped by feature
```
components/features/members/
  MemberList/
    MemberList.tsx
    MemberListItem.tsx
    MemberListFilters.tsx
  MemberDetail/
    MemberDetail.tsx
    MemberInfo.tsx
    PaymentHistory.tsx
  MemberForm/
    MemberForm.tsx
    PersonalInfoFields.tsx
    PlanSelectionFields.tsx
```

**Benefits**:
- Easy to find related code
- Easy to delete entire features
- Colocated tests with components

---

## Migration Plan

### Phase 1: Foundation (Week 1-2)

**Goal**: Setup new structure, move utilities

**Tasks**:
1. Create new directory structure
2. Move date utilities to `core/utils/date/`
3. Create `PlanConfig.ts`, `ReminderConfig.ts`, `StatusConfig.ts`
4. Create `ApiResponse.ts` wrapper
5. Setup error classes

**Deliverables**:
- New folders created
- Date utilities centralized
- Constants extracted
- API response standardized

---

### Phase 2: Core Domain (Week 2-3)

**Goal**: Extract business entities and rules

**Tasks**:
1. Create `Member`, `Payment`, `Plan` entities
2. Create `MemberLifecycle` state machine
3. Create `ReminderRule` with plan-specific logic
4. Create `PaymentCalculator` for discount logic
5. Create interfaces in `ports/`

**Deliverables**:
- Domain models defined
- Business rules extracted
- Interfaces defined
- Unit tests for domain logic

---

### Phase 3: Use Cases (Week 3-4)

**Goal**: Centralize application logic

**Tasks**:
1. Create `RegisterMember` use case
2. Create `CollectPayment` use case (single flow)
3. Create `CalculateNextDueDate` use case
4. Create `SendAutomatedReminders` use case
5. Move business logic from routes to use cases

**Deliverables**:
- Use cases implemented
- Business logic removed from routes
- Use case tests

---

### Phase 4: Infrastructure (Week 4-5)

**Goal**: Implement concrete adapters

**Tasks**:
1. Create `MemberRepository` implementing `IMemberRepository`
2. Create `PaymentRepository`
3. Create `SMSRepository`
4. Refactor Supabase access to use repositories
5. Move cron jobs to `infrastructure/cron/jobs/`

**Deliverables**:
- Repositories implemented
- Database access abstracted
- Cron jobs refactored

---

### Phase 5: Application Layer (Week 5-6)

**Goal**: Implement controllers and CQRS

**Tasks**:
1. Create controllers (`MemberController`, `PaymentController`)
2. Implement queries (`GetMemberList`, `GetPaymentHistory`)
3. Implement commands (`CreateMember`, `CollectPayment`)
4. Refactor API routes to use controllers
5. Add error middleware

**Deliverables**:
- Controllers implemented
- CQRS pattern applied
- API routes refactored
- Error handling centralized

---

### Phase 6: Presentation (Week 6-7)

**Goal**: Reorganize UI components

**Tasks**:
1. Reorganize components by feature
2. Create API hooks (`useMembers`, `useMember`)
3. Extract business logic from components
4. Add loading/error states
5. Create `ErrorBoundary` component

**Deliverables**:
- Components reorganized
- API hooks created
- UI logic simplified
- Error handling improved

---

### Phase 7: Testing & Cleanup (Week 7-8)

**Goal**: Add tests and remove dead code

**Tasks**:
1. Add unit tests for core domain
2. Add integration tests for use cases
3. Add API tests for controllers
4. Remove deprecated routes (installments, billing-setup)
5. Remove unused directories (`/src/types/`, `/src/services/`)
6. Update documentation

**Deliverables**:
- Test coverage > 70%
- Dead code removed
- Documentation updated
- Architecture diagram created

---

## Benefits

### 1. Maintainability
- **Single source of truth**: Change logic in one place
- **Clear structure**: Easy to find code
- **Consistent patterns**: New features follow same structure

### 2. Testability
- **Pure functions**: Core logic testable without database
- **Dependency injection**: Easy to mock dependencies
- **Clear boundaries**: Test each layer independently

### 3. Scalability
- **CQRS**: Scale reads and writes independently
- **Modular**: Add features without touching existing code
- **Tree-shakeable**: Bundle only what's used

### 4. Developer Experience
- **Clear ownership**: Each module has one responsibility
- **Easy onboarding**: Consistent structure
- **Less debugging**: Centralized logic reduces bugs

### 5. Performance
- **Optimized queries**: CQRS allows query optimization
- **No redundant calculations**: Centralized logic
- **Efficient bundling**: Tree-shaking removes unused code

---

## Examples

### Example 1: Calculating Next Due Date

**Before** (scattered):
```typescript
// Location 1: member.service.ts
const nextDueDate = new Date(input.membershipStartDate);
switch (input.planType) {
  case 'monthly':
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    break;
  // ...
}

// Location 2: payment.service.ts
const nextDueDate = new Date(paymentDate);
switch (memberRow.plan_type) {
  case 'monthly':
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    break;
  // ...
}

// Location 3: PaymentModal.tsx
case 'monthly':
  nextDue.setDate(nextDue.getDate() + 30);  // BUG!
```

**After** (centralized):
```typescript
// core/use-cases/payment/CalculateNextDueDate.ts
export class CalculateNextDueDate {
  static forPlan(planType: PlanType, startDate: Date): Date {
    const config = PLAN_CONFIG[planType];
    const result = new Date(startDate);

    if (config.durationMethod === 'month') {
      result.setMonth(result.getMonth() + config.durationMonths);
    } else {
      result.setDate(result.getDate() + config.durationDays);
    }

    return result;
  }
}

// Used everywhere
import { CalculateNextDueDate } from '@/core/use-cases/payment';

const nextDueDate = CalculateNextDueDate.forPlan(
  PlanType.Monthly,
  new Date()
);
```

---

### Example 2: Collecting Payment

**Before** (scattered):
```typescript
// payment.service.ts - 150+ lines
export async function collectPayment(gymId, input) {
  // Fetch member + discount + gym (40 lines)
  // Calculate next due date (30 lines)
  // Parallel writes (40 lines)
  // Send SMS async (30 lines)
  // Reset 4 reminder flags (10 lines)
}
```

**After** (clean):
```typescript
// core/use-cases/payment/CollectPayment.ts
export class CollectPayment {
  constructor(
    private memberRepo: IMemberRepository,
    private paymentRepo: IPaymentRepository,
    private smsService: ISMSProvider
  ) {}

  async execute(memberId: string, input: CollectPaymentDTO): Promise<Payment> {
    // 1. Get member
    const member = await this.memberRepo.findById(memberId);

    // 2. Calculate next due date (delegated)
    const nextDueDate = CalculateNextDueDate.forPlan(
      member.planType,
      input.paymentDate
    );

    // 3. Create payment
    const payment = await this.paymentRepo.create({
      memberId,
      amount: PaymentCalculator.calculateAmount(
        member.planAmount,
        input.discount
      ),
      date: input.paymentDate
    });

    // 4. Update member (state machine enforced)
    const updatedMember = MemberLifecycle.activate(member, nextDueDate);
    await this.memberRepo.update(memberId, updatedMember);

    // 5. Send receipt
    await this.smsService.sendReceipt(member, payment);

    return payment;
  }
}

// application/api/http/controllers/PaymentController.ts
export class PaymentController {
  constructor(private collectPaymentUseCase: CollectPayment) {}

  async collect(req: Request): Promise<ApiResponse<PaymentDTO>> {
    const data = collectPaymentSchema.parse(await req.json());
    const payment = await this.collectPaymentUseCase.execute(
      req.params.id,
      data
    );
    return ApiResponse.success(PaymentDTO.fromDomain(payment));
  }
}

// presentation/app/api/members/[id]/payment/route.ts
const controller = container.resolve(PaymentController);

export async function POST(req: Request) {
  return controller.collect(req);
}
```

---

### Example 3: Sending Reminders

**Before** (complex):
```typescript
// reminder.service.ts - 500+ lines
export async function sendAutomatedReminders() {
  // Hardcoded rules
  if (planType === 'daily') {
    continue;  // Skip daily
  }

  if (daysUntilDue === 7) {
    if (planType === 'monthly') {
      continue;  // Monthly skips 7-day
    }
    smsType = 'reminder_7day';
  }

  // Duplicate prevention query
  const existing = await supabase
    .from('sms_logs')
    .select('id')
    .eq('member_id', member.id)
    .eq('sms_type', smsType)
    .gte('sent_at', todayStart)
    .single();

  // Update 4 flags
  if (smsType === 'reminder_7day') {
    flagUpdates.reminder_7day_sent_this_period = true;
  }
  // ... etc
}
```

**After** (clean):
```typescript
// core/domain/reminder/ReminderRule.ts
export class ReminderRule {
  private static readonly RULES: Record<PlanType, number[]> = {
    [PlanType.Daily]: [],           // No reminders
    [PlanType.Weekly]: [7, 3, 0],   // All reminders
    [PlanType.Monthly]: [3, 0],     // Skip 7-day
    [PlanType.ThreeMonths]: [7, 3, 0],
    [PlanType.SixMonths]: [7, 3, 0],
    [PlanType.Annual]: [7, 3, 0],
  };

  static getReminderDays(planType: PlanType): number[] {
    return this.RULES[planType] || [];
  }

  static shouldSendReminder(
    planType: PlanType,
    daysUntilDue: number
  ): boolean {
    return this.getReminderDays(planType).includes(daysUntilDue);
  }
}

// core/use-cases/reminder/SendAutomatedReminders.ts
export class SendAutomatedReminders {
  constructor(
    private memberRepo: IMemberRepository,
    private smsRepo: ISMSRepository,
    private smsService: ISMSProvider
  ) {}

  async execute(): Promise<void> {
    const members = await this.memberRepo.findAllActive();

    for (const member of members) {
      const daysUntilDue = DaysUntilDue.calculate(member.nextDueDate);

      // Use centralized rule
      if (!ReminderRule.shouldSendReminder(member.planType, daysUntilDue)) {
        continue;
      }

      // Check if already sent (simplified)
      const alreadySent = await this.smsRepo.existsForToday(
        member.id,
        ReminderType.fromDays(daysUntilDue)
      );

      if (alreadySent) continue;

      // Send (no flag updates needed)
      await this.smsService.sendReminder(member, daysUntilDue);
    }
  }
}
```

---

## Conclusion

This architecture addresses all critical issues identified in the current codebase:

✅ **Centralized business logic** - Single source of truth
✅ **Dependency inversion** - Easy to test and swap dependencies
✅ **State machine** - Enforced status transitions
✅ **Standardized responses** - Consistent API contracts
✅ **CQRS pattern** - Optimized reads and writes
✅ **Feature organization** - Easy to find and maintain code
✅ **Tree-shakeable** - Efficient bundling

The migration can be done incrementally over 7-8 weeks without breaking existing functionality.

**Next Steps**:
1. Review and approve architecture
2. Start with Phase 1 (Foundation)
3. Migrate feature-by-feature
4. Add tests continuously
5. Document as you go

---

**Document Version**: 1.0
**Last Updated**: 2026-03-24
**Status**: ✅ Ready for Review
