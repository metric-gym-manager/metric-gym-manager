import {
  derivePosterLocation,
  getOrCreateRegistrationLink,
} from '@/features/registration/services/registration-link.service'
import { renderQrPosterPng } from '@/features/registration/services/qr-poster'
import { getApiGymProfile } from '@/lib/middleware/api-auth'
import { ResponseBuilder } from '@/utils/api'

// ============================================================
// GET /api/settings/qr-poster
// The current gym's "2b" registration poster as a PNG (session auth).
// Powers the Download PNG + Print actions on the settings QR card.
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { gymProfile, error } = await getApiGymProfile()
  if (error) {
    return error // 401 (no session) or 404 (no gym profile)
  }

  const link = await getOrCreateRegistrationLink(gymProfile!.id)

  const png = await renderQrPosterPng({
    gymName: gymProfile!.gym_name,
    location: derivePosterLocation(gymProfile!.gym_address),
    logoUrl: gymProfile!.profile_image_url,
    joinUrl: link.joinUrl,
  })

  return ResponseBuilder.binary(png, 'image/png', {
    cacheControl: 'private, no-store',
  })
}
