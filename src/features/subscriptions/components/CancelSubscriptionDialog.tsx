'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { STARTER_TIER_MEMBER_LIMIT } from '@/core/utils/constants/SubscriptionConfig';
import { useCancelSubscription } from '../hooks/useCancelSubscription';
import type { SerializedSubscription } from '../types';

interface CancelSubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
  subscription: SerializedSubscription;
}

/**
 * Cancel confirmation with full consequence disclosure (plan §5.4 flow 4).
 */
export default function CancelSubscriptionDialog({
  open,
  onClose,
  subscription: sub,
}: CancelSubscriptionDialogProps) {
  const cancel = useCancelSubscription();
  const overLimit = sub.memberCount > STARTER_TIER_MEMBER_LIMIT;

  const handleConfirm = () => {
    cancel.mutate(undefined, { onSettled: onClose });
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && !cancel.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel your Growth subscription?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>
                You keep Growth features until{' '}
                <span className="font-semibold">
                  {sub.currentPeriodEnd ?? 'the end of the current paid period'}
                </span>
                .
              </li>
              <li>
                After that, your account reverts to the Starter plan ({STARTER_TIER_MEMBER_LIMIT}-member
                limit).
              </li>
              <li>
                Your {sub.memberCount} members and all data are kept
                {overLimit && (
                  <>
                    {' '}
                    — since you&apos;re over {STARTER_TIER_MEMBER_LIMIT}, you won&apos;t be able to add{' '}
                    <span className="font-semibold">new</span> members until you re-subscribe
                  </>
                )}
                .
              </li>
              <li>No further charges will be made.</li>
              <li>
                This cannot be undone from here — re-subscribing starts a new billing cycle.
              </li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancel.isPending}>Keep Growth</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={cancel.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {cancel.isPending ? 'Canceling…' : 'Cancel subscription'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
