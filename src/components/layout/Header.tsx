'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2 } from 'lucide-react';
import type { GymProfile } from '@/features/auth/types';

export default function Header() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
    if (isLoggingOut) return; // Prevent duplicate requests

    setIsLoggingOut(true);

    try {
      // Call logout API (ignore response, always clear cache and redirect)
      await fetch('/api/auth/logout', {
        method: 'POST',
      });

      // Clear cache regardless of response status to ensure clean state
      queryClient.clear();

      // Always redirect to login, even if API call failed
      // This ensures user can't get stuck in a broken state
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear cache and redirect on error
      queryClient.clear();
      router.replace('/login');
    } finally {
      // Keep loading state until redirect completes
      // Don't set to false to prevent re-renders during navigation
    }
  };

  // Show loading state while fetching
  if (!gymProfile) {
    return (
      <header className="hidden lg:block sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex h-16 items-center justify-between px-4 lg:px-8">
          <div className="h-6 w-32 bg-gray-200 animate-pulse rounded" />
          <div className="h-10 w-20 bg-gray-200 animate-pulse rounded" />
        </div>
      </header>
    );
  }

  return (
    <header className="hidden lg:block sticky top-0 z-40 bg-white border-b border-gray-200">
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

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Logout"
            >
              {isLoggingOut ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogOut className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </header>
  );
}
