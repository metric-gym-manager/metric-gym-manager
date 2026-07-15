'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getMemberPhotoUrl } from '@/lib/utils/member-photo';

interface MemberAvatarProps {
  name: string;
  photoPath?: string | null;
  photoUpdatedAt?: string | null;
  /** Tailwind size classes; defaults to a 32px table avatar */
  className?: string;
}

/**
 * Member face photo with initials fallback.
 *
 * Every pre-QR member has no photo, and a QR member's photo may still be
 * uploading (or the upload may have failed), so the initials fallback is a
 * first-class state — including when the R2 object 404s (onError).
 */
export default function MemberAvatar({
  name,
  photoPath,
  photoUpdatedAt,
  className,
}: MemberAvatarProps) {
  // Track failure per URL so a replaced photo (new ?v=) gets a fresh load
  // attempt without needing an effect
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = getMemberPhotoUrl(photoPath, photoUpdatedAt);
  const failed = failedUrl !== null && failedUrl === url;

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  if (!url || failed) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700',
          className
        )}
      >
        {initials || '?'}
      </span>
    );
  }

  // Plain <img>: avatars are tiny, already CDN-cached on R2, and next/image
  // optimization would proxy every request through Vercel for no visual gain.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`${name} photo`}
      loading="lazy"
      onError={() => setFailedUrl(url)}
      className={cn(
        'h-8 w-8 shrink-0 rounded-full object-cover bg-gray-100',
        className
      )}
    />
  );
}
