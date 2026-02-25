import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/callback',
];

// Auth routes that authenticated users shouldn't access
const authRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/forgot-password',
  '/auth/reset-password',
];

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;
  const isPublicRoute = publicRoutes.some((route) => pathname === route);
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL('/members', request.url));
  }

  // Redirect unauthenticated users to login for protected routes
  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Helper to get current user in Server Components
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

// Helper to get current gym profile (performs full auth check)
export async function getCurrentGymProfile() {
  const user = await requireAuth();

  const supabase = await createClient();
  const { data: gymProfile, error } = await supabase
    .from('gyms')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !gymProfile) {
    throw new Error('Gym profile not found');
  }

  return gymProfile;
}

// Lighter helper for dashboard layout — skips redundant getUser() since
// middleware already verified authentication. Only checks gym profile exists.
export async function getGymProfileForLayout() {
  const supabase = await createClient();

  // Use getUser() once (middleware already validated, but we need user.id)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: gymProfile, error } = await supabase
    .from('gyms')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (error || !gymProfile) {
    throw new Error('Gym profile not found');
  }

  return gymProfile;
}
