import { NextResponse } from 'next/server';
import { getApiGymProfile } from '@/lib/middleware/api-auth';

// ============================================================
// GET /api/auth/profile - Get current user's gym profile
// ============================================================

export async function GET() {
  const { gymProfile, error } = await getApiGymProfile();

  if (error) {
    return error;
  }

  // Expose a safe boolean so the UI can reveal demo-only tools without ever
  // shipping the allow-listed email to the client. Comparison stays server-side.
  const allowedEmail = process.env.DEMO_TOOLS_ALLOWED_EMAIL;
  const isDemoAccount = !!allowedEmail && gymProfile!.email === allowedEmail;

  return NextResponse.json(
    {
      success: true,
      data: { ...gymProfile, isDemoAccount },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-cache',
      },
    }
  );
}
