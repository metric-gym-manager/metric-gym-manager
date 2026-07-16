import { serializeMemberForAPI } from '../utils/serializeMemberForAPI';
import { Member, MemberStatus } from '../domain/Member';
import { PlanType } from '../config/PlanConfig';

describe('serializeMemberForAPI', () => {
  const member = Member.fromDatabase({
    id: 'member-1',
    gymId: 'gym-1',
    name: 'Test Member',
    phoneNumber: '+94771234567',
    planType: PlanType.Monthly,
    planAmount: 5000,
    discountId: null,
    recurringDiscount: false,
    status: MemberStatus.Active,
    registeredDate: new Date('2026-01-15T00:00:00Z'),
    membershipStartDate: new Date('2026-01-15T00:00:00Z'),
    nextDueDate: new Date('2026-02-14T00:00:00Z'),
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-15T10:00:00Z'),
  });

  it('serializes dates as YYYY-MM-DD and emits camelCase + snake_case pairs', () => {
    const out = serializeMemberForAPI(member);

    expect(out.id).toBe('member-1');
    expect(out.nextDueDate).toBe('2026-02-14');
    expect(out.next_due_date).toBe('2026-02-14');
    expect(out.registeredDate).toBe('2026-01-15');
    expect(out.registered_date).toBe('2026-01-15');
    expect(out.phoneNumber).toBe('+94771234567');
    expect(out.phone_number).toBe('+94771234567');
    expect(out.planType).toBe(PlanType.Monthly);
    expect(out.plan_type).toBe(PlanType.Monthly);
    expect(out.discount).toBeNull();
  });

  it('passes joined discount data through', () => {
    const discount = { id: 'd-1', discount_name: 'Student', discount_percentage: 10 };
    const out = serializeMemberForAPI(member, discount);
    expect(out.discount).toEqual(discount);
  });
});
