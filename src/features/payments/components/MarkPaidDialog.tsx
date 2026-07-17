'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Info } from 'lucide-react';
import { calculateNextDueDate, formatDate } from '@/utils/date/date';

interface MarkPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  amount: number;
  planType: string;
  onConfirm: (paymentDate: string) => void;
}

export default function MarkPaidDialog({
  open,
  onOpenChange,
  memberName,
  amount,
  planType,
  onConfirm,
}: MarkPaidDialogProps) {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);

  // Reset to today when the dialog (re)opens — render-time adjustment
  // (React "storing information from previous renders" pattern)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelectedDate(today);
    }
  }

  const nextDueDate = calculateNextDueDate(selectedDate, planType);
  const isFutureDate = new Date(selectedDate) > new Date(today);

  const handleConfirm = () => {
    onConfirm(selectedDate);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirm Payment</DialogTitle>
          <DialogDescription>
            Review payment details and confirm to record the payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Member Info */}
          <div>
            <Label className="text-sm text-gray-500">Record payment for</Label>
            <p className="text-lg font-semibold text-gray-900">{memberName}</p>
          </div>

          {/* Amount */}
          <div>
            <Label className="text-sm text-gray-500">Amount</Label>
            <p className="text-lg font-semibold text-gray-900">
              Rs. {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Payment Date Picker */}
          <div>
            <Label htmlFor="payment-date" className="text-sm font-medium">
              Payment Date
            </Label>
            <Input
              id="payment-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-500">
              Choose the date when this payment was made
            </p>
          </div>

          {/* Future Date Warning */}
          {isFutureDate && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Future Date Selected
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  The payment date is in the future. Please confirm this is intentional.
                </p>
              </div>
            </div>
          )}

          {/* Next Due Date Preview */}
          <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 p-3">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Next Due Date
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                Member&apos;s next payment will be due on {formatDate(nextDueDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Confirm Payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
