/**
 * Member photo path/URL helper tests
 */

import {
  memberPhotoPath,
  isPhotoPathForMember,
  isMemberPhotoContentType,
  getMemberPhotoUrl,
} from '../member-photo';

const MEMBER_ID = '9b2e4a6c-1234-4abc-9def-000000000001';

describe('member-photo helpers', () => {
  describe('memberPhotoPath', () => {
    it('builds the webp path per spec', () => {
      expect(memberPhotoPath(MEMBER_ID, 'image/webp')).toBe(
        `profiles/${MEMBER_ID}.webp`
      );
    });

    it('builds the jpg fallback path', () => {
      expect(memberPhotoPath(MEMBER_ID, 'image/jpeg')).toBe(
        `profiles/${MEMBER_ID}.jpg`
      );
    });
  });

  describe('isMemberPhotoContentType', () => {
    it('accepts webp and jpeg only', () => {
      expect(isMemberPhotoContentType('image/webp')).toBe(true);
      expect(isMemberPhotoContentType('image/jpeg')).toBe(true);
      expect(isMemberPhotoContentType('image/png')).toBe(false);
      expect(isMemberPhotoContentType('application/pdf')).toBe(false);
    });
  });

  describe('isPhotoPathForMember', () => {
    it('accepts the member own paths', () => {
      expect(isPhotoPathForMember(`profiles/${MEMBER_ID}.webp`, MEMBER_ID)).toBe(true);
      expect(isPhotoPathForMember(`profiles/${MEMBER_ID}.jpg`, MEMBER_ID)).toBe(true);
    });

    it('rejects other members paths and arbitrary keys', () => {
      expect(isPhotoPathForMember('profiles/other-member.webp', MEMBER_ID)).toBe(false);
      expect(isPhotoPathForMember(`profiles/${MEMBER_ID}.png`, MEMBER_ID)).toBe(false);
      expect(isPhotoPathForMember(`../secrets/${MEMBER_ID}.webp`, MEMBER_ID)).toBe(false);
    });
  });

  describe('getMemberPhotoUrl', () => {
    const originalEnv = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

    afterEach(() => {
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL = originalEnv;
    });

    it('composes base URL + path with a cache-busting version', () => {
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'https://media.example.com/';

      const url = getMemberPhotoUrl(
        `profiles/${MEMBER_ID}.webp`,
        '2026-07-14T10:00:00.000Z'
      );

      expect(url).toBe(
        `https://media.example.com/profiles/${MEMBER_ID}.webp?v=${new Date(
          '2026-07-14T10:00:00.000Z'
        ).getTime()}`
      );
    });

    it('returns null without a photo or without a configured base URL', () => {
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'https://media.example.com';
      expect(getMemberPhotoUrl(null)).toBeNull();

      delete process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
      expect(getMemberPhotoUrl(`profiles/${MEMBER_ID}.webp`)).toBeNull();
    });
  });
});
