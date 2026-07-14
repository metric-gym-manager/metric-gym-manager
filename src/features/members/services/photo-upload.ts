/**
 * Member photo upload service (client-side)
 *
 * Presigned URL pipeline:
 * 1. Compress the image in the browser (WebP, JPEG fallback for iOS Safari)
 * 2. Ask the backend for a 5-minute presigned PUT URL
 * 3. PUT the file directly to Cloudflare R2 (no image bytes touch our servers)
 * 4. Confirm the upload so the object path is saved on the member record
 */

import { compressImageForUpload } from '@/lib/utils/image';
import type { MemberPhotoContentType } from '@/lib/utils/member-photo';

export interface MemberPhotoUploadResult {
  photoPath: string;
  photoUpdatedAt: string | null;
}

/**
 * PUT a blob to a presigned R2 upload URL.
 *
 * The Content-Type header must match the one the URL was signed with,
 * otherwise R2 rejects the request.
 */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  blob: Blob,
  contentType: MemberPhotoContentType
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Photo upload failed (${response.status})`);
  }
}

/**
 * Full upload pipeline for an existing member (dashboard flow):
 * compress → presign → PUT to R2 → confirm.
 *
 * @param memberId - Member UUID
 * @param file - Original image from camera or file picker
 * @returns Saved photo path and version timestamp
 */
export async function uploadMemberPhoto(
  memberId: string,
  file: Blob
): Promise<MemberPhotoUploadResult> {
  const { blob, contentType } = await compressImageForUpload(file);

  // 1. Fetch the presigned PUT URL from the backend
  const presignResponse = await fetch('/api/members/generate-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId, contentType }),
  });

  const presignResult = await presignResponse.json();
  if (!presignResponse.ok || !presignResult.success) {
    throw new Error(
      presignResult?.error?.message || 'Could not prepare the photo upload'
    );
  }

  const { uploadUrl, path } = presignResult.data as {
    uploadUrl: string;
    path: string;
  };

  // 2. Upload directly to R2
  await uploadToPresignedUrl(uploadUrl, blob, contentType);

  // 3. Persist the object path on the member record
  const confirmResponse = await fetch(`/api/members/${memberId}/photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });

  const confirmResult = await confirmResponse.json();
  if (!confirmResponse.ok || !confirmResult.success) {
    throw new Error(
      confirmResult?.error?.message || 'Could not save the uploaded photo'
    );
  }

  return confirmResult.data as MemberPhotoUploadResult;
}

/**
 * Remove a member's photo.
 */
export async function removeMemberPhoto(memberId: string): Promise<void> {
  const response = await fetch(`/api/members/${memberId}/photo`, {
    method: 'DELETE',
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result?.error?.message || 'Could not remove the photo');
  }
}
