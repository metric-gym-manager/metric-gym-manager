import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createClient } from '@/lib/supabase/server';
import { createMemberRepository } from '@/features/members';
import { createStorageProvider } from '@/lib/storage/factory';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import {
  MEMBER_PHOTO_CONTENT_TYPES,
  memberPhotoPath,
  type MemberPhotoContentType,
} from '@/utils/member-photo';

// ============================================================
// POST /api/members/generate-upload-url
// Generate a 5-minute presigned PUT URL for a member photo
// ============================================================

/** Presigned URL validity window: 5 minutes */
const UPLOAD_URL_EXPIRY_SECONDS = 300;

const generateUploadUrlSchema = z.object({
  memberId: z.string().uuid(),
  // WebP preferred; JPEG fallback for browsers that can't encode WebP (iOS Safari)
  contentType: z
    .enum(Object.keys(MEMBER_PHOTO_CONTENT_TYPES) as [string, ...string[]])
    .default('image/webp'),
});

/**
 * Returns a temporary presigned PUT URL for uploading a member's face photo
 * directly to Cloudflare R2 at 'profiles/{memberId}.webp' (or .jpg).
 *
 * Authorization: gym session required; the member must belong to the
 * caller's gym — otherwise anyone could overwrite any member's photo since
 * object paths are deterministic.
 */
export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    const { memberId, contentType } = generateUploadUrlSchema.parse(body);

    // Tenant check: the member must exist in the caller's gym
    const supabase = await createClient();
    const member = await createMemberRepository(supabase).findById(
      memberId,
      gymProfile.id
    );

    if (!member) {
      return NextResponse.json(ResponseBuilder.notFound('Member'), {
        status: 404,
      });
    }

    const path = memberPhotoPath(memberId, contentType as MemberPhotoContentType);

    // ---- [R2-DEBUG] temporary diagnostics — remove once uploads work ----
    const storage = createStorageProvider();
    console.log('[R2-DEBUG] provider:', storage.constructor.name, 'env:', {
      accountId: !!process.env.R2_ACCOUNT_ID,
      accessKeyId: !!process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: !!process.env.R2_SECRET_ACCESS_KEY,
      bucket: process.env.R2_BUCKET_NAME ?? null,
      publicUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? null,
    });
    // Server-side PUT bypasses the browser + CORS entirely, so its result
    // isolates a credentials/bucket problem from a CORS problem.
    try {
      const testResult = await storage.upload(
        new Blob(['r2 connectivity test'], { type: 'text/plain' }),
        'debug/connectivity-test.txt',
        { contentType: 'text/plain' }
      );
      console.log('[R2-DEBUG] server-side PUT:', JSON.stringify(testResult));
    } catch (dbgErr) {
      console.log(
        '[R2-DEBUG] server-side PUT threw:',
        dbgErr instanceof Error ? `${dbgErr.name}: ${dbgErr.message}` : String(dbgErr)
      );
    }
    // ---- end [R2-DEBUG] ----

    const presign = await storage.getPresignedUploadUrl(path, {
      contentType,
      expiresInSeconds: UPLOAD_URL_EXPIRY_SECONDS,
    });

    // [R2-DEBUG] confirm the generated URL host + params (no signature value)
    try {
      const dbgUrl = new URL(presign.uploadUrl);
      console.log(
        '[R2-DEBUG] presign host:',
        dbgUrl.host,
        'params:',
        [...dbgUrl.searchParams.keys()].join(',')
      );
    } catch {
      console.log('[R2-DEBUG] presign url unparseable:', presign.uploadUrl);
    }

    return NextResponse.json(
      ResponseBuilder.success({
        uploadUrl: presign.uploadUrl,
        path: presign.path,
        expiresInSeconds: presign.expiresInSeconds,
      })
    );
  } catch (error) {
    console.error('Generate upload URL API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: ['Invalid input data'] }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to generate upload URL', 'UPLOAD_URL_ERROR'),
      { status: 500 }
    );
  }
}
