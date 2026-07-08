'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Loader2 } from 'lucide-react';

type DemoSmsType = 'welcome' | 'due' | 'receipt';

interface DemoSmsPanelProps {
  /** The owner's gym name, used as the sender name in the demo message. */
  gymName: string;
}

const MESSAGE_TYPES: { value: DemoSmsType; label: string }[] = [
  { value: 'welcome', label: 'Welcome (new member)' },
  { value: 'due', label: 'Payment due reminder' },
  { value: 'receipt', label: 'Payment receipt' },
];

const PHONE_PATTERN = /^\+94\d{9}$/;

/**
 * Demo SMS panel — rendered only for the designated demo account
 * (gated by `gymProfile.isDemoAccount`). Lets the owner send a sample SMS to any
 * number to showcase the messaging system during an in-person gym visit.
 *
 * The real authorization lives server-side in /api/demo/send-sms; this panel's
 * visibility is a UX convenience, not the security boundary.
 */
export default function DemoSmsPanel({ gymName }: DemoSmsPanelProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+94');
  const [type, setType] = useState<DemoSmsType>('welcome');
  const [isSending, setIsSending] = useState(false);

  const phoneValid = PHONE_PATTERN.test(phone);
  const canSend = name.trim().length > 0 && phoneValid && !isSending;

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    try {
      const res = await fetch('/api/demo/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone, gymName, type }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to send demo SMS');
      }

      toast.success(
        result.mock
          ? 'Demo SMS generated (mock mode — no real message sent)'
          : 'Demo SMS sent successfully'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send demo SMS');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/40 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-semibold">Demo SMS</h2>
      </div>
      <p className="text-sm text-gray-600">
        Send a sample SMS to any number to showcase the messaging system during a
        gym visit. Only you can see this panel.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="demo-name">Recipient name</Label>
          <Input
            id="demo-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kasun"
          />
        </div>
        <div>
          <Label htmlFor="demo-phone">Phone (+94XXXXXXXXX)</Label>
          <Input
            id="demo-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+94771234567"
            inputMode="tel"
          />
          {phone.length > 3 && !phoneValid && (
            <p className="text-xs text-red-600 mt-1">
              Use Sri Lankan format: +94 followed by 9 digits.
            </p>
          )}
        </div>
      </div>

      <div className="sm:max-w-xs">
        <Label htmlFor="demo-type">Message type</Label>
        <Select value={type} onValueChange={(v) => setType(v as DemoSmsType)}>
          <SelectTrigger id="demo-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESSAGE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSend} disabled={!canSend}>
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Sending...
            </>
          ) : (
            'Send Demo SMS'
          )}
        </Button>
      </div>
    </div>
  );
}
