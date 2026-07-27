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
  const result = await getPublicGymInfo(token)

  // Only a genuinely unknown/deactivated token is reported as a dead QR code.
  if (result.status === 'not_found') {
    return (
      <JoinMessage title="This link is no longer active">
        The registration QR code may have been replaced. Please ask the front
        desk for the current one.
      </JoinMessage>
    )
  }

  // A failed lookup is OUR problem, not a replaced poster — telling a member
  // their gym's QR code is dead when the database merely hiccuped sends the
  // whole gym back to the front desk (rule 2.8).
  if (result.status === 'error') {
    return (
      <JoinMessage title="We couldn't load this page">
        Something went wrong on our side. Please try again in a moment — your
        gym&apos;s QR code is still valid.
      </JoinMessage>
    )
  }

  const gymInfo = result.gym

  return (
    <main className="min-h-screen bg-gray-50">
      <JoinForm
        token={token}
        gymName={gymInfo.gymName}
        plans={gymInfo.plans}
        admissionFee={gymInfo.admissionFee}
      />
    </main>
  )
}

/** Full-screen centred notice shown when the form cannot be rendered. */
function JoinMessage({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full rounded-2xl bg-white p-8 text-center shadow-sm border">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="mt-3 text-sm text-gray-500">{children}</p>
      </div>
    </main>
  )
}
