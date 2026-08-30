'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { SectionHeader, SettingsRow } from '@/components/common/composites'

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
    <div className="flex max-w-[720px] flex-col gap-6">
      <h1 className="text-h1 text-ink">Support</h1>

      {/* Contact */}
      <section>
        <SectionHeader variant="metadata" divider title="Contact" />
        <SettingsRow
          label="Call or WhatsApp"
          description="Mon–Sun, 08:00–22:00 IST · usually within a few hours"
          control={
            <a
              href="https://wa.me/94704379967"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-mono-md text-brand-link hover:text-brand-link-hover"
            >
              +94 70 437 9967
            </a>
          }
        />
        <SettingsRow
          label="Call now"
          description="Direct line to the Metric support desk"
          control={
            <a
              href="tel:0704379967"
              className="font-mono text-mono-md text-brand-link hover:text-brand-link-hover"
            >
              070 437 9967
            </a>
          }
        />
      </section>

      {/* Ticket */}
      <section>
        <SectionHeader variant="metadata" divider title="Open a ticket" />
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-3">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            aria-label="Subject"
          />
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            aria-label="Category"
          >
            <option value="general">General feedback</option>
            <option value="bug">Bug report</option>
            <option value="feature">Feature request</option>
          </Select>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional — for follow-up)"
            aria-label="Email"
          />
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the issue…"
            rows={4}
            maxLength={1000}
            aria-label="Message"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={feedbackMutation.isPending || !message.trim()}
            >
              {feedbackMutation.isPending ? 'Submitting…' : 'Submit ticket'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
