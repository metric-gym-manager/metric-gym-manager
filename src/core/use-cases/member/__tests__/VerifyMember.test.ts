/**
 * Verify Member Use Case Tests
 *
 * Verification clears the NEW badge on QR self-registrations. It must be
 * idempotent and a no-op for manual registrations.
 */

import { VerifyMember } from '../VerifyMember';
import { Member, MemberStatus, RegistrationSource } from '@/core/domain/member/Member';
import { PlanType } from '@/core/utils/constants/PlanConfig';
import { NotFoundError } from '@/utils/errors';

function buildMember(overrides: Partial<Parameters<typeof Member.create>[0]> = {}): Member {
  return Member.create({
    gymId: 'gym-1',
    name: 'Test Member',
    phoneNumber: '+94775093333',
    planType: PlanType.Monthly,
    planAmount: 3500,
    discountId: null,
    recurringDiscount: false,
    status: MemberStatus.Active,
    registeredDate: new Date('2026-07-01'),
    membershipStartDate: new Date('2026-07-01'),
    nextDueDate: new Date('2026-08-01'),
    ...overrides,
  });
}

describe('VerifyMember', () => {
  let memberRepo: { findById: jest.Mock; update: jest.Mock };

  const input = { memberId: 'member-1', gymId: 'gym-1' };

  beforeEach(() => {
    memberRepo = {
      findById: jest.fn(),
      update: jest.fn().mockImplementation((m: Member) => Promise.resolve(m)),
    };
  });

  it('verifies an unverified QR self-registration', async () => {
    memberRepo.findById.mockResolvedValue(
      buildMember({ registrationSource: RegistrationSource.Qr })
    );

    const result = await new VerifyMember(memberRepo as never).execute(input);

    expect(memberRepo.update).toHaveBeenCalledTimes(1);
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(result.needsVerification()).toBe(false);
  });

  it('is a no-op for an already-verified QR member', async () => {
    memberRepo.findById.mockResolvedValue(
      buildMember({
        registrationSource: RegistrationSource.Qr,
        verifiedAt: new Date('2026-07-02'),
      })
    );

    const result = await new VerifyMember(memberRepo as never).execute(input);

    expect(memberRepo.update).not.toHaveBeenCalled();
    expect(result.needsVerification()).toBe(false);
  });

  it('is a no-op for a manually registered member', async () => {
    memberRepo.findById.mockResolvedValue(buildMember());

    const result = await new VerifyMember(memberRepo as never).execute(input);

    expect(memberRepo.update).not.toHaveBeenCalled();
    expect(result.registrationSource).toBe(RegistrationSource.Manual);
  });

  it('throws NotFoundError when the member does not exist in this gym', async () => {
    memberRepo.findById.mockResolvedValue(null);

    await expect(
      new VerifyMember(memberRepo as never).execute(input)
    ).rejects.toThrow(NotFoundError);
  });
});
