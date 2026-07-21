'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import {
  Home,
  Users,
  DollarSign,
  CreditCard,
  Megaphone,
  Settings,
  LogOut,
  Loader2,
  Headset,
  Receipt,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GymProfile } from '@/features/auth/types'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: 'Members',
    href: '/members',
    icon: Users,
  },
  {
    name: 'Revenue',
    href: '/revenue',
    icon: DollarSign,
  },
  {
    name: 'Fee Collection',
    href: '/payment-collection',
    icon: CreditCard,
  },
  {
    name: 'Announcements',
    href: '/make-announcement',
    icon: Megaphone,
  },
  {
    name: 'Billing Setup',
    href: '/billing-setup',
    icon: Receipt,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
  {
    name: 'Support',
    href: '/support',
    icon: Headset,
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Fetch gym profile for mobile header
  const { data: gymProfile } = useQuery<GymProfile>({
    queryKey: ['gym-profile'],
    queryFn: async () => {
      const response = await fetch('/api/auth/profile')
      if (!response.ok) throw new Error('Failed to fetch profile')
      const result = await response.json()
      return result.data
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  })

  const handleLogout = async () => {
    if (isLoggingOut) return // Prevent duplicate requests

    setIsLoggingOut(true)

    try {
      // Call logout API (ignore response, always clear cache and redirect)
      await fetch('/api/auth/logout', {
        method: 'POST',
      })

      // Clear cache regardless of response status to ensure clean state
      queryClient.clear()

      // Always redirect to login, even if API call failed. Use a full-document
      // navigation so the middleware re-runs with the now-cleared session
      // cookies and the authenticated layout is fully torn down — a client-side
      // router replace would keep serving the stale, signed-in Router Cache
      // until a manual refresh.
      window.location.replace('/login')
    } catch (error) {
      console.error('Logout error:', error)
      // Still clear cache and redirect on error
      queryClient.clear()
      window.location.replace('/login')
    } finally {
      // Keep loading state until redirect completes
      // Don't set to false to prevent re-renders during navigation
    }
  }

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Metric Gym Manager Logo"
              width={24}
              height={24}
              className="w-6 h-6"
            />
            <h1 className="text-xl font-bold text-gray-900">
              Metric Gym Manager
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    const Icon = item.icon
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            isActive
                              ? 'bg-gray-100 text-gray-900'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors duration-150'
                          )}
                        >
                          <Icon
                            className="h-5 w-5 text-blue-600"
                            strokeWidth={2}
                          />
                          {item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile view */}
      <div className="lg:hidden">
        {/* Mobile header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Profile Picture Circle */}
              <div className="h-9 w-9 rounded-full border-2 border-gray-200 overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
                {gymProfile ? (
                  gymProfile.profile_image_url ? (
                    <img
                      src={gymProfile.profile_image_url}
                      alt={gymProfile.gym_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-xs font-bold">
                      {gymProfile.gym_name
                        .split(' ')
                        .map((word) => word[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </span>
                  )
                ) : (
                  <div className="h-full w-full bg-gray-200 animate-pulse" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {gymProfile ? (
                  <>
                    <h1 className="text-sm font-bold text-gray-900 truncate">
                      {gymProfile.gym_name}
                    </h1>
                    <p className="text-xs text-gray-500">Metric Gym Manager</p>
                  </>
                ) : (
                  <div className="space-y-1">
                    <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
                    <div className="h-3 w-24 bg-gray-200 animate-pulse rounded" />
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="shrink-0"
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

        {/* Mobile bottom navigation - Horizontally swipable */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
          <nav className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
              const Icon = item.icon
              // Determine if label is long
              const isLongLabel = item.name.length > 8
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    isActive ? 'text-blue-600' : 'text-gray-600',
                    'flex flex-col items-center py-2 px-3 min-w-[80px] snap-start shrink-0'
                  )}
                >
                  <Icon
                    className="h-6 w-6 text-blue-600 mb-1"
                    strokeWidth={2}
                  />
                  <span
                    className={cn(
                      'font-medium text-center leading-tight',
                      isLongLabel ? 'text-[10px]' : 'text-xs'
                    )}
                  >
                    {item.name}
                  </span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </>
  )
}
