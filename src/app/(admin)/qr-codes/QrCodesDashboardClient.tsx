'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { printQrPosters, type QrPoster } from '@/features/registration/utils/print-qr';

interface GymQrItem {
  gymId: string;
  gymName: string;
  username: string;
  email: string;
  token: string | null;
  joinUrl: string | null;
  isActive: boolean;
  rotatedAt: string | null;
}

/**
 * Admin QR dashboard grid: searchable list of every gym's QR code with
 * per-gym print and print-all. QR codes are pure functions of the join URL,
 * so nothing is stored — each card renders its own canvas, and printing
 * reads the PNG data URL straight off that canvas.
 */
export default function QrCodesDashboardClient() {
  const [search, setSearch] = useState('');
  const canvasRefs = useRef(new Map<string, HTMLDivElement>());

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

  const posterFor = (gym: GymQrItem): QrPoster | null => {
    const container = canvasRefs.current.get(gym.gymId);
    const canvas = container?.querySelector('canvas');
    if (!canvas || !gym.joinUrl) return null;
    return {
      gymName: gym.gymName,
      qrDataUrl: canvas.toDataURL('image/png'),
      joinUrl: gym.joinUrl,
    };
  };

  const handlePrintOne = (gym: GymQrItem) => {
    const poster = posterFor(gym);
    if (poster) printQrPosters([poster]);
  };

  const handlePrintAll = () => {
    const posters = filtered
      .map(posterFor)
      .filter((poster): poster is QrPoster => poster !== null);
    if (posters.length > 0) printQrPosters(posters);
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

              <div
                ref={(node) => {
                  if (node) canvasRefs.current.set(gym.gymId, node);
                  else canvasRefs.current.delete(gym.gymId);
                }}
                className="my-4 rounded-lg border p-3"
              >
                <QRCodeCanvas value={gym.joinUrl!} size={144} level="M" includeMargin />
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
