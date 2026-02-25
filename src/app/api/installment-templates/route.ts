import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  installment_count: z.number().int().min(2).max(24),
  interval_months: z.number().int().min(1).max(12),
});

// GET /api/installment-templates
export async function GET() {
  try {
    const gymProfile = await getCurrentGymProfile();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('installment_templates')
      .select('*')
      .eq('gym_id', gymProfile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(
      { success: true, data: data ?? [] },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch installment templates' }, { status: 500 });
  }
}

// POST /api/installment-templates
export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();
    const validated = createTemplateSchema.parse(body);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('installment_templates')
      .insert({ ...validated, gym_id: gymProfile.id })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create installment template' }, { status: 500 });
  }
}
