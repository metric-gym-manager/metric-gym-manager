'use client';

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { Copy, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { printQrPosters, QR_EXPORT_SIZE } from '../utils/print-qr';
import type { RegistrationLink } from '../types';

/** On-screen size (px) of the QR preview; the canvas backing store stays high-res. */
const QR_DISPLAY_SIZE = 192;

interface RegistrationQRCardProps {
  gymName: string;
  /** Public URL of the gym's profile logo, shown on the printed poster. */
  logoUrl?: string | null;
}

/**
 * Gym settings card for the member self-registration QR code.
 *
 * Shows the QR + join link with copy / download / print actions.
 */
export default function RegistrationQRCard({ gymName, logoUrl }: RegistrationQRCardProps) {
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const { data: link, isLoading } = useQuery<RegistrationLink>({
    queryKey: ['registration-link'],
    queryFn: async () => {
      const response = await fetch('/api/settings/registration-link');
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result?.error?.message || 'Failed to load registration link');
      }
      return result.data;
    },
    staleTime: 300000,
  });

  const getQrDataUrl = (): string | null => {
    const canvas = qrContainerRef.current?.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png') : null;
  };

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link.joinUrl);
    toast.success('Link copied');
  };

  const handleDownload = () => {
    const dataUrl = getQrDataUrl();
    if (!dataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = 'registration-qr.png';
    anchor.click();
  };

  const handlePrint = () => {
    const dataUrl = getQrDataUrl();
    if (!dataUrl || !link) return;
    printQrPosters([{ gymName, qrDataUrl: dataUrl, joinUrl: link.joinUrl, logoUrl }]);
  };

  if (isLoading || !link) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="h-48 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold">Member Self-Registration QR</h3>
        <p className="mt-1 text-sm text-gray-500">
          Print this QR code and place it at the front desk. New members scan
          it, fill in their details with a selfie, and appear in your members
          list with a NEW badge — you just collect the cash.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div ref={qrContainerRef} className="rounded-xl border p-4 bg-white">
          <QRCodeCanvas
            value={link.joinUrl}
            size={QR_EXPORT_SIZE}
            level="M"
            marginSize={4}
            style={{ width: QR_DISPLAY_SIZE, height: QR_DISPLAY_SIZE }}
          />
        </div>

        <div className="flex-1 space-y-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 break-all">
            {link.joinUrl}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-1.5" /> Copy Link
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1.5" /> Download PNG
            </Button>
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1.5" /> Print
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
