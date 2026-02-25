import { permanentRedirect } from 'next/navigation';

export default function SettingsPage() {
  // Permanent redirect — browser caches the 308 response, avoiding server roundtrip on repeat visits
  permanentRedirect('/settings/gym');
}
