'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { GymProfile } from '@/features/auth/types';

interface HeaderProps {
  gymProfile: GymProfile;
}

export default function Header({ gymProfile }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="flex h-16 items-center justify-between px-4 lg:px-8">
        {/* Gym name */}
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-gray-900">
            {gymProfile.gym_name}
          </h2>
        </div>

        {/* Right side - User info and logout */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-900">
              {gymProfile.username}
            </p>
            <p className="text-xs text-gray-500">{gymProfile.email}</p>
          </div>

          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
