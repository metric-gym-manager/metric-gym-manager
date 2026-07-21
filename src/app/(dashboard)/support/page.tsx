'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Panel, PanelHead } from '@/components/workspace/primitives'

type Category = 'bug' | 'feature' | 'general'

/**
 * Support — App Workspace design. Contact rows (label left / value right) +
 * a ticket form wired to /api/feedback. Subject is prepended to the message
 * body so the existing feedback endpoint is unchanged.
 */
export default function SupportPage() {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState<Category>('general')

  const feedbackMutation = useMutation({
    mutationFn: async (data: {
      message: string
      email?: string
      category: string
    }) => {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send feedback')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success(
        'Ticket submitted — thank you! We typically respond within a few hours.'
      )
      setSubject('')
      setMessage('')
      setEmail('')
      setCategory('general')
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit ticket'
      ),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) {
      toast.error('Please describe the issue')
      return
    }
    const body = subject.trim()
      ? `[${subject.trim()}] ${message.trim()}`
      : message.trim()
    feedbackMutation.mutate({
      message: body,
      email: email || undefined,
      category,
    })
  }

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 720 }}>
      <h1 className="mws-h1">Support</h1>

      {/* Contact */}
      <Panel style={{ overflow: 'hidden' }}>
        <div className="mws-row">
          <div>
            <div className="mws-row-title">Call or WhatsApp</div>
            <div className="mws-row-sub">
              Mon–Sun, 08:00–22:00 IST · usually within a few hours
            </div>
          </div>
          <a
            href="https://wa.me/94704379967"
            target="_blank"
            rel="noopener noreferrer"
            className="mws-mono"
            style={{ fontSize: 12, color: 'var(--mws-accent-tint)' }}
          >
            +94 70 437 9967
          </a>
        </div>
        <div className="mws-row">
          <div>
            <div className="mws-row-title">Call now</div>
            <div className="mws-row-sub">
              Direct line to the Metric support desk
            </div>
          </div>
          <a
            href="tel:0704379967"
            className="mws-mono"
            style={{ fontSize: 12, color: 'var(--mws-accent-tint)' }}
          >
            070 437 9967
          </a>
        </div>
      </Panel>

      {/* Ticket */}
      <Panel>
        <PanelHead label="Open a ticket" />
        <form
          onSubmit={handleSubmit}
          style={{ padding: 16 }}
          className="flex flex-col gap-3"
        >
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="mws-input"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="mws-select"
          >
            <option value="general">General feedback</option>
            <option value="bug">Bug report</option>
            <option value="feature">Feature request</option>
          </select>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional — for follow-up)"
            className="mws-input"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the issue…"
            rows={4}
            maxLength={1000}
            className="mws-textarea"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={feedbackMutation.isPending || !message.trim()}
              className="mws-btn mws-btn-primary"
            >
              {feedbackMutation.isPending ? 'Submitting…' : 'Submit ticket'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  )
}
