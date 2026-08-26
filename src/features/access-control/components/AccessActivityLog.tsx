'use client'

/**
 * The check-in log.
 *
 * ## What is in here, and what is deliberately not
 *
 * Successful entries and whatever else the terminals push us. Refusals mostly
 * do **not** appear: the device keeps them in its own transaction table and
 * never sends them. That is not a gap to apologise for — our database already
 * knows why a member would be refused, in better words than a device code, and
 * that explanation lives on the member's own panel.
 *
 * ## Why the filter is a server round-trip
 *
 * Filtering a fetched page in the browser would show "however many of these 50
 * rows happen to match", and the pager underneath it would be lying. The kind
 * filter goes to the API, which turns it into a code list and filters in SQL,
 * so the count and the pages describe the same set of rows the reader is
 * looking at.
 */

import { useState } from 'react'
import { DoorOpen, ShieldX, TriangleAlert, Wrench } from 'lucide-react'
import {
  Badge,
  EmptyState,
  Pagination,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { Button } from '@/components/ui'
import { useAccessEvents } from '../hooks/useAccessControl'
import { DeviceEventKind } from '../config/DeviceEventCodes'
import type { SerializedAccessEvent } from '../utils/serializeAccessForAPI'

const PAGE_SIZE = 25

/**
 * The filter chips.
 *
 * `Other` is absent on purpose: it is defined by *not* being one of the known
 * kinds, so it has no code list to filter on, and a gym has no reason to ask
 * for "events we could not categorise".
 */
const FILTERS: Array<{ label: string; kind?: DeviceEventKind }> = [
  { label: 'All' },
  { label: 'Entries', kind: DeviceEventKind.Granted },
  { label: 'Refusals', kind: DeviceEventKind.Denied },
  { label: 'Alerts', kind: DeviceEventKind.Alarm },
  { label: 'Device', kind: DeviceEventKind.System },
]

interface AccessActivityLogProps {
  /** Narrow to one member — used by the member panel. */
  memberId?: string
}

export default function AccessActivityLog({
  memberId,
}: AccessActivityLogProps) {
  const [page, setPage] = useState(1)
  const [kind, setKind] = useState<DeviceEventKind | undefined>(undefined)

  const { data, isLoading } = useAccessEvents({
    page,
    limit: PAGE_SIZE,
    memberId,
    kind,
  })

  const selectFilter = (next?: DeviceEventKind) => {
    setKind(next)
    // Page 3 of "all" is rarely page 3 of "refusals", and landing on an empty
    // page reads as "no refusals" when there are plenty on page 1.
    setPage(1)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
          <Button
            key={filter.label}
            size="sm"
            variant={kind === filter.kind ? 'primary' : 'ghost'}
            onClick={() => selectFilter(filter.kind)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data || data.events.length === 0 ? (
        <EmptyState
          icon={<DoorOpen className="h-5 w-5" aria-hidden="true" />}
          title="Nothing here yet"
          description={
            kind
              ? 'No activity of this kind in the log.'
              : 'Scans will appear here as members use the readers.'
          }
        />
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>What happened</TableHead>
                  <TableHead>Reader</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(event.occurredAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {event.memberName ?? (
                        // An unrecognised finger has no member to name. Shown
                        // rather than hidden — this row is how a gym notices
                        // someone trying their luck at the door.
                        <span className="text-ink-muted">Not recognised</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <KindBadge kind={event.kind} />
                        <span className="text-ink-secondary">
                          {event.description}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-mono-sm text-ink-muted">
                      {event.deviceSerial}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Pagination
            page={data.page}
            pageCount={data.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}

function KindBadge({ kind }: { kind: SerializedAccessEvent['kind'] }) {
  if (kind === DeviceEventKind.Granted) {
    return (
      <Badge variant="success">
        <DoorOpen className="h-3 w-3" aria-hidden="true" />
        In
      </Badge>
    )
  }

  if (kind === DeviceEventKind.Denied) {
    return (
      <Badge variant="neutral">
        <ShieldX className="h-3 w-3" aria-hidden="true" />
        Refused
      </Badge>
    )
  }

  if (kind === DeviceEventKind.Alarm) {
    return (
      <Badge variant="error">
        <TriangleAlert className="h-3 w-3" aria-hidden="true" />
        Alert
      </Badge>
    )
  }

  return (
    <Badge variant="neutral">
      <Wrench className="h-3 w-3" aria-hidden="true" />
      Device
    </Badge>
  )
}
