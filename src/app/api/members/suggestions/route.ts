import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { searchMemberSuggestions } from '@/features/members/services/member-queries.service';

// GET /api/members/suggestions?q=search_term
export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    const q = request.nextUrl.searchParams.get('q') || '';
    if (!q || q.trim().length < 1) {
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }

    const data = await searchMemberSuggestions(gymProfile.id, q);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
