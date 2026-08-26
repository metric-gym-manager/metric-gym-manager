import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  updateGymProfileImage,
  removeGymProfileImage,
} from '@/features/settings/services/settings.service'
import {
  PROFILE_IMAGE_WEBP_MESSAGE,
  profileImageContainsWebp,
} from '@/features/settings/utils/profileImage'

// ============================================================
// POST /api/settings/gym/profile-image - Upload profile image
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get gym profile
    const { data: gymProfile, error: gymError } = await supabase
      .from('gyms')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (gymError || !gymProfile) {
      return NextResponse.json(
        { success: false, error: 'Gym profile not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const { imageUrl } = await request.json()

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid image URL' },
        { status: 400 }
      )
    }

    // Validate it's a data URL
    if (!imageUrl.startsWith('data:')) {
      return NextResponse.json(
        { success: false, error: 'Image must be a data URL' },
        { status: 400 }
      )
    }

    // Validate size (max 10MB for data URL)
    if (imageUrl.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Image too large (max 10MB)' },
        { status: 400 }
      )
    }

    // Reject WebP — the QR-poster renderer (Satori) cannot rasterise it, so a
    // WebP logo would silently disappear from the printed poster.
    if (profileImageContainsWebp(imageUrl)) {
      return NextResponse.json(
        { success: false, error: PROFILE_IMAGE_WEBP_MESSAGE },
        { status: 400 }
      )
    }

    await updateGymProfileImage(gymProfile.id, imageUrl)

    return NextResponse.json(
      {
        success: true,
        message: 'Profile image updated successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Upload profile image error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload profile image',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/settings/gym/profile-image - Remove profile image
// ============================================================

export async function DELETE(_request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: gymProfile, error: gymError } = await supabase
      .from('gyms')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (gymError || !gymProfile) {
      return NextResponse.json(
        { success: false, error: 'Gym profile not found' },
        { status: 404 }
      )
    }

    await removeGymProfileImage(gymProfile.id)

    return NextResponse.json(
      { success: true, message: 'Profile image removed successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Remove profile image error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove profile image',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
