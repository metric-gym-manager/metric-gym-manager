import type { Metadata } from 'next'
import AuthShell from '@/components/auth/AuthShell'
import { UnsubscribeForm } from '@/features/mailing/components/UnsubscribeForm'
import { MailingTopic } from '@/features/mailing/config/MailingConfig'

/**
 * Reached only from the footer of a marketing or update email. Never indexed,
 * and public (PUBLIC_ROUTES): the person may have no session on this device.
 * The link carries `email` and `token`, which keeps Google Analytics off the
 * page (`SENSITIVE_QUERY_PARAMS`) — and `no-referrer` keeps them off the NEXT
 * page, which would otherwise read this URL as `document.referrer` and send it
 * to GA as `dr` (inverted check F9, 2026-10-06).
 */
export const metadata: Metadata = {
  title: 'Email preferences',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

type SearchParams = Record<string, string | string[] | undefined>

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

function toTopic(value: string): MailingTopic | null {
  return (Object.values(MailingTopic) as string[]).includes(value)
    ? (value as MailingTopic)
    : null
}

/**
 * /unsubscribe?email=…&token=…&topic=marketing|updates
 *
 * The token is checked when the form is submitted, not here: rendering makes
 * no call, so a mail scanner that opens the link changes nothing.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const email = single(params.email)
  const token = single(params.token)

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="mauth-hint">EMAIL PREFERENCES</span>
          <h1 className="m-0 text-xl font-semibold">Email preferences</h1>
        </div>
        {email && token ? (
          <UnsubscribeForm
            email={email}
            token={token}
            initialTopic={toTopic(single(params.topic))}
          />
        ) : (
          <div className="mauth-alert mauth-alert-warn">
            This link is incomplete. Use the unsubscribe link in your most
            recent email from us, or write to{' '}
            <a href="mailto:hello@metricgymos.com">hello@metricgymos.com</a> and
            we will update your preferences for you.
          </div>
        )}
      </div>
    </AuthShell>
  )
}
