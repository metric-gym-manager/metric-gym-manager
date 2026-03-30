# Clean Architecture Implementation Guide

## Overview

This document describes the Clean Architecture implementation for the Gym Management SaaS platform. The architecture follows the principles of **Dependency Inversion**, **Separation of Concerns**, and **Domain-Driven Design**.

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│          Presentation Layer (UI)                │
│    (React Components, React Query Hooks)        │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│          Application Layer                       │
│    (Next.js API Routes, DI Container)           │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│          Use Cases Layer                         │
│  (RegisterMember, CollectPayment, etc.)         │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│          Domain Layer (Core)                     │
│  (Entities, Value Objects, Interfaces)          │
└──────────────▲──────────────────────────────────┘
               │
┌──────────────┴──────────────────────────────────┐
│          Infrastructure Layer                    │
│  (Supabase Repositories, SMS Providers)         │
└─────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── core/                          # Domain Layer (No external dependencies)
│   ├── domain/
│   │   ├── member/
│   │   │   └── Member.ts         # Member aggregate root with state machine
│   │   ├── payment/
│   │   │   ├── Payment.ts        # Payment entity
│   │   │   └── PaymentCalculator.ts
│   │   └── value-objects/
│   │       ├── PhoneNumber.ts    # Validated phone number
│   │       └── Money.ts          # Money value object
│   ├── ports/
│   │   ├── repositories/         # Repository interfaces
│   │   │   ├── IMemberRepository.ts
│   │   │   ├── IPaymentRepository.ts
│   │   │   └── ISMSRepository.ts
│   │   └── services/             # Service interfaces
│   │       ├── ISMSProvider.ts
│   │       └── IStorageProvider.ts
│   ├── use-cases/                # Application business logic
│   │   ├── member/
│   │   │   ├── RegisterMember.ts
│   │   │   ├── UpdateExpiredStatus.ts
│   │   │   └── CancelOverdueMembers.ts
│   │   ├── payment/
│   │   │   └── CollectPayment.ts
│   │   └── reminder/
│   │       └── SendAutomatedReminders.ts
│   └── utils/
│       ├── date/                 # Centralized date calculations
│       ├── constants/            # Business rules & configurations
│       ├── api/                  # API response standardization
│       └── errors/               # Domain-specific errors
│
├── infrastructure/                # Infrastructure Layer (Adapters)
│   ├── database/
│   │   └── repositories/
│   │       ├── SupabaseMemberRepository.ts
│   │       ├── SupabasePaymentRepository.ts
│   │       └── SupabaseSMSRepository.ts
│   ├── sms/
│   │   └── providers/
│   │       ├── TextLkSMSProvider.ts    # Real SMS provider
│   │       └── MockSMSProvider.ts      # Test/dev SMS provider
│   └── di/
│       └── Container.ts          # Dependency Injection container
│
├── presentation/                  # Presentation Layer
│   └── hooks/
│       └── api/
│           ├── useMembers.ts     # React Query hooks for members
│           ├── useMember.ts
│           └── usePayments.ts
│
└── app/                          # Next.js App Router (Application Layer)
    └── api/
        ├── members/              # Member API routes
        ├── payments/             # Payment API routes
        └── cron/                 # Scheduled jobs
```

## Core Principles

### 1. Dependency Inversion

**Rule**: Core domain does not depend on infrastructure. Infrastructure depends on core.

```typescript
// ❌ BAD: Domain depends on Supabase
class Member {
  async save() {
    const supabase = createClient();
    await supabase.from('members').insert(this.toDatabase());
  }
}

// ✅ GOOD: Domain defines interface, infrastructure implements
interface IMemberRepository {
  create(member: Member): Promise<Member>;
}

class SupabaseMemberRepository implements IMemberRepository {
  async create(member: Member): Promise<Member> {
    // Supabase-specific implementation
  }
}
```

### 2. Immutability in Domain

**Rule**: Domain entities return new instances instead of mutating state.

```typescript
// ❌ BAD: Mutable entity
class Member {
  activate(nextDueDate: Date) {
    this.status = 'active';
    this.nextDueDate = nextDueDate;
  }
}

// ✅ GOOD: Immutable entity
class Member {
  activate(nextDueDate: Date): Member {
    return new Member({
      ...this.props,
      status: MemberStatus.Active,
      nextDueDate,
    });
  }
}
```

### 3. State Machine Enforcement

**Rule**: Invalid status transitions are prevented at compile-time or runtime.

```typescript
// Valid transitions defined in StatusConfig.ts
const VALID_TRANSITIONS = [
  { from: MemberStatus.Active, to: MemberStatus.Expired },
  { from: MemberStatus.Expired, to: MemberStatus.Active },
  { from: MemberStatus.Expired, to: MemberStatus.Cancelled },
  // ... 9 more valid transitions
];

// Enforce transitions in Member entity
activate(nextDueDate: Date): Member {
  if (!canTransition(this.status, MemberStatus.Active)) {
    throw new InvalidStatusTransitionError(this.status, MemberStatus.Active);
  }
  return new Member({ ...this.props, status: MemberStatus.Active });
}
```

### 4. Centralized Business Rules

**Rule**: Business logic lives in one place, not scattered across the codebase.

```typescript
// ❌ BAD: Business logic duplicated in 3 places
// member.service.ts, payment.service.ts, PaymentCollectionModal.tsx

// ✅ GOOD: Centralized in core/utils/date/calculateNextDueDate.ts
export function calculateNextDueDate(
  startDate: Date,
  planType: PlanType
): Date {
  // Single source of truth for date calculations
}

// ✅ GOOD: Centralized in core/utils/constants/ReminderConfig.ts
export const REMINDER_RULES: Record<PlanType, ReminderRule> = {
  [PlanType.Daily]: { reminderDays: [] },       // No reminders
  [PlanType.Monthly]: { reminderDays: [3, 0] }, // Skip 7-day
  // ... other plans
};
```

## Key Components

### 1. Domain Entities

#### Member Entity (src/core/domain/member/Member.ts)

The Member entity is an **aggregate root** with a state machine:

```typescript
export class Member {
  private constructor(private readonly props: MemberProps) {}

  // Factory methods
  static create(props: CreateMemberProps): Member
  static fromDatabase(props: MemberProps): Member

  // Queries (read-only)
  get id(): string
  get name(): string
  get status(): MemberStatus
  isActive(): boolean
  isOverdue(): boolean
  canCheckIn(): boolean
  getDaysUntilDue(): number

  // Commands (return new instances)
  activate(nextDueDate: Date): Member
  expire(): Member
  cancel(): Member
  suspend(): Member
  freeze(): Member
  updateName(name: string): Member
  updatePhoneNumber(phoneNumber: string): Member

  // Mapping
  toDatabase(): MemberProps
}
```

**State Transitions**:
- Active → Expired (system)
- Expired → Active (payment)
- Expired → Cancelled (45+ days overdue)
- Active → Frozen (user request)
- Frozen → Active (user request)
- Active → Suspended (violation)
- Suspended → Active (resolved)
- Cancelled is **terminal** (no transitions out)

#### Payment Entity (src/core/domain/payment/Payment.ts)

```typescript
export class Payment {
  static create(props: CreatePaymentProps): Payment
  static fromDatabase(props: PaymentProps): Payment

  get id(): string
  get memberId(): string
  get paymentAmount(): number
  get nextDueDate(): Date

  toDatabase(): PaymentProps
}
```

### 2. Value Objects

#### PhoneNumber (src/core/domain/value-objects/PhoneNumber.ts)

```typescript
export class PhoneNumber {
  private constructor(private readonly value: string) {}

  static create(phoneNumber: string): PhoneNumber {
    // Validates and normalizes Sri Lankan phone numbers
    // 0771234567 → +94771234567
    // +94771234567 → +94771234567
  }

  getValue(): string              // +94771234567
  getDisplayValue(): string       // (077) 123-4567
  equals(other: PhoneNumber): boolean
}
```

#### Money (src/core/domain/value-objects/Money.ts)

```typescript
export class Money {
  private constructor(
    private readonly amount: number,
    private readonly currency: string = 'LKR'
  ) {}

  static create(amount: number, currency?: string): Money

  getAmount(): number
  getCurrency(): string
  add(other: Money): Money
  subtract(other: Money): Money
  multiply(factor: number): Money
  equals(other: Money): boolean
  format(): string                // "LKR 5,000.00"
}
```

### 3. Repository Interfaces

#### IMemberRepository (src/core/ports/repositories/IMemberRepository.ts)

```typescript
export interface IMemberRepository {
  // Single member operations
  findById(id: string, gymId: string): Promise<Member | null>
  create(member: Member): Promise<Member>
  update(member: Member): Promise<Member>
  delete(id: string, gymId: string): Promise<void>

  // Queries
  findAll(filters: MemberFilters): Promise<PaginatedResult<Member>>
  findActiveMembers(gymId: string): Promise<Member[]>
  findAllActiveMembers(): Promise<Member[]>              // Admin only
  findExpiredMembers(gymId: string): Promise<Member[]>
  findAllExpiredMembers(): Promise<Member[]>             // Admin only
  findOverdueMembers(gymId: string): Promise<Member[]>

  // Bulk operations
  updateStatusBatch(memberIds: string[], status: MemberStatus, gymId: string): Promise<void>

  // Analytics
  countByStatus(gymId: string): Promise<Record<MemberStatus, number>>

  // Validation
  findByPhoneNumber(phoneNumber: string, gymId: string): Promise<Member | null>
}
```

### 4. Use Cases

#### RegisterMember (src/core/use-cases/member/RegisterMember.ts)

**Purpose**: Orchestrates member registration with initial payment.

**Dependencies**:
- IMemberRepository
- IPaymentRepository
- ISMSProvider

**Workflow**:
1. Validate phone number format
2. Check for duplicate members
3. Calculate next due date
4. Create member entity
5. Create payment record
6. Send welcome SMS (fire-and-forget)

**Usage**:
```typescript
const container = await getContainer();
const registerMember = container.getRegisterMemberUseCase();

const result = await registerMember.execute({
  gymId: 'gym_123',
  name: 'John Doe',
  phoneNumber: '0771234567',
  planType: PlanType.Monthly,
  planAmount: 5000,
  membershipStartDate: new Date(),
  paymentAmount: 5000,
});

console.log(result.member.id);   // Created member
console.log(result.payment.id);  // Initial payment record
```

#### CollectPayment (src/core/use-cases/payment/CollectPayment.ts)

**Purpose**: Handles payment collection and member renewal (REVENUE-CRITICAL).

**Dependencies**:
- IMemberRepository
- IPaymentRepository
- ISMSProvider

**Workflow**:
1. Fetch member from repository
2. Validate member exists
3. Calculate next due date (with deductOverduePeriod option)
4. Create payment record
5. Activate member (state machine enforced)
6. Reset reminder flags for new billing period
7. Send receipt SMS (fire-and-forget)

**Key Feature**: `deductOverduePeriod` option:
- `true` (default): New cycle starts from payment date (deduct overdue days)
- `false`: New cycle starts from original due date (no penalty)

**Usage**:
```typescript
const container = await getContainer();
const collectPayment = container.getCollectPaymentUseCase();

const result = await collectPayment.execute({
  gymId: 'gym_123',
  memberId: 'member_456',
  paymentDate: new Date(),
  paymentAmount: 5000,
  deductOverduePeriod: true, // Default behavior
});

console.log(result.member.status);        // 'active'
console.log(result.member.nextDueDate);   // Calculated date
console.log(result.payment.id);           // Payment record
```

#### SendAutomatedReminders (src/core/use-cases/reminder/SendAutomatedReminders.ts)

**Purpose**: Sends payment reminders based on centralized business rules.

**Dependencies**:
- IMemberRepository
- ISMSRepository
- ISMSProvider

**Workflow**:
1. Fetch active members (gym-specific or all gyms for cron)
2. For each member, calculate days until due
3. Check if reminder should be sent (based on PlanType-specific rules)
4. Check for duplicate (already sent today)
5. Send appropriate SMS (7-day, 3-day, or due-today)
6. Log SMS record in database

**Reminder Rules** (defined in ReminderConfig.ts):
- **Daily plans**: No automatic reminders
- **Monthly plans**: 3-day + due-today only (skip 7-day)
- **All other plans**: 7-day + 3-day + due-today

**Usage**:
```typescript
const container = await getAdminContainer(); // Admin client bypasses RLS
const sendReminders = container.getSendAutomatedRemindersUseCase();

const summary = await sendReminders.execute();

console.log(summary.totalSent);          // 15
console.log(summary.byType);             // { '7-day': 5, '3-day': 7, 'due-today': 3 }
console.log(summary.errors);             // []
```

### 5. Infrastructure Implementations

#### SupabaseMemberRepository (src/infrastructure/database/repositories/SupabaseMemberRepository.ts)

**Implements**: `IMemberRepository`

**Key Responsibilities**:
- Maps domain entities ↔ database rows
- Enforces Row Level Security (RLS) policies
- Handles pagination for list queries
- Performs batch updates efficiently

**Mapping Layer**:
```typescript
class SupabaseMemberRepository implements IMemberRepository {
  // Domain → Database (snake_case)
  private toDatabase(member: Member): MemberRow {
    const props = member.toDatabase();
    return {
      id: props.id,
      gym_id: props.gymId,
      phone_number: props.phoneNumber,
      plan_type: props.planType,
      plan_amount: props.planAmount,
      next_due_date: props.nextDueDate.toISOString(),
      // ... all fields mapped
    };
  }

  // Database → Domain (camelCase)
  private toDomain(row: MemberRow): Member {
    return Member.fromDatabase({
      id: row.id,
      gymId: row.gym_id,
      phoneNumber: row.phone_number,
      planType: row.plan_type as PlanType,
      planAmount: row.plan_amount,
      nextDueDate: new Date(row.next_due_date),
      // ... all fields mapped
    });
  }
}
```

**RLS Integration**:
- Repository uses Supabase client with RLS enabled
- All queries automatically scoped to current gym
- Admin operations use `createAdminClient()` to bypass RLS

#### TextLkSMSProvider (src/infrastructure/sms/providers/TextLkSMSProvider.ts)

**Implements**: `ISMSProvider`

**Configuration**:
```typescript
// .env.local
ENABLE_REAL_SMS=true
TEXTLK_API_KEY=your_api_key
TEXTLK_SENDER_ID=your_sender_id
```

**Usage**:
```typescript
const container = await getContainer();
const smsProvider = container.getSMSProvider(); // Returns TextLkSMSProvider or MockSMSProvider

const result = await smsProvider.send({
  to: '+94771234567',
  message: 'Your payment is due in 3 days. Please renew your membership.',
});

console.log(result.success);    // true
console.log(result.messageId);  // 'textlk_uid_xyz'
```

#### MockSMSProvider (src/infrastructure/sms/providers/MockSMSProvider.ts)

**Purpose**: Test/development SMS provider that logs messages without sending.

**Configuration**:
```typescript
// .env.local
ENABLE_REAL_SMS=false  // or omit entirely
```

**Behavior**:
```typescript
const result = await mockSmsProvider.send({
  to: '+94771234567',
  message: 'Test message',
});

// Console output:
// 📱 [MOCK SMS] Sending SMS (not actually sent):
//    To: +94771234567
//    Message: Test message

console.log(result.success);    // true (always succeeds)
console.log(result.messageId);  // 'mock_1234567890'
```

### 6. Dependency Injection Container

#### Container (src/infrastructure/di/Container.ts)

**Purpose**: Centralized dependency wiring with lazy initialization.

**Available Factories**:
```typescript
class Container {
  // Repositories
  getMemberRepository(): IMemberRepository
  getPaymentRepository(): IPaymentRepository
  getSMSRepository(): ISMSRepository

  // Services
  getSMSProvider(): ISMSProvider        // TextLk or Mock based on env
  getStorageProvider(): IStorageProvider

  // Use Cases
  getRegisterMemberUseCase(): RegisterMember
  getCollectPaymentUseCase(): CollectPayment
  getSendAutomatedRemindersUseCase(): SendAutomatedReminders
  getUpdateExpiredStatusUseCase(): UpdateExpiredStatus
  getCancelOverdueMembersUseCase(): CancelOverdueMembers
}
```

**Usage in API Routes**:
```typescript
// User-specific container (respects RLS)
import { getContainer } from '@/infrastructure/di';

export async function POST(request: NextRequest) {
  const container = await getContainer();
  const useCase = container.getRegisterMemberUseCase();
  const result = await useCase.execute(input);
  return NextResponse.json(result);
}
```

**Usage in Cron Jobs**:
```typescript
// Admin container (bypasses RLS for cross-gym operations)
import { getAdminContainer } from '@/infrastructure/di';

export async function POST(request: NextRequest) {
  const container = await getAdminContainer();
  const useCase = container.getSendAutomatedRemindersUseCase();
  const result = await useCase.execute();
  return NextResponse.json(result);
}
```

### 7. Presentation Layer Hooks

#### useMembers (src/presentation/hooks/api/useMembers.ts)

**Purpose**: React Query hook for fetching and managing members list.

**Usage**:
```typescript
import { useMembers, useCreateMember } from '@/presentation/hooks/api';

function MembersList() {
  const { data, isLoading, error } = useMembers({
    search: 'John',
    status: 'active',
    planType: 'monthly',
    page: 1,
    limit: 20,
  });

  const createMember = useCreateMember();

  const handleCreate = async () => {
    await createMember.mutateAsync({
      name: 'John Doe',
      phoneNumber: '0771234567',
      planType: 'monthly',
      planAmount: 5000,
      membershipStartDate: '2024-01-01',
      paymentAmount: 5000,
    });
    // Automatically invalidates 'members' query and refetches
  };

  return (
    <div>
      {data?.members.map(member => (
        <div key={member.id}>{member.name}</div>
      ))}
    </div>
  );
}
```

#### useCollectPayment (src/presentation/hooks/api/usePayments.ts)

**Purpose**: React Query mutation for collecting payments.

**Usage**:
```typescript
import { useCollectPayment } from '@/presentation/hooks/api';

function PaymentCollectionModal({ memberId }) {
  const collectPayment = useCollectPayment();

  const handleSubmit = async (data) => {
    await collectPayment.mutateAsync({
      memberId,
      paymentDate: data.paymentDate,
      paymentAmount: data.paymentAmount,
      deductOverduePeriod: data.deductOverduePeriod,
    });
    // Automatically:
    // - Shows success toast
    // - Invalidates members, payments, and reminders queries
    // - Triggers refetch
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## API Routes Integration

### Standard Pattern for API Routes

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { NotFoundError } from '@/core/utils/errors';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate and get gym context
    const gymProfile = await getCurrentGymProfile();

    // 2. Validate input with Zod
    const body = await request.json();
    const validatedData = schema.parse(body);

    // 3. Get use case via DI container
    const container = await getContainer();
    const useCase = container.getSomeUseCase();

    // 4. Execute use case
    const result = await useCase.execute({
      gymId: gymProfile.id,
      ...validatedData,
    });

    // 5. Return standardized response
    return NextResponse.json(
      ResponseBuilder.success(result),
      { status: 200 }
    );
  } catch (error) {
    // 6. Handle errors with appropriate status codes
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        ResponseBuilder.notFound(error.message),
        { status: 404 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.error('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}
```

### Cron Job Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAdminContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        ResponseBuilder.unauthorized(),
        { status: 401 }
      );
    }

    // 2. Get admin container (bypasses RLS)
    const container = await getAdminContainer();
    const useCase = container.getSomeUseCase();

    // 3. Execute use case across all gyms
    const result = await useCase.execute();

    // 4. Return summary
    return NextResponse.json(
      ResponseBuilder.success(result),
      { status: 200 }
    );
  } catch (error) {
    console.error('Cron error:', error);

    return NextResponse.json(
      ResponseBuilder.error('Cron job failed', 'CRON_ERROR'),
      { status: 500 }
    );
  }
}
```

## Testing Strategy

### 1. Domain Layer Tests (70% coverage)

**Unit tests for**:
- Member entity state transitions
- Value object validation (PhoneNumber, Money)
- Payment calculations
- Business rule functions (calculateNextDueDate, shouldSendReminder)

**Example**:
```typescript
describe('Member', () => {
  it('should transition from expired to active on payment', () => {
    const expiredMember = Member.fromDatabase({
      ...props,
      status: MemberStatus.Expired,
    });

    const activeMember = expiredMember.activate(new Date('2024-02-01'));

    expect(activeMember.status).toBe(MemberStatus.Active);
    expect(activeMember.nextDueDate).toEqual(new Date('2024-02-01'));
  });

  it('should prevent invalid transition from cancelled to active', () => {
    const cancelledMember = Member.fromDatabase({
      ...props,
      status: MemberStatus.Cancelled,
    });

    expect(() => {
      cancelledMember.activate(new Date());
    }).toThrow(InvalidStatusTransitionError);
  });
});
```

### 2. Use Case Integration Tests (20% coverage)

**Integration tests for**:
- RegisterMember workflow
- CollectPayment workflow
- SendAutomatedReminders workflow
- Repository interactions (with test database)

**Example**:
```typescript
describe('RegisterMember', () => {
  it('should register member with initial payment', async () => {
    const useCase = new RegisterMember(
      mockMemberRepo,
      mockPaymentRepo,
      mockSmsProvider
    );

    const result = await useCase.execute({
      gymId: 'gym_123',
      name: 'John Doe',
      phoneNumber: '0771234567',
      planType: PlanType.Monthly,
      planAmount: 5000,
      membershipStartDate: new Date('2024-01-01'),
      paymentAmount: 5000,
    });

    expect(result.member.status).toBe(MemberStatus.Active);
    expect(result.payment.paymentAmount).toBe(5000);
    expect(mockSmsProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+94771234567' })
    );
  });
});
```

### 3. E2E Tests (10% coverage)

**End-to-end tests for**:
- Member registration flow
- Payment collection flow
- Critical user journeys

## Migration from Old Architecture

### Before (Service Layer Pattern)

```
src/
├── features/
│   ├── members/
│   │   └── services/
│   │       ├── member.service.ts      # ❌ Deleted
│   │       └── payment.service.ts     # ❌ Deleted
│   └── sms/
│       └── services/
│           ├── reminder.service.ts    # ❌ Deleted
│           ├── sms.service.ts         # ⚠️  Kept (legacy)
│           └── textlk.service.ts      # ⚠️  Kept (legacy)
```

**Problems**:
- Business logic duplicated across services (date calculations in 3 places)
- No state machine for member status (invalid transitions possible)
- Tight coupling to Supabase (hard to test)
- No separation of concerns (business logic mixed with data access)

### After (Clean Architecture)

```
src/
├── core/                    # ✅ Domain + Use Cases (no dependencies)
├── infrastructure/          # ✅ Adapters (Supabase, SMS providers)
├── presentation/            # ✅ React Query hooks
└── app/api/                 # ✅ Next.js routes (thin layer)
```

**Benefits**:
- Single source of truth for business logic
- State machine enforced at domain level
- Testable (dependency injection)
- Clear separation of concerns
- Easy to swap infrastructure (e.g., PostgreSQL → MySQL)

### Key Changes

| Old Approach | New Approach |
|-------------|-------------|
| `createMember(gymId, data)` | `RegisterMember.execute(input)` |
| `collectPayment(memberId, data)` | `CollectPayment.execute(input)` |
| `sendAutomatedReminders()` | `SendAutomatedReminders.execute()` |
| Direct Supabase calls | Repository pattern via interfaces |
| Scattered date logic | Centralized in `calculateNextDueDate()` |
| Hardcoded reminder rules | Centralized in `ReminderConfig.ts` |
| No state machine | State machine in `Member` entity |

## Best Practices

### 1. Always Use DI Container

```typescript
// ❌ BAD: Direct instantiation
const repo = new SupabaseMemberRepository(supabase);
const useCase = new RegisterMember(repo, paymentRepo, smsProvider);

// ✅ GOOD: Use DI container
const container = await getContainer();
const useCase = container.getRegisterMemberUseCase();
```

### 2. Keep Domain Pure

```typescript
// ❌ BAD: Domain imports infrastructure
import { createClient } from '@/lib/supabase/server';

class Member {
  async save() {
    const supabase = createClient();
    await supabase.from('members').insert(this.toDatabase());
  }
}

// ✅ GOOD: Domain only defines interfaces
export interface IMemberRepository {
  create(member: Member): Promise<Member>;
}
```

### 3. Use Value Objects for Validation

```typescript
// ❌ BAD: Validation scattered
if (!phoneNumber.startsWith('+94')) {
  throw new Error('Invalid phone');
}

// ✅ GOOD: Validation in value object
const phoneNumber = PhoneNumber.create('0771234567'); // Automatically validates and normalizes
```

### 4. Prefer Immutability

```typescript
// ❌ BAD: Mutation
member.status = 'active';
await repo.update(member);

// ✅ GOOD: Immutability
const activeMember = member.activate(nextDueDate);
await repo.update(activeMember);
```

### 5. Centralize Business Rules

```typescript
// ❌ BAD: Business logic in component
const nextDueDate = new Date(paymentDate);
nextDueDate.setDate(nextDueDate.getDate() + 30); // Bug! (should use setMonth)

// ✅ GOOD: Centralized utility
import { calculateNextDueDate } from '@/core/utils/date';
const nextDueDate = calculateNextDueDate(paymentDate, planType);
```

## Common Patterns

### Pattern 1: Creating Domain Entities

```typescript
// From user input (validation required)
const member = Member.create({
  gymId: 'gym_123',
  name: 'John Doe',
  phoneNumber: '+94771234567',
  planType: PlanType.Monthly,
  // ... all required fields
});

// From database (already validated)
const member = Member.fromDatabase(dbRow);
```

### Pattern 2: Repository Queries

```typescript
// Single record
const member = await memberRepo.findById('member_123', 'gym_123');
if (!member) throw new NotFoundError('Member not found');

// List with filters
const result = await memberRepo.findAll({
  gymId: 'gym_123',
  status: MemberStatus.Active,
  page: 1,
  limit: 20,
});
console.log(result.items);       // Member[]
console.log(result.totalCount);  // 150
console.log(result.totalPages);  // 8
```

### Pattern 3: Use Case Execution

```typescript
// 1. Get container
const container = await getContainer();

// 2. Get use case
const useCase = container.getCollectPaymentUseCase();

// 3. Execute with input
const result = await useCase.execute({
  gymId: 'gym_123',
  memberId: 'member_456',
  paymentDate: new Date(),
  paymentAmount: 5000,
});

// 4. Use result
console.log(result.member.status);        // 'active'
console.log(result.payment.id);           // 'payment_789'
```

### Pattern 4: Error Handling

```typescript
try {
  const result = await useCase.execute(input);
  return ResponseBuilder.success(result);
} catch (error) {
  if (error instanceof NotFoundError) {
    return ResponseBuilder.notFound(error.message);
  }
  if (error instanceof ValidationError) {
    return ResponseBuilder.validationError(error.errors);
  }
  if (error instanceof ConflictError) {
    return ResponseBuilder.conflict(error.message);
  }
  return ResponseBuilder.error('Internal error', 'INTERNAL_ERROR');
}
```

## Troubleshooting

### Issue: "Member not found" in tests

**Cause**: Using user container in tests that require admin access.

**Solution**: Use `getAdminContainer()` for tests that query across gyms.

### Issue: Invalid status transition error

**Cause**: Attempting an invalid state transition (e.g., cancelled → active).

**Solution**: Review valid transitions in `StatusConfig.ts` and use appropriate methods.

### Issue: SMS not sending in development

**Cause**: `ENABLE_REAL_SMS` is not set to `true`.

**Solution**: Check `.env.local`:
```bash
ENABLE_REAL_SMS=true
TEXTLK_API_KEY=your_api_key
TEXTLK_SENDER_ID=your_sender_id
```

### Issue: Date calculations incorrect

**Cause**: Using `setDate()` instead of `setMonth()` for monthly plans.

**Solution**: Always use `calculateNextDueDate()` utility instead of manual date manipulation.

## Future Enhancements

1. **Command Query Responsibility Segregation (CQRS)**
   - Separate read models from write models
   - Optimize query performance with denormalized views

2. **Event Sourcing**
   - Store domain events (MemberRegistered, PaymentCollected, etc.)
   - Rebuild state from events for auditing

3. **Domain Events**
   - Publish events from use cases
   - Decouple side effects (SMS, email) from main workflow

4. **Additional Use Cases**
   - ArchiveOldMembers
   - GenerateRevenuereport
   - ExportMembersToCSV

5. **Enhanced Validation**
   - More value objects (Email, Address, etc.)
   - Custom validators for business rules

## References

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Hexagonal Architecture (Ports and Adapters)](https://alistair.cockburn.us/hexagonal-architecture/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

## Summary

This Clean Architecture implementation provides:

- ✅ **Separation of Concerns**: Clear boundaries between layers
- ✅ **Testability**: Pure domain logic with dependency injection
- ✅ **Maintainability**: Single source of truth for business rules
- ✅ **Scalability**: Easy to add new features without breaking existing code
- ✅ **Flexibility**: Swap infrastructure without touching domain
- ✅ **Type Safety**: Strong TypeScript types throughout
- ✅ **State Machine**: Invalid transitions prevented at compile/runtime
- ✅ **Immutability**: Predictable entity behavior

The architecture follows industry best practices and is production-ready for a multi-tenant SaaS application.
