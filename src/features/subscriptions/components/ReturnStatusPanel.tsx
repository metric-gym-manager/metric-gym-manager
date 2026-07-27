'use client'

import { Card, CardBody, Button } from '@/components/ui'
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'
import type { PaymentPollState } from '../types'

interface ReturnStatusPanelProps {
  /** Poll state when returning with ?order= */
  pollState: PaymentPollState
  /** True when returning via cancel_url (?canceled=1) */
  canceled: boolean
  onRefresh: () => void
}

/**
 * Post-redirect verification panel (plan §5.4 flow 1, steps 5–9).
 *
 * PENDING is deliberately NOT rendered as failure: the webhook is the source
 * of truth and may arrive after the poll window.
 */
export default function ReturnStatusPanel({
  pollState,
  canceled,
  onRefresh,
}: ReturnStatusPanelProps) {
  if (canceled) {
    return (
      <Card className="border-line-2">
        <CardBody className="flex items-center gap-3 py-6">
          <XCircle className="h-6 w-6 text-ink-muted shrink-0" />
          <div>
            <p className="font-medium text-ink">Payment canceled</p>
            <p className="text-sm text-ink-secondary">
              You have not been charged. You can start the upgrade again
              anytime.
            </p>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (pollState === 'verifying') {
    return (
      <Card className="border-accentui-border">
        <CardBody className="flex items-center gap-3 py-6">
          <Loader2 className="h-6 w-6 text-brand-link animate-spin shrink-0" />
          <div>
            <p className="font-medium text-ink">Verifying your payment…</p>
            <p className="text-sm text-ink-secondary">
              Waiting for PayHere to confirm. This usually takes a few seconds.
            </p>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (pollState === 'success') {
    return (
      <Card className="border-success-border bg-success-bg">
        <CardBody className="flex items-center gap-3 py-6">
          <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
          <div>
            <p className="font-medium text-success">
              Your subscription is active!
            </p>
            <p className="text-sm text-success">
              Payment confirmed — your plan&apos;s features are live.
            </p>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (pollState === 'pending') {
    return (
      <Card className="border-warning-border bg-warning-bg">
        <CardBody className="flex items-start gap-3 py-6">
          <Clock className="h-6 w-6 text-warning shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-medium text-warning">
              Payment received — still confirming
            </p>
            <p className="text-sm text-warning">
              PayHere accepted your payment but the confirmation hasn&apos;t
              reached us yet. This can take a minute — your upgrade will apply
              automatically.
            </p>
            <Button variant="secondary" size="sm" onClick={onRefresh}>
              Refresh status
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return null
}
