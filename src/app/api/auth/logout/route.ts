import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logout } from '@/features/auth/services/auth.service'
import { REMEMBER_ME_COOKIE } from '@/lib/auth-config'

export async function POST() {
  try {
    const result = await logout()

    // Always clear the "remember me" cookie on logout, regardless of
    // whether the Supabase signOut succeeded.
    const cookieStore = await cookies()
    cookieStore.delete(REMEMBER_ME_COOKIE)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Logged out successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Logout API error:', error)

    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
