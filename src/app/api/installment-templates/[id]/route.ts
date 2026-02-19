import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  installment_count: z.number().int().min(2).max(24).optional(),
  interval_months: z.number().int().min(1).max(12).optional(),
  is_active: z.boolean().optional(),
});

// PATCH /api/installment-templates/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const { id } = await params;
    const body = await request.json();
    const validated = updateTemplateSchema.parse(body);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('installment_templates')
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('gym_id', gymProfile.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update installment template' }, { status: 500 });
  }
}

// DELETE /api/installment-templates/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('installment_templates')
      .delete()
      .eq('id', id)
      .eq('gym_id', gymProfile.id);

    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to delete installment template' }, { status: 500 });
  }
}
