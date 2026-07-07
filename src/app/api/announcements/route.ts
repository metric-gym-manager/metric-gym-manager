import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminContainer } from '@/infrastructure/di';
import { isFeatureEnabled } from '@/core/domain/subscription/PlanRestrictions';
import { SaasTier, TIER_DISPLAY_NAME } from '@/core/utils/constants/SubscriptionConfig';
import { getAnnouncements, createAndSendAnnouncement } from '@/features/announcements/services/announcement.service';
import { createAnnouncementSchema } from '@/features/announcements/schemas/announcement.schemas';

// ============================================================
// GET /api/announcements - Fetch all announcements for the gym
// ============================================================

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get gym profile
    const { data: gymProfile, error: gymError } = await supabase
      .from('gyms')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (gymError || !gymProfile) {
      return NextResponse.json(
        { success: false, error: 'Gym profile not found' },
        { status: 404 }
      );
    }

    // Get announcements
    const announcements = await getAnnouncements(gymProfile.id);

    return NextResponse.json(
      {
        success: true,
        data: announcements,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get announcements error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch announcements',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/announcements - Create and send announcement
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get gym profile
    const { data: gymProfile, error: gymError } = await supabase
      .from('gyms')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (gymError || !gymProfile) {
      return NextResponse.json(
        { success: false, error: 'Gym profile not found' },
        { status: 404 }
      );
    }

    // Plan restriction (PlanRestrictions matrix): announcements are a Growth
    // feature. Enforced HERE, before any validation or work — the client-side
    // page gate is UX only. Fail closed if the subscription cannot be loaded.
    const container = await getAdminContainer();
    const subscription = await container
      .getGymSubscriptionRepository()
      .findByGymId(gymProfile.id);
    if (!subscription || !isFeatureEnabled(subscription.tier, 'announcements')) {
      return NextResponse.json(
        {
          success: false,
          error: `Announcements are a ${TIER_DISPLAY_NAME[SaasTier.Growth]} feature. Upgrade to send SMS announcements to your members.`,
          errorCode: 'FEATURE_NOT_AVAILABLE',
        },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validatedData = createAnnouncementSchema.parse(body);

    // Create and send announcement (SMS sent in background)
    const result = await createAndSendAnnouncement(gymProfile.id, validatedData);

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `Announcement queued and sending to ${result.recipientCount} member(s) in the background.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create announcement error:', error);

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send announcement',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
