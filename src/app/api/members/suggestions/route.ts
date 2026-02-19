import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createClient } from '@/lib/supabase/server';

// GET /api/members/suggestions?q=search_term
export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    const q = request.nextUrl.searchParams.get('q') || '';
    if (!q || q.trim().length < 1) {
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('members')
      .select('id, name, phone_number')
      .eq('gym_id', gymProfile.id)
      .or(`name.ilike.%${q}%,phone_number.ilike.%${q}%`)
      .limit(8);

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
