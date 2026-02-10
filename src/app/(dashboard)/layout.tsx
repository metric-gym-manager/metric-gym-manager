'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/login')
        return
      }

      // Fetch profile from users table
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (error || !profile) {
        router.push('/login')
        return
      }

      setUser({ ...authUser, ...(profile as any) })
    }

    getUser()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          router.push('/login')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-gray-900">Gym Management</h1>
              <nav className="hidden md:flex gap-4">
                <Link
                  href="/dashboard/admin"
                  className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-lg hover:bg-gray-100"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/admin/members"
                  className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-lg hover:bg-gray-100"
                >
                  Members
                </Link>
                <Link
                  href="/dashboard/admin/plans"
                  className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-lg hover:bg-gray-100"
                >
                  Plans
                </Link>
                <Link
                  href="/dashboard/admin/payments"
                  className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-lg hover:bg-gray-100"
                >
                  Payments
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500">{user.role.replace('_', ' ')}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
