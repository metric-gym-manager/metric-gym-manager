import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================
// GET /api/admin/system-health/sms-failures
// Fetch latest 50 failed SMS records with full error details
// Query Parameters:
//   - gymId (optional): UUID - Filter failures by specific gym
// ============================================================

/**
 * Authorization: Requires ADMIN_API_SECRET header
 * This endpoint is for SaaS admin monitoring only
 *
 * IMPORTANT: This endpoint exposes error_message field which contains
 * technical infrastructure details (stack traces, API errors, etc.).
 * This is STRICTLY for admin use and must NEVER be exposed to gym managers.
 *
 * @param request - NextRequest with optional query parameter: gymId
 * @returns Failed SMS records with full error traces
 *
 * @example
 * // All gyms
 * GET /api/admin/system-health/sms-failures
 *
 * // Specific gym
 * GET /api/admin/system-health/sms-failures?gymId=123e4567-e89b-12d3-a456-426614174000
 */
export async function GET(request: NextRequest) {
  try {
    // CRITICAL: Strict authorization check BEFORE any database queries
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_API_SECRET;

    if (!adminSecret) {
      console.error('ADMIN_API_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Admin API not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${adminSecret}`) {
      console.warn('Unauthorized admin API access attempt');
      return NextResponse.json(
        { success: false, error: 'Forbidden - Invalid admin credentials' },
        { status: 403 }
      );
    }

    // Extract optional gymId query parameter
    const { searchParams } = new URL(request.url);
    const gymId = searchParams.get('gymId');

    // Fetch failed SMS logs from database
    const supabase = createAdminClient();

    // Build query with optional gym filter
    let query = supabase
      .from('sms_logs')
      .select('id, gym_id, member_id, sms_type, phone_number, message_body, sent_at, delivery_status, error_message, text_lk_message_id')
      .eq('delivery_status', 'failed');

    // Apply gym filter if gymId provided
    if (gymId) {
      query = query.eq('gym_id', gymId);
    }

    // Execute query with ordering and limit
    const { data: failures, error: failuresError } = await query
      .order('sent_at', { ascending: false })
      .limit(50);

    if (failuresError) {
      console.error('Failed to fetch SMS failures:', failuresError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch SMS failures' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          failures: failures || [],
          totalCount: (failures || []).length,
          filters: {
            gymId: gymId || null,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('SMS failures API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
