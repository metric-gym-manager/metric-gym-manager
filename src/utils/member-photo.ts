/**
 * Member photo path and URL helpers
 *
 * Pure string utilities shared by server routes and client components.
 * The database stores only the R2 object key (e.g. 'profiles/{id}.webp');
 * public URLs are composed from NEXT_PUBLIC_R2_PUBLIC_URL at render time.
 */

/**
 * Image content types accepted for member photos.
 *
 * WebP is preferred (smaller files); JPEG is the fallback for browsers that
 * cannot encode WebP from a canvas (iOS Safari).
 */
export const MEMBER_PHOTO_CONTENT_TYPES = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
} as const;

export type MemberPhotoContentType = keyof typeof MEMBER_PHOTO_CONTENT_TYPES;

/**
 * Maximum member photo upload size in bytes (2MB).
 * Client-side compression targets ~100-200KB, so this is a generous cap.
 */
export const MEMBER_PHOTO_MAX_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Check whether a content type is accepted for member photos
 */
export function isMemberPhotoContentType(
  contentType: string
): contentType is MemberPhotoContentType {
  return contentType in MEMBER_PHOTO_CONTENT_TYPES;
}

/**
 * Build the deterministic R2 object key for a member's photo.
 *
 * @param memberId - Member UUID
 * @param contentType - Image content type (determines the extension)
 * @returns Object key, e.g. 'profiles/9b2e.../photo.webp' → 'profiles/9b2e....webp'
 */
export function memberPhotoPath(
  memberId: string,
  contentType: MemberPhotoContentType
): string {
  return `profiles/${memberId}.${MEMBER_PHOTO_CONTENT_TYPES[contentType]}`;
}

/**
 * Check whether a path is a valid photo path for the given member.
 * Guards the photo-confirmation endpoint against arbitrary path injection.
 */
export function isPhotoPathForMember(path: string, memberId: string): boolean {
  return Object.values(MEMBER_PHOTO_CONTENT_TYPES).some(
    (ext) => path === `profiles/${memberId}.${ext}`
  );
}

/**
 * Compose the public URL for a member photo.
 *
 * Appends photo_updated_at as a ?v= cache-buster because photo replacements
 * overwrite the same object key and would otherwise serve stale CDN copies.
 *
 * @param photoPath - R2 object key from the member record (may be null)
 * @param photoUpdatedAt - ISO timestamp of the last upload (may be null)
 * @returns Full public URL, or null when there is no photo or no public base URL configured
 */
export function getMemberPhotoUrl(
  photoPath: string | null | undefined,
  photoUpdatedAt?: string | null
): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim();
  if (!photoPath || !baseUrl) {
    return null;
  }

  const url = `${baseUrl.replace(/\/$/, '')}/${photoPath}`;
  if (!photoUpdatedAt) {
    return url;
  }

  return `${url}?v=${encodeURIComponent(new Date(photoUpdatedAt).getTime().toString())}`;
}
