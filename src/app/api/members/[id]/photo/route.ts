import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { ValidationError } from '@/utils/errors';
import { isPhotoPathForMember } from '@/utils/member-photo';

// ============================================================
// POST   /api/members/[id]/photo - Confirm uploaded photo
// DELETE /api/members/[id]/photo - Remove photo
// ============================================================

const confirmPhotoSchema = z.object({
  path: z.string().min(1).max(200),
});

/**
 * Confirm a member photo after the client's direct PUT to R2 succeeded.
 *
 * The client first calls /api/members/generate-upload-url, PUTs the file to
 * the presigned URL, then calls this endpoint to persist the object path on
 * the member record. The path is validated against the member id so a caller
 * can never point a member at another member's photo, and the object's
 * existence is verified in R2 before the reference is saved.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    const { path } = confirmPhotoSchema.parse(body);

    if (!isPhotoPathForMember(path, id)) {
      throw new ValidationError('Photo path does not match this member');
    }

    const container = await getContainer();
    const memberRepo = container.getMemberRepository();
    const storage = container.getStorageProvider();

    const member = await memberRepo.findById(id, gymProfile.id);
    if (!member) {
      return NextResponse.json(ResponseBuilder.notFound('Member'), {
        status: 404,
      });
    }

    // The upload must have actually landed in R2
    const uploaded = await storage.exists(path);
    if (!uploaded) {
      throw new ValidationError('Photo has not been uploaded yet');
    }

    const previousPath = member.photoPath;
    const updated = await memberRepo.update(member.updatePhoto(path));

    // A format switch (webp <-> jpg) leaves the old object orphaned — clean it up
    if (previousPath && previousPath !== path) {
      await storage.delete(previousPath);
    }

    return NextResponse.json(
      ResponseBuilder.success(
        {
          photoPath: updated.photoPath,
          photoUpdatedAt: updated.photoUpdatedAt?.toISOString() ?? null,
        },
        { message: 'Photo saved successfully' }
      )
    );
  } catch (error) {
    console.error('Confirm member photo API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: [error.message] }),
        { status: 400 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: ['Invalid input data'] }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to save photo', 'PHOTO_SAVE_ERROR'),
      { status: 500 }
    );
  }
}

/**
 * Remove a member's photo: deletes the R2 object and clears the reference.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gymProfile = await getCurrentGymProfile();

    const container = await getContainer();
    const memberRepo = container.getMemberRepository();

    const member = await memberRepo.findById(id, gymProfile.id);
    if (!member) {
      return NextResponse.json(ResponseBuilder.notFound('Member'), {
        status: 404,
      });
    }

    const photoPath = member.photoPath;
    if (photoPath) {
      await memberRepo.update(member.removePhoto());
      // Best-effort object cleanup after the reference is gone
      await container.getStorageProvider().delete(photoPath);
    }

    return NextResponse.json(
      ResponseBuilder.success(null, { message: 'Photo removed successfully' })
    );
  } catch (error) {
    console.error('Remove member photo API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 });
    }

    return NextResponse.json(
      ResponseBuilder.error('Failed to remove photo', 'PHOTO_DELETE_ERROR'),
      { status: 500 }
    );
  }
}
