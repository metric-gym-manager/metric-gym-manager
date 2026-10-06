'use client'

import { useState } from 'react'
// Deep import: the @/features/mailing barrel is server-tainted (Resend SDK,
// node:crypto), so a client component must not import it.
import {
  ALWAYS_SENT_EMAILS,
  MAILING_TOPIC_DESCRIPTIONS,
  MAILING_TOPIC_LABELS,
  MailingTopic,
} from '../config/MailingConfig'

const TOPICS = [MailingTopic.Marketing, MailingTopic.Updates] as const

interface UnsubscribeFormProps {
  /** As the link delivered it; a `+` may have arrived as a space. */
  email: string
  token: string
  /** The kind of email the link came from, ticked to start with. */
  initialTopic: MailingTopic | null
}

/**
 * The /unsubscribe form: one checkbox per kind of email (marketing, and
 * product and security updates), each stopping only that kind. Says plainly
 * which emails keep arriving whatever is ticked (`ALWAYS_SENT_EMAILS`, which
 * the privacy policy states too).
 */
export function UnsubscribeForm({
  email,
  token,
  initialTopic,
}: UnsubscribeFormProps) {
  const address = email.trim().replace(/ /g, '+')
  const [chosen, setChosen] = useState<MailingTopic[]>(
    initialTopic ? [initialTopic] : []
  )
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  const toggle = (topic: MailingTopic) =>
    setChosen((current) =>
      current.includes(topic)
        ? current.filter((t) => t !== topic)
        : TOPICS.filter((t) => t === topic || current.includes(t))
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setStatus('submitting')
    try {
      const response = await fetch('/api/public/email-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address, token, topics: chosen }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        setError(
          result?.error?.message ||
            'Something went wrong. Please try again, or write to hello@metricgymos.com.'
        )
        setStatus('idle')
        return
      }
      setStatus('done')
    } catch {
      setError('Network error. Please try again.')
      setStatus('idle')
    }
  }

  if (status === 'done') {
    const kept = TOPICS.filter((t) => !chosen.includes(t))
    return (
      <div
        role="status"
        className="mauth-alert mauth-alert-ok flex flex-col gap-2"
      >
        <span>
          Done. <strong>{address}</strong> will no longer receive{' '}
          {chosen
            .map((t) => MAILING_TOPIC_LABELS[t].toLowerCase())
            .join(' or ')}
          .
        </span>
        {kept.length > 0 && (
          <span>
            You will still receive{' '}
            {kept
              .map((t) => MAILING_TOPIC_LABELS[t].toLowerCase())
              .join(' and ')}
            . Use the link in one of those emails to stop them too.
          </span>
        )}
        <span>
          Changed your mind? Write to{' '}
          <a href="mailto:hello@metricgymos.com">hello@metricgymos.com</a>.
        </span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="m-0 text-sm" style={{ color: 'var(--ma-t2)' }}>
        Choose which emails to stop sending to{' '}
        <strong style={{ color: 'var(--ma-t1)' }}>{address}</strong>.
      </p>

      {error && (
        <div role="alert" className="mauth-alert mauth-alert-err">
          {error}
        </div>
      )}

      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="mauth-label mb-2">Unsubscribe me from</legend>
        {TOPICS.map((topic) => (
          // The label WRAPS the box, so the whole row is the hit area (§15.1).
          <label
            key={topic}
            className="grid min-h-touch cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 gap-y-0.5 py-2"
          >
            <input
              type="checkbox"
              name="topics"
              value={topic}
              checked={chosen.includes(topic)}
              onChange={() => toggle(topic)}
              className="mt-0.5 h-4 w-4 cursor-pointer"
              style={{ accentColor: 'var(--ma-t1)' }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: 'var(--ma-t1)' }}
            >
              {MAILING_TOPIC_LABELS[topic]}
            </span>
            <span
              className="col-start-2 text-xs"
              style={{ color: 'var(--ma-t2)' }}
            >
              {MAILING_TOPIC_DESCRIPTIONS[topic]}
            </span>
          </label>
        ))}
      </fieldset>

      <button
        type="submit"
        disabled={chosen.length === 0 || status === 'submitting'}
        className="mauth-btn mauth-btn-primary"
      >
        {status === 'submitting' ? 'Saving…' : 'Unsubscribe'}
      </button>

      <div
        className="flex flex-col gap-2 text-xs"
        style={{ color: 'var(--ma-t2)' }}
      >
        <span>
          Whatever you choose, we still send emails needed to run your account:
        </span>
        <ul className="m-0 flex list-disc flex-col gap-1 pl-4">
          {ALWAYS_SENT_EMAILS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <span>
          See our <a href="/privacy">privacy policy</a> for details.
        </span>
      </div>
    </form>
  )
}
