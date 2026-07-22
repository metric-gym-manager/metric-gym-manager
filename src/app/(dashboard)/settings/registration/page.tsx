import { getCurrentGymProfile } from '@/lib/middleware/auth'
import RegistrationQRCard from '@/features/registration/components/RegistrationQRCard'
import IntakeRules from './IntakeRules'

/**
 * Settings → Registration — App Workspace design.
 *
 * Live QR self-registration link management (RegistrationQRCard; logo is now
 * resolved server-side in the poster renderer) plus the design's "Intake
 * rules" panel (dead-code — see IntakeRules).
 */
export default async function RegistrationSettingsPage() {
  const gymProfile = await getCurrentGymProfile()

  return (
    <div className="flex flex-col gap-3">
      <RegistrationQRCard gymName={gymProfile.gym_name} />
      <IntakeRules />
    </div>
  )
}
