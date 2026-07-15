/**
 * Member entity tests: photo fields and QR verification state.
 *
 * These fields are optional on MemberProps (backward compatibility with
 * pre-photo records) and must normalize to safe defaults.
 */

import { Member, MemberStatus, RegistrationSource } from '../Member';
import { PlanType } from '@/core/utils/constants/PlanConfig';
import { ValidationError } from '@/core/utils/errors';

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

describe('Member photo and verification', () => {
  describe('defaults', () => {
    it('normalizes omitted fields to no-photo, manual, unverified-irrelevant', () => {
      const member = buildMember();

      expect(member.photoPath).toBeNull();
      expect(member.photoUpdatedAt).toBeNull();
      expect(member.hasPhoto()).toBe(false);
      expect(member.registrationSource).toBe(RegistrationSource.Manual);
      expect(member.verifiedAt).toBeNull();
      expect(member.needsVerification()).toBe(false);
    });
  });

  describe('updatePhoto', () => {
    it('sets the photo path and a version timestamp', () => {
      const member = buildMember();

      const updated = member.updatePhoto(`profiles/${member.id}.webp`);

      expect(updated.photoPath).toBe(`profiles/${member.id}.webp`);
      expect(updated.photoUpdatedAt).toBeInstanceOf(Date);
      expect(updated.hasPhoto()).toBe(true);
      // Immutability: the original instance is unchanged
      expect(member.photoPath).toBeNull();
    });

    it('rejects an empty path', () => {
      expect(() => buildMember().updatePhoto('  ')).toThrow(ValidationError);
    });
  });

  describe('removePhoto', () => {
    it('clears the photo path and version', () => {
      const member = buildMember().updatePhoto('profiles/x.webp');

      const removed = member.removePhoto();

      expect(removed.photoPath).toBeNull();
      expect(removed.photoUpdatedAt).toBeNull();
      expect(removed.hasPhoto()).toBe(false);
    });
  });

  describe('needsVerification / verify', () => {
    it('flags unverified QR registrations', () => {
      const member = buildMember({ registrationSource: RegistrationSource.Qr });

      expect(member.needsVerification()).toBe(true);
    });

    it('verify() sets verifiedAt on a QR registration', () => {
      const member = buildMember({ registrationSource: RegistrationSource.Qr });

      const verified = member.verify();

      expect(verified.verifiedAt).toBeInstanceOf(Date);
      expect(verified.needsVerification()).toBe(false);
    });

    it('verify() is idempotent for already-verified members', () => {
      const verified = buildMember({
        registrationSource: RegistrationSource.Qr,
      }).verify();

      expect(verified.verify()).toBe(verified);
    });

    it('verify() is a no-op for manual registrations', () => {
      const member = buildMember();

      expect(member.verify()).toBe(member);
      expect(member.verify().verifiedAt).toBeNull();
    });

    it('photo and verification state survive state transitions', () => {
      const member = buildMember({
        registrationSource: RegistrationSource.Qr,
      }).updatePhoto('profiles/x.webp');

      const expired = member.expire();

      expect(expired.photoPath).toBe('profiles/x.webp');
      expect(expired.registrationSource).toBe(RegistrationSource.Qr);
      expect(expired.needsVerification()).toBe(true);
    });
  });
});
