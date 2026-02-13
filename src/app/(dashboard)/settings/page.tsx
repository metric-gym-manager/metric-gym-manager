import { redirect } from 'next/navigation';

export default function SettingsPage() {
  // Redirect to gym information tab by default
  redirect('/settings/gym');
}
