import { NextRequest, NextResponse } from 'next/server';
import { getApiGymProfile } from '@/lib/middleware/api-auth';
import { updateMemberSchema } from '@/features/members/schemas/member.schemas';
import {
  getMemberById,
  updateMember,
  deleteMember,
} from '@/features/members/services/member.service';

// ============================================================
// GET /api/members/[id] - Get member by ID
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { gymProfile, error: authError } = await getApiGymProfile();

    if (authError) {
      return authError;
    }

    const result = await getMemberById(id, gymProfile!.id);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get member API error:', error);

    if (error instanceof Error && error.message === 'Member not found') {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch member' },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH /api/members/[id] - Update member
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { gymProfile, error: authError } = await getApiGymProfile();

    if (authError) {
      return authError;
    }

    const body = await request.json();

    // Validate input
    const validatedData = updateMemberSchema.parse(body);

    // Update member
    const member = await updateMember(id, gymProfile!.id, validatedData);

    return NextResponse.json(
      {
        success: true,
        data: member,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update member API error:', error);

    if (error instanceof Error && error.message === 'Member not found') {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /api/members/[id] - Delete member
// ============================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { gymProfile, error: authError } = await getApiGymProfile();

    if (authError) {
      return authError;
    }

    await deleteMember(id, gymProfile!.id);

    return NextResponse.json(
      {
        success: true,
        message: 'Member deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete member API error:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to delete member' },
      { status: 500 }
    );
  }
}
