'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  printQrPosters,
  QR_EXPORT_SIZE,
  type QrPoster,
} from '@/features/registration/utils/print-qr';

interface GymQrItem {
  gymId: string;
  gymName: string;
  username: string;
  email: string;
  profileImageUrl: string | null;
  token: string | null;
  joinUrl: string | null;
  isActive: boolean;
  rotatedAt: string | null;
}

/**
 * Admin QR dashboard grid: searchable list of every gym's QR code with
 * per-gym print and print-all. QR codes are pure functions of the join URL,
 * so nothing is stored — each card renders a small preview canvas. Printing
 * renders high-resolution canvases off-screen for just the gym(s) being
 * printed and reads print-quality PNGs from those.
 */
export default function QrCodesDashboardClient() {
  const [search, setSearch] = useState('');
  // Gyms queued for printing. Their high-resolution QR canvases are mounted
  // off-screen only while a print is in flight (see the effect below), so the
  // visible grid stays lightweight no matter how many gyms are listed.
  const [printQueue, setPrintQueue] = useState<GymQrItem[] | null>(null);
  const printRefs = useRef(new Map<string, HTMLDivElement>());

  const { data: gyms, isLoading, error } = useQuery<GymQrItem[]>({
    queryKey: ['admin-qr-codes'],
    queryFn: async () => {
      const response = await fetch('/api/admin/qr-codes');
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Failed to load QR codes');
      }
      return result.data;
    },
    staleTime: 300000,
  });

  const filtered = useMemo(() => {
    const items = (gyms ?? []).filter((gym) => gym.joinUrl);
    if (!search.trim()) return items;
    const query = search.trim().toLowerCase();
    return items.filter(
      (gym) =>
        gym.gymName.toLowerCase().includes(query) ||
        gym.username.toLowerCase().includes(query) ||
        gym.email.toLowerCase().includes(query)
    );
  }, [gyms, search]);

  // Once the queued gyms' off-screen high-res canvases have mounted and painted,
  // read their PNGs and open the print dialog. qrcode.react draws each canvas in
  // its own effect, and React flushes child effects before this parent effect,
  // so the canvases are guaranteed to be rendered by the time this runs.
  useEffect(() => {
    if (!printQueue) return;
    const posters = printQueue
      .map((gym): QrPoster | null => {
        const container = printRefs.current.get(gym.gymId);
        const canvas = container?.querySelector('canvas');
        if (!canvas || !gym.joinUrl) return null;
        return {
          gymName: gym.gymName,
          qrDataUrl: canvas.toDataURL('image/png'),
          joinUrl: gym.joinUrl,
          logoUrl: gym.profileImageUrl,
        };
      })
      .filter((poster): poster is QrPoster => poster !== null);
    if (posters.length > 0) printQrPosters(posters);
    // The PNGs are now captured as data URLs, so unmount the off-screen
    // canvases to free their memory. Deferred to the next frame so the reset
    // doesn't cascade synchronously inside this effect.
    const frame = requestAnimationFrame(() => setPrintQueue(null));
    return () => cancelAnimationFrame(frame);
  }, [printQueue]);

  const handlePrintOne = (gym: GymQrItem) => setPrintQueue([gym]);
  const handlePrintAll = () => {
    if (filtered.length > 0) setPrintQueue(filtered);
  };

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">Failed to load QR codes. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/*
        Off-screen high-resolution QR canvases, mounted only for the gym(s)
        currently being printed. Reading toDataURL() off these instead of the
        small on-screen previews gives print-quality PNGs without keeping a
        large canvas mounted for every gym in the grid.
      */}
      {printQueue && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-[-99999px] top-0 h-0 w-0 overflow-hidden"
        >
          {printQueue.map((gym) =>
            gym.joinUrl ? (
              <div
                key={gym.gymId}
                ref={(node) => {
                  if (node) printRefs.current.set(gym.gymId, node);
                  else printRefs.current.delete(gym.gymId);
                }}
              >
                <QRCodeCanvas
                  value={gym.joinUrl}
                  size={QR_EXPORT_SIZE}
                  level="M"
                  marginSize={4}
                />
              </div>
            ) : null
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search gyms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handlePrintAll} disabled={filtered.length === 0}>
          <Printer className="h-4 w-4 mr-1.5" />
          Print All ({filtered.length})
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border bg-white">
          <p className="text-sm text-gray-500">No gyms found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((gym) => (
            <div
              key={gym.gymId}
              className="rounded-lg border bg-white p-4 flex flex-col items-center text-center"
            >
              <h3 className="font-semibold text-gray-900 truncate w-full" title={gym.gymName}>
                {gym.gymName}
              </h3>
              <p className="text-xs text-gray-500 truncate w-full">{gym.email}</p>

              <div className="my-4 rounded-lg border p-3">
                <QRCodeCanvas value={gym.joinUrl!} size={144} level="M" marginSize={4} />
              </div>

              <Button size="sm" variant="outline" onClick={() => handlePrintOne(gym)}>
                <Printer className="h-4 w-4 mr-1.5" /> Print
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
