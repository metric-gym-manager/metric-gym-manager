'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import type { PaymentPollState } from '../types';

interface ReturnStatusPanelProps {
  /** Poll state when returning with ?order= */
  pollState: PaymentPollState;
  /** True when returning via cancel_url (?canceled=1) */
  canceled: boolean;
  onRefresh: () => void;
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
      <Card className="border-gray-200">
        <CardContent className="flex items-center gap-3 py-6">
          <XCircle className="h-6 w-6 text-gray-500 shrink-0" />
          <div>
            <p className="font-medium">Payment canceled</p>
            <p className="text-sm text-gray-600">
              You have not been charged. You can start the upgrade again anytime.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pollState === 'verifying') {
    return (
      <Card className="border-blue-200">
        <CardContent className="flex items-center gap-3 py-6">
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin shrink-0" />
          <div>
            <p className="font-medium">Verifying your payment…</p>
            <p className="text-sm text-gray-600">
              Waiting for PayHere to confirm. This usually takes a few seconds.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pollState === 'success') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex items-center gap-3 py-6">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
          <div>
            <p className="font-medium text-green-800">You&apos;re on Pro!</p>
            <p className="text-sm text-green-700">
              Your subscription is active — member limits no longer apply.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pollState === 'pending') {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex items-start gap-3 py-6">
          <Clock className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-medium text-amber-800">Payment received — still confirming</p>
            <p className="text-sm text-amber-700">
              PayHere accepted your payment but the confirmation hasn&apos;t reached us yet. This
              can take a minute — your upgrade will apply automatically.
            </p>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Refresh status
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
