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
import { SaasTier, TIER_DISPLAY_NAME, type PaidTier } from '@/core/utils/constants/SubscriptionConfig';

interface UpgradeConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Which paid plan is being purchased (defaults to Growth). */
  targetTier?: PaidTier;
  priceLkr?: number | null;
}

/**
 * Upgrade confirmation (plan §5.4 flow 1, steps 2–4).
 *
 * Discloses the recurring charge explicitly, collects the billing city
 * PayHere requires, then hands the browser to PayHere via the plain form
 * POST. Card details are entered on PayHere only.
 */
export default function UpgradeConfirmDialog({
  open,
  onClose,
  targetTier = SaasTier.Growth,
  priceLkr,
}: UpgradeConfirmDialogProps) {
  const [city, setCity] = useState('');
  const checkout = useCheckout();
  const tierName = TIER_DISPLAY_NAME[targetTier];

  const handleConfirm = () => {
    if (!city.trim()) return;
    checkout.mutate({ city: city.trim(), targetTier });
    // On success the browser navigates to PayHere; no local close needed.
  };

  const handleClose = () => {
    if (!checkout.isPending) {
      setCity('');
      checkout.reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade to {tierName}</DialogTitle>
          <DialogDescription>
            {priceLkr
              ? `Rs. ${priceLkr.toLocaleString()} will be charged monthly by PayHere until you cancel.`
              : 'A monthly charge will be made by PayHere until you cancel.'}{' '}
            You will be redirected to PayHere to authorize the payment securely — your card details
            never touch this app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="billing-city">Billing city *</Label>
          <Input
            id="billing-city"
            placeholder="e.g. Colombo"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={checkout.isPending}
          />
          <p className="text-xs text-gray-500">
            Required by PayHere. Your gym name, email and phone are filled from your profile.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={checkout.isPending}>
            Not now
          </Button>
          <Button onClick={handleConfirm} disabled={!city.trim() || checkout.isPending}>
            {checkout.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Redirecting to PayHere…
              </>
            ) : (
              'Continue to payment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
