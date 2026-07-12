'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useCheckout } from '../hooks/useCheckout';
import { useChangePlan } from '../hooks/useChangePlan';
import { useSubscription } from '../hooks/useSubscription';
import { ApiRequestError } from '../services/subscriptions.service';
import { SaasTier, TIER_DISPLAY_NAME } from '@/core/utils/constants/SubscriptionConfig';

interface UpgradeConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Which plan is being purchased (defaults to Lite). */
  targetTier?: SaasTier;
  priceLkr?: number | null;
}

/**
 * Plan purchase / change confirmation (plan §5.4 flow 1, steps 2–4).
 *
 * Two modes, chosen by whether a card token is on file:
 *
 * INSTANT (saved card): one click charges the stored card for the new
 * tier's month and applies the change immediately — unused days of the
 * current period are banked onto the new one (C-33). No redirect. If the
 * server reports NO_SAVED_CARD (token invalidated), the dialog falls back
 * to checkout mode.
 *
 * CHECKOUT (no saved card): discloses the recurring charge, collects the
 * billing city PayHere requires, then hands the browser to PayHere's
 * preapproval page via the plain form POST — the card is entered on
 * PayHere only and its token is stored for future one-click changes.
 */
export default function UpgradeConfirmDialog({
  open,
  onClose,
  targetTier = SaasTier.Lite,
  priceLkr,
}: UpgradeConfirmDialogProps) {
  const [city, setCity] = useState('');
  const [fallbackToCheckout, setFallbackToCheckout] = useState(false);
  const { data } = useSubscription();
  const checkout = useCheckout();
  const changePlan = useChangePlan();
  const tierName = TIER_DISPLAY_NAME[targetTier];

  const hasSavedCard = data?.subscription.hasSavedCard ?? false;
  const instant = hasSavedCard && !fallbackToCheckout;
  const busy = checkout.isPending || changePlan.isPending;

  const handleConfirm = () => {
    if (instant) {
      changePlan.mutate(targetTier, {
        onSuccess: () => {
          setFallbackToCheckout(false);
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiRequestError && error.code === 'NO_SAVED_CARD') {
            setFallbackToCheckout(true); // token gone — collect the card again
          }
        },
      });
      return;
    }
    if (!city.trim()) return;
    checkout.mutate({ city: city.trim(), targetTier });
    // On success the browser navigates to PayHere; no local close needed.
  };

  const handleClose = () => {
    if (!busy) {
      setCity('');
      setFallbackToCheckout(false);
      checkout.reset();
      changePlan.reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {instant ? `Switch to ${tierName}` : `Subscribe to ${tierName}`}
          </DialogTitle>
          <DialogDescription>
            {instant ? (
              <>
                {priceLkr
                  ? `Rs. ${priceLkr.toLocaleString()} will be charged to your saved card now, `
                  : 'The monthly price will be charged to your saved card now, '}
                and your plan changes immediately. Any unused days already paid on your current
                plan are added to the new billing period — nothing you&apos;ve paid for is lost.
                Billing continues monthly at the new price.
              </>
            ) : (
              <>
                {priceLkr
                  ? `Rs. ${priceLkr.toLocaleString()} will be charged monthly by PayHere until you cancel.`
                  : 'A monthly charge will be made by PayHere until you cancel.'}{' '}
                You will be redirected to PayHere to authorize the payment securely — your card
                details never touch this app, and your card is saved for one-click plan changes
                later.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!instant && (
          <div className="space-y-2">
            <Label htmlFor="billing-city">Billing city *</Label>
            <Input
              id="billing-city"
              placeholder="e.g. Colombo"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={busy}
            />
            <p className="text-xs text-gray-500">
              Required by PayHere. Your gym name, email and phone are filled from your profile.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            Not now
          </Button>
          <Button onClick={handleConfirm} disabled={busy || (!instant && !city.trim())}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {instant ? 'Charging your card…' : 'Redirecting to PayHere…'}
              </>
            ) : instant ? (
              priceLkr ? `Pay Rs. ${priceLkr.toLocaleString()} now` : 'Confirm and pay now'
            ) : (
              'Continue to payment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
