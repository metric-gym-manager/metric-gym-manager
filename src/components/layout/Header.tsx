'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { GymProfile } from '@/features/auth/types';

export default function Header() {
  const router = useRouter();

  // Fetch gym profile using React Query for real-time updates
  const { data: gymProfile } = useQuery<GymProfile>({
    queryKey: ['gym-profile'],
    queryFn: async () => {
      const response = await fetch('/api/auth/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const result = await response.json();
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // Gym profile rarely changes mid-session
    refetchOnWindowFocus: false, // Match global default — no unnecessary refetches
  });

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

  // Show loading state while fetching
  if (!gymProfile) {
    return (
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex h-16 items-center justify-between px-4 lg:px-8">
          <div className="h-6 w-32 bg-gray-200 animate-pulse rounded" />
          <div className="h-10 w-20 bg-gray-200 animate-pulse rounded" />
        </div>
      </header>
    );
  }

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
