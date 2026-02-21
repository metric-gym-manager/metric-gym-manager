import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: gyms, error } = await supabase
      .from('gyms')
      .select('id, gym_name');

    return NextResponse.json({
      success: true,
      gymsCount: gyms?.length || 0,
      gyms: gyms || [],
      error: error?.message || null,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
