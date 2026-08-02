import { getCurrentGymProfile } from '@/lib/middleware/auth'
import RegistrationQRCard from '@/features/registration/components/RegistrationQRCard'

/**
 * Settings → Registration — App Workspace design.
 *
 * Live QR self-registration link management (RegistrationQRCard; logo is
 * resolved server-side in the poster renderer). Intake automation
 * (auto-approve / default plan on sign-up) is intentionally not offered —
 * self-registrations land unverified and are approved via
 * POST /api/members/[id]/verify.
 */
export default async function RegistrationSettingsPage() {
  const gymProfile = await getCurrentGymProfile()

  return (
    <div className="flex flex-col gap-3">
      <RegistrationQRCard gymName={gymProfile.gym_name} />
    </div>
  )
}
