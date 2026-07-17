/**
 * Unit Tests for Member Domain Entity
 *
 * Tests the Member aggregate root including:
 * - State machine transitions
 * - Business logic methods
 * - Immutability
 * - Factory methods
 */

import { Member, MemberStatus, type MemberProps, type CreateMemberProps } from '../domain/Member';
import { PlanType } from '@/features/members/config/PlanConfig';
import { InvalidStatusTransitionError, ValidationError } from '@/utils/errors';

describe('Member Domain Entity', () => {
  const validMemberProps: CreateMemberProps = {
    gymId: 'gym_123',
    name: 'John Doe',
    phoneNumber: '+94771234567',
    planType: PlanType.Monthly,
    planAmount: 5000,
    discountId: null,
    recurringDiscount: false,
    registeredDate: new Date('2024-01-01'),
    membershipStartDate: new Date('2024-01-01'),
    nextDueDate: new Date('2024-02-01'),
    status: MemberStatus.Active,
  };

  describe('Factory Methods', () => {
    describe('Member.create', () => {
      it('should create a new member with all required properties', () => {
        const member = Member.create(validMemberProps);

        expect(member.id).toBeDefined();
        expect(member.gymId).toBe('gym_123');
        expect(member.name).toBe('John Doe');
        expect(member.phoneNumber).toBe('+94771234567');
        expect(member.planType).toBe(PlanType.Monthly);
        expect(member.planAmount).toBe(5000);
        expect(member.status).toBe(MemberStatus.Active);
        expect(member.nextDueDate).toEqual(new Date('2024-02-01'));
        expect(member.createdAt).toBeInstanceOf(Date);
        expect(member.updatedAt).toBeInstanceOf(Date);
      });

      it('should generate a unique ID for each member', () => {
        const member1 = Member.create(validMemberProps);
        const member2 = Member.create(validMemberProps);

        expect(member1.id).not.toBe(member2.id);
        expect(member1.id.length).toBeGreaterThan(0);
      });

      it('should handle optional discount properties', () => {
        const withDiscount = Member.create({
          ...validMemberProps,
          discountId: 'discount_abc',
          recurringDiscount: true,
        });

        expect(withDiscount.discountId).toBe('discount_abc');
        expect(withDiscount.recurringDiscount).toBe(true);
      });
    });

    describe('Member.fromDatabase', () => {
      it('should recreate member from database props', () => {
        const dbProps: MemberProps = {
          id: 'member_123',
          gymId: 'gym_123',
          name: 'John Doe',
          phoneNumber: '+94771234567',
          planType: PlanType.Monthly,
          planAmount: 5000,
          discountId: null,
          recurringDiscount: false,
          registeredDate: new Date('2024-01-01'),
          membershipStartDate: new Date('2024-01-01'),
          nextDueDate: new Date('2024-02-01'),
          status: MemberStatus.Active,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        };

        const member = Member.fromDatabase(dbProps);

        expect(member.id).toBe('member_123');
        expect(member.name).toBe('John Doe');
        expect(member.status).toBe(MemberStatus.Active);
      });

      it('should preserve exact dates from database', () => {
        const createdAt = new Date('2024-01-01T10:30:00.000Z');
        const updatedAt = new Date('2024-01-15T14:45:00.000Z');
        const nextDueDate = new Date('2024-02-01T00:00:00.000Z');

        const member = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          createdAt,
          updatedAt,
          nextDueDate,
        } as MemberProps);

        expect(member.createdAt).toEqual(createdAt);
        expect(member.updatedAt).toEqual(updatedAt);
        expect(member.nextDueDate).toEqual(nextDueDate);
      });
    });
  });

  describe('State Machine Transitions', () => {
    describe('activate()', () => {
      it('should transition from Expired to Active', () => {
        const expiredMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Expired,
        } as MemberProps);

        const nextDueDate = new Date('2024-03-01');
        const activeMember = expiredMember.activate(nextDueDate);

        expect(activeMember.status).toBe(MemberStatus.Active);
        expect(activeMember.nextDueDate).toEqual(nextDueDate);
        expect(activeMember.id).toBe(expiredMember.id); // Same identity
      });


      it('should transition from Suspended to Active', () => {
        const suspendedMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Suspended,
        } as MemberProps);

        const activeMember = suspendedMember.activate(new Date('2024-03-01'));

        expect(activeMember.status).toBe(MemberStatus.Active);
      });

      it('should throw error when transitioning from Cancelled to Active', () => {
        const cancelledMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Cancelled,
        } as MemberProps);

        expect(() => {
          cancelledMember.activate(new Date('2024-03-01'));
        }).toThrow(InvalidStatusTransitionError);
      });

      it('should update nextDueDate when activating', () => {
        const expiredMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Expired,
          nextDueDate: new Date('2024-01-01'),
        } as MemberProps);

        const newDueDate = new Date('2024-03-01');
        const activeMember = expiredMember.activate(newDueDate);

        expect(activeMember.nextDueDate).toEqual(newDueDate);
      });
    });

    describe('expire()', () => {
      it('should transition from Active to Expired', () => {
        const activeMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Active,
        } as MemberProps);

        const expiredMember = activeMember.expire();

        expect(expiredMember.status).toBe(MemberStatus.Expired);
      });


      it('should transition from Suspended to Expired', () => {
        const suspendedMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Suspended,
        } as MemberProps);

        const expiredMember = suspendedMember.expire();

        expect(expiredMember.status).toBe(MemberStatus.Expired);
      });

      it('should throw error when transitioning from Cancelled to Expired', () => {
        const cancelledMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Cancelled,
        } as MemberProps);

        expect(() => {
          cancelledMember.expire();
        }).toThrow(InvalidStatusTransitionError);
      });
    });

    describe('cancel()', () => {
      it('should transition from Expired to Cancelled', () => {
        const expiredMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Expired,
        } as MemberProps);

        const cancelledMember = expiredMember.cancel();

        expect(cancelledMember.status).toBe(MemberStatus.Cancelled);
      });


      it('should transition from Suspended to Cancelled', () => {
        const suspendedMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Suspended,
        } as MemberProps);

        const cancelledMember = suspendedMember.cancel();

        expect(cancelledMember.status).toBe(MemberStatus.Cancelled);
      });

      it('should throw error when transitioning from Active to Cancelled', () => {
        const activeMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Active,
        } as MemberProps);

        expect(() => {
          activeMember.cancel();
        }).toThrow(InvalidStatusTransitionError);
      });
    });


    describe('suspend()', () => {
      it('should transition from Active to Suspended', () => {
        const activeMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Active,
        } as MemberProps);

        const suspendedMember = activeMember.suspend();

        expect(suspendedMember.status).toBe(MemberStatus.Suspended);
      });

      it('should throw error when transitioning from Expired to Suspended', () => {
        const expiredMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Expired,
        } as MemberProps);

        expect(() => {
          expiredMember.suspend();
        }).toThrow(InvalidStatusTransitionError);
      });
    });
  });

  describe('Business Logic Methods', () => {
    describe('isActive()', () => {
      it('should return true when status is Active', () => {
        const member = Member.create({ ...validMemberProps, status: MemberStatus.Active });
        expect(member.isActive()).toBe(true);
      });

      it('should return false when status is Expired', () => {
        const member = Member.create({ ...validMemberProps, status: MemberStatus.Expired });
        expect(member.isActive()).toBe(false);
      });

      it('should return false when status is Cancelled', () => {
        const member = Member.create({ ...validMemberProps, status: MemberStatus.Cancelled });
        expect(member.isActive()).toBe(false);
      });
    });

    describe('isOverdue()', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should return true when next due date is in the past', () => {
        jest.setSystemTime(new Date('2024-02-15'));

        const member = Member.create({
          ...validMemberProps,
          nextDueDate: new Date('2024-02-01'),
        });

        expect(member.isOverdue()).toBe(true);
      });

      it('should return false when next due date is today', () => {
        jest.setSystemTime(new Date('2024-02-01T12:00:00'));

        const member = Member.create({
          ...validMemberProps,
          nextDueDate: new Date('2024-02-01'),
        });

        expect(member.isOverdue()).toBe(false);
      });

      it('should return false when next due date is in the future', () => {
        jest.setSystemTime(new Date('2024-01-15'));

        const member = Member.create({
          ...validMemberProps,
          nextDueDate: new Date('2024-02-01'),
        });

        expect(member.isOverdue()).toBe(false);
      });
    });

    describe('canCheckIn()', () => {
      beforeEach(() => {
        // Set system time to before the due date
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-15'));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should return true when status is Active', () => {
        const member = Member.create({ ...validMemberProps, status: MemberStatus.Active });
        expect(member.canCheckIn()).toBe(true);
      });

      it('should return false when status is Expired', () => {
        const member = Member.create({ ...validMemberProps, status: MemberStatus.Expired });
        expect(member.canCheckIn()).toBe(false);
      });


      it('should return false when status is Suspended', () => {
        const member = Member.create({ ...validMemberProps, status: MemberStatus.Suspended });
        expect(member.canCheckIn()).toBe(false);
      });

      it('should return false when status is Cancelled', () => {
        const member = Member.create({ ...validMemberProps, status: MemberStatus.Cancelled });
        expect(member.canCheckIn()).toBe(false);
      });
    });

    describe('getDaysUntilDue()', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should return 0 when due today', () => {
        jest.setSystemTime(new Date('2024-02-01T12:00:00'));

        const member = Member.create({
          ...validMemberProps,
          nextDueDate: new Date('2024-02-01'),
        });

        expect(member.getDaysUntilDue()).toBe(0);
      });

      it('should return 7 for 7-day reminder', () => {
        jest.setSystemTime(new Date('2024-01-25'));

        const member = Member.create({
          ...validMemberProps,
          nextDueDate: new Date('2024-02-01'),
        });

        expect(member.getDaysUntilDue()).toBe(7);
      });

      it('should return -5 when 5 days overdue', () => {
        jest.setSystemTime(new Date('2024-02-06'));

        const member = Member.create({
          ...validMemberProps,
          nextDueDate: new Date('2024-02-01'),
        });

        expect(member.getDaysUntilDue()).toBe(-5);
      });
    });
  });

  describe('Update Methods', () => {
    describe('updateName()', () => {
      it('should update member name', () => {
        const member = Member.create(validMemberProps);
        const updated = member.updateName('Jane Smith');

        expect(updated.name).toBe('Jane Smith');
        expect(updated.id).toBe(member.id);
      });
    });

    describe('updatePhoneNumber()', () => {
      it('should update phone number', () => {
        const member = Member.create(validMemberProps);
        const updated = member.updatePhoneNumber('+94772222222');

        expect(updated.phoneNumber).toBe('+94772222222');
      });
    });

    describe('updatePlanType()', () => {
      it('should update plan type', () => {
        const member = Member.create(validMemberProps);
        const updated = member.updatePlanType(PlanType.Annual);

        expect(updated.planType).toBe(PlanType.Annual);
      });
    });

    describe('updatePlanAmount()', () => {
      it('should update plan amount', () => {
        const member = Member.create(validMemberProps);
        const updated = member.updatePlanAmount(7500);

        expect(updated.planAmount).toBe(7500);
      });
    });

    describe('updateRecurringDiscount()', () => {
      it('should update recurring discount flag', () => {
        const member = Member.create(validMemberProps);
        const updated = member.updateRecurringDiscount(true);

        expect(updated.recurringDiscount).toBe(true);
      });
    });

    describe('updateDiscountId()', () => {
      it('should update discount ID', () => {
        const member = Member.create(validMemberProps);
        const updated = member.updateDiscountId('discount_xyz');

        expect(updated.discountId).toBe('discount_xyz');
      });
    });
  });

  describe('Immutability', () => {
    it('should not mutate original member when activating', () => {
      const expiredMember = Member.fromDatabase({
        ...validMemberProps,
        id: 'member_123',
        status: MemberStatus.Expired,
      } as MemberProps);

      const originalStatus = expiredMember.status;
      const activeMember = expiredMember.activate(new Date('2024-03-01'));

      expect(expiredMember.status).toBe(originalStatus);
      expect(activeMember.status).toBe(MemberStatus.Active);
      expect(expiredMember).not.toBe(activeMember);
    });

    it('should not mutate original member when updating name', () => {
      const member = Member.create(validMemberProps);
      const originalName = member.name;

      const updated = member.updateName('New Name');

      expect(member.name).toBe(originalName);
      expect(updated.name).toBe('New Name');
      expect(member).not.toBe(updated);
    });

    it('should create new instance for each state transition', () => {
      const active = Member.create({ ...validMemberProps, status: MemberStatus.Active });
      const expired = active.expire();
      const reactivated = expired.activate(new Date('2024-03-01'));

      expect(active).not.toBe(expired);
      expect(expired).not.toBe(reactivated);
      expect(active).not.toBe(reactivated);
    });
  });

  describe('toDatabase()', () => {
    it('should convert member to database format', () => {
      const member = Member.create(validMemberProps);
      const dbProps = member.toDatabase();

      expect(dbProps.id).toBe(member.id);
      expect(dbProps.gymId).toBe(member.gymId);
      expect(dbProps.name).toBe(member.name);
      expect(dbProps.phoneNumber).toBe(member.phoneNumber);
      expect(dbProps.planType).toBe(member.planType);
      expect(dbProps.planAmount).toBe(member.planAmount);
      expect(dbProps.status).toBe(member.status);
      expect(dbProps.nextDueDate).toEqual(member.nextDueDate);
      expect(dbProps.createdAt).toEqual(member.createdAt);
      expect(dbProps.updatedAt).toEqual(member.updatedAt);
    });

    it('should preserve all properties during round-trip', () => {
      const member = Member.create(validMemberProps);
      const dbProps = member.toDatabase();
      const recreated = Member.fromDatabase(dbProps);

      expect(recreated.id).toBe(member.id);
      expect(recreated.name).toBe(member.name);
      expect(recreated.status).toBe(member.status);
      expect(recreated.nextDueDate).toEqual(member.nextDueDate);
    });
  });

  describe('Edge Cases', () => {
    it('should handle member with all optional fields null', () => {
      const member = Member.create({
        ...validMemberProps,
        discountId: null,
      });

      expect(member.discountId).toBeNull();
      expect(member.recurringDiscount).toBe(false);
    });

    it('should handle very long names', () => {
      const longName = 'A'.repeat(500);
      const member = Member.create({
        ...validMemberProps,
        name: longName,
      });

      expect(member.name).toBe(longName);
      expect(member.name.length).toBe(500);
    });

    it('should handle international phone numbers', () => {
      const member = Member.create({
        ...validMemberProps,
        phoneNumber: '+94771234567',
      });

      expect(member.phoneNumber).toBe('+94771234567');
    });

    it('should handle different plan types', () => {
      const planTypes = Object.values(PlanType);

      planTypes.forEach((planType) => {
        const member = Member.create({
          ...validMemberProps,
          planType,
        });

        expect(member.planType).toBe(planType);
      });
    });
  });

  describe('Real-World Scenarios', () => {
    it('Scenario: New member registration → expiry → payment → renewal', () => {
      // 1. Register new member
      const newMember = Member.create({
        ...validMemberProps,
        status: MemberStatus.Active,
        nextDueDate: new Date('2024-02-01'),
      });

      expect(newMember.status).toBe(MemberStatus.Active);

      // 2. Member misses payment, status changes to expired
      const expiredMember = newMember.expire();
      expect(expiredMember.status).toBe(MemberStatus.Expired);

      // 3. Member pays to reactivate
      const renewed = expiredMember.activate(new Date('2024-03-01'));

      expect(renewed.status).toBe(MemberStatus.Active);
      expect(renewed.nextDueDate).toEqual(new Date('2024-03-01'));
    });

    it('Scenario: Member misses payment → expires → pays → reactivates', () => {
      // 1. Active member
      const active = Member.create({
        ...validMemberProps,
        status: MemberStatus.Active,
      });

      // 2. Due date passes, system expires member
      const expired = active.expire();
      expect(expired.status).toBe(MemberStatus.Expired);

      // 3. Member pays, reactivated
      const reactivated = expired.activate(new Date('2024-03-01'));
      expect(reactivated.status).toBe(MemberStatus.Active);
    });

    it('Scenario: Member 45+ days overdue → cancelled (terminal)', () => {
      // 1. Expired member
      const expired = Member.create({
        ...validMemberProps,
        status: MemberStatus.Expired,
      });

      // 2. 45 days pass, system cancels member
      const cancelled = expired.cancel();
      expect(cancelled.status).toBe(MemberStatus.Cancelled);

      // 3. Cannot reactivate cancelled member
      expect(() => {
        cancelled.activate(new Date('2024-03-01'));
      }).toThrow(InvalidStatusTransitionError);
    });

  });

  // ========================================================================
  // GAP 1 & GAP 3: Comprehensive Test Coverage for renew() Method
  // ========================================================================
  describe('renew()', () => {
    describe('Happy Path', () => {
      it('should extend due date for active member', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-15T10:00:00'));

        const activeMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Active,
          nextDueDate: new Date('2024-02-01'),
        } as MemberProps);

        const newDueDate = new Date('2024-03-15');
        const renewed = activeMember.renew(newDueDate);

        expect(renewed.status).toBe(MemberStatus.Active); // Status unchanged
        expect(renewed.nextDueDate).toEqual(newDueDate);
        expect(renewed.id).toBe(activeMember.id); // Same identity
        expect(renewed).not.toBe(activeMember); // New instance

        jest.useRealTimers();
      });
    });

    describe('Status Validation', () => {
      it('should throw error when renewing expired member', () => {
        const expiredMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Expired,
        } as MemberProps);

        expect(() => {
          expiredMember.renew(new Date('2024-03-01'));
        }).toThrow(InvalidStatusTransitionError);
      });

      it('should throw error when renewing suspended member', () => {
        const suspendedMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Suspended,
        } as MemberProps);

        expect(() => {
          suspendedMember.renew(new Date('2024-03-01'));
        }).toThrow(InvalidStatusTransitionError);
      });

      it('should throw error when renewing cancelled member', () => {
        const cancelledMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Cancelled,
        } as MemberProps);

        expect(() => {
          cancelledMember.renew(new Date('2024-03-01'));
        }).toThrow(InvalidStatusTransitionError);
      });
    });

    describe('Immutability', () => {
      it('should not mutate original member when renewing', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-15T10:00:00'));

        const activeMember = Member.fromDatabase({
          ...validMemberProps,
          id: 'member_123',
          status: MemberStatus.Active,
          nextDueDate: new Date('2024-02-01'),
        } as MemberProps);

        const originalDate = activeMember.nextDueDate;
        const originalStatus = activeMember.status;
        const renewed = activeMember.renew(new Date('2024-03-15'));

        // Verify original unchanged
        expect(activeMember.nextDueDate).toEqual(originalDate);
        expect(activeMember.status).toBe(originalStatus);

        // Verify new instance has changes
        expect(renewed.nextDueDate).toEqual(new Date('2024-03-15'));
        expect(renewed.status).toBe(MemberStatus.Active);

        // Verify different instances
        expect(activeMember).not.toBe(renewed);

        jest.useRealTimers();
      });
    });

    describe('Date Validation', () => {
      it('should throw ValidationError when newDueDate is invalid Date', () => {
        const activeMember = Member.create({
          ...validMemberProps,
          status: MemberStatus.Active,
        });

        expect(() => {
          activeMember.renew(new Date('invalid'));
        }).toThrow(ValidationError);

        expect(() => {
          activeMember.renew(new Date('invalid'));
        }).toThrow('newDueDate must be a valid Date object');
      });

      it('should throw ValidationError when newDueDate is in the past', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-02-15T12:00:00'));

        const activeMember = Member.create({
          ...validMemberProps,
          status: MemberStatus.Active,
          nextDueDate: new Date('2024-02-20'),
        });

        // Try to renew with past date (Feb 10)
        expect(() => {
          activeMember.renew(new Date('2024-02-10'));
        }).toThrow(ValidationError);

        expect(() => {
          activeMember.renew(new Date('2024-02-10'));
        }).toThrow('newDueDate must be in the future');

        jest.useRealTimers();
      });

      it('should throw ValidationError when newDueDate is before current due date', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-15T10:00:00'));

        const activeMember = Member.create({
          ...validMemberProps,
          status: MemberStatus.Active,
          nextDueDate: new Date('2024-03-01'),
        });

        // Try to renew with date before current due date (Feb 15)
        expect(() => {
          activeMember.renew(new Date('2024-02-15'));
        }).toThrow(ValidationError);

        expect(() => {
          activeMember.renew(new Date('2024-02-15'));
        }).toThrow('newDueDate must be after current due date');

        jest.useRealTimers();
      });

      it('should accept today as valid renewal date', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-02-15T12:00:00'));

        const activeMember = Member.create({
          ...validMemberProps,
          status: MemberStatus.Active,
          nextDueDate: new Date('2024-02-10'), // Past due
        });

        // Renew with today's date (should work - not "in the past")
        const renewed = activeMember.renew(new Date('2024-02-15'));

        expect(renewed.nextDueDate).toEqual(new Date('2024-02-15'));
        expect(renewed.status).toBe(MemberStatus.Active);

        jest.useRealTimers();
      });

      it('should allow renewing with same date as current due date', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-02-15T10:00:00'));

        const currentDueDate = new Date('2024-03-01');
        const activeMember = Member.create({
          ...validMemberProps,
          status: MemberStatus.Active,
          nextDueDate: currentDueDate,
        });

        // This might be a no-op, but shouldn't throw
        const renewed = activeMember.renew(new Date('2024-03-01'));

        expect(renewed.nextDueDate).toEqual(currentDueDate);

        jest.useRealTimers();
      });
    });

    describe('Real-World Scenarios', () => {
      it('Scenario: Active member pays early before due date', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-15T10:00:00'));

        // Member's current due date is Jan 31
        const activeMember = Member.create({
          ...validMemberProps,
          status: MemberStatus.Active,
          nextDueDate: new Date('2024-01-31'),
        });

        expect(activeMember.status).toBe(MemberStatus.Active);
        expect(activeMember.nextDueDate).toEqual(new Date('2024-01-31'));

        // Member pays early on Jan 15, extends to Feb 15
        const renewed = activeMember.renew(new Date('2024-02-15'));

        expect(renewed.status).toBe(MemberStatus.Active);
        expect(renewed.nextDueDate).toEqual(new Date('2024-02-15'));
        expect(renewed.id).toBe(activeMember.id); // Same member

        jest.useRealTimers();
      });

      it('Scenario: Active member pays on due date', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-31T14:30:00'));

        const activeMember = Member.create({
          ...validMemberProps,
          status: MemberStatus.Active,
          nextDueDate: new Date('2024-01-31'),
        });

        // Pay on due date, extend by 30 days
        const renewed = activeMember.renew(new Date('2024-02-29'));

        expect(renewed.status).toBe(MemberStatus.Active);
        expect(renewed.nextDueDate).toEqual(new Date('2024-02-29'));

        jest.useRealTimers();
      });

      it('Scenario: Active overdue member pays before cron expires them', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-02-05T09:00:00'));

        // Member is 5 days overdue but cron hasn't run yet (still Active)
        const overdueActiveMember = Member.create({
          ...validMemberProps,
          status: MemberStatus.Active,
          nextDueDate: new Date('2024-01-31'), // 5 days ago
        });

        // Member pays, extends from today forward
        const renewed = overdueActiveMember.renew(new Date('2024-03-05'));

        expect(renewed.status).toBe(MemberStatus.Active);
        expect(renewed.nextDueDate).toEqual(new Date('2024-03-05'));

        jest.useRealTimers();
      });
    });
  });
});
