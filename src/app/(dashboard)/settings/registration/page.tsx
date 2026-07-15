import { getCurrentGymProfile } from '@/lib/middleware/auth';
import RegistrationQRCard from '@/features/registration/components/RegistrationQRCard';

/**
 * Settings → Member Registration
 *
 * QR self-registration link management for the gym.
 */
export default async function RegistrationSettingsPage() {
  const gymProfile = await getCurrentGymProfile();

  return (
    <div className="space-y-6">
      <RegistrationQRCard gymName={gymProfile.gym_name} />
    </div>
  );
}
