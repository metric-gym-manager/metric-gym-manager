import type { Metadata } from 'next'
import { getPublicGymInfo } from '@/features/registration/services/registration-link.service'
import JoinForm from '@/features/registration/components/JoinForm'

// Token lookups must never be cached — links can be rotated at any time
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Join Gym',
  robots: { index: false, follow: false },
}

interface JoinPageProps {
  params: Promise<{ token: string }>
}

/**
 * Public QR self-registration page (/join/{token}).
 *
 * Members reach this by scanning the gym's QR poster. No authentication —
 * the unguessable token is the only credential. Server-rendered so the gym
 * name and plan list are in the initial HTML (fast LCP on gym wifi).
 */
export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params
  const gymInfo = await getPublicGymInfo(token)

  if (!gymInfo) {
    return (
      <main className="min-h-screen bg-surface-panel flex items-center justify-center p-6">
        <div className="max-w-sm w-full rounded-sm bg-surface-card p-8 text-center  border">
          <h1 className="text-xl font-bold text-ink">
            This link is no longer active
          </h1>
          <p className="mt-3 text-sm text-ink-muted">
            The registration QR code may have been replaced. Please ask the
            front desk for the current one.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-surface-panel">
      <JoinForm
        token={token}
        gymName={gymInfo.gymName}
        plans={gymInfo.plans}
        admissionFee={gymInfo.admissionFee}
      />
    </main>
  )
}
