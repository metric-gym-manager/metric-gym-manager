'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2 } from 'lucide-react';
import { GrowthAvatarRing, useSubscription } from '@/features/subscriptions';
import type { GymProfile } from '@/features/auth/types';

export default function Header() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Growth-subscriber avatar ring: tier from the shared subscription query
  // (invalidated by upgrade/cancel mutations, so the ring appears/disappears
  // without a reload). Loading/error → undefined → ring simply not shown.
  const { data: subscription } = useSubscription();

  // Fetch gym profile using React Query for real-time updates
  const { data: gymProfile } = useQuery<GymProfile>({
    queryKey: ['gym-profile'],
    queryFn: async () => {
      const response = await fetch('/api/auth/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const result = await response.json();
      return result.data;
    },
    staleTime: 30000, // 30 seconds - consistent with sidebar
    refetchOnWindowFocus: true, // Refetch on focus to ensure fresh data after login
    refetchOnMount: true, // Always fetch on mount to prevent stale data after login
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

  const getInitials = () => {
    return gymProfile.gym_name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="hidden lg:block sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex h-16 items-center justify-between px-4 lg:px-8">
          {/* Gym name with profile picture */}
          <div className="flex items-center gap-3">
            {/* Profile Picture — Growth subscribers get the animated ring */}
            <GrowthAvatarRing tier={subscription?.subscription.subscriptionTier}>
              <div className="h-10 w-10 rounded-full border-2 border-gray-200 overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
                {gymProfile.profile_image_url ? (
                  <img
                    src={gymProfile.profile_image_url}
                    alt={gymProfile.gym_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-white text-sm font-bold">{getInitials()}</span>
                )}
              </div>
            </GrowthAvatarRing>

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
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="gap-2"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Logging out...</span>
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  <span>Log Out</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </header>
  );
}
