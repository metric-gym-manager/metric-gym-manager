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
import { DoorOpen } from 'lucide-react'
import {
  Badge,
  EmptyState,
  ListRow,
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
import { useViewportTier } from '@/hooks/useViewportTier'
import { useAccessEvents } from '../hooks/useAccessControl'
import { DeviceEventKind } from '../config/DeviceEventCodes'
import type { SerializedAccessEvent } from '../utils/serializeAccessForAPI'

import { formatDateTime } from '@/utils/date/date'

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
  const phone = useViewportTier() === 'phone'

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

      {/* Visit 2, CD-6/PH-03: no "Refused" row for a stranger is not evidence
          that nobody tried. */}
      <p className="text-caption text-ink-muted">
        Readers report refusals only for fingers they recognise. An unknown
        finger is turned away without a record.
      </p>

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
          {phone ? (
            /*
             * §9.4 "Access activity": who, badge and when in the row, the
             * reader disclosed on the meta line. C15 is explicit that this
             * table stays a plain `Table` on the desktop and renders rows on a
             * phone through the tier hook — no `Table` → `DataTable`
             * conversion. The desktop's four columns all survive: who is the
             * primary, "what happened" keeps the badge AND its description in
             * the status slot exactly as the desktop cell composes them, the
             * reader is the meta line, and the timestamp is the trailing
             * value.
             *
             * The `TableContainer` the desktop keeps is `overflow-x-auto`, so
             * on a phone this never widened the page — it hid two of the four
             * columns inside a scroller with no visual cue (probe rule 3).
             */
            <ul role="list">
              {data.events.map((event) => (
                <ListRow
                  key={event.id}
                  primary={
                    event.memberName ?? (
                      <span className="text-ink-muted">Not recognised</span>
                    )
                  }
                  status={
                    <span className="flex items-center gap-2">
                      <KindBadge kind={event.kind} />
                      <span className="text-ink-secondary">
                        {event.description}
                      </span>
                    </span>
                  }
                  meta={[event.deviceSerial]}
                  value={formatDateTime(event.occurredAt)}
                />
              ))}
            </ul>
          ) : (
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
                        {formatDateTime(event.occurredAt)}
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
          )}

          {/* §26's DOOR ACCESS blueprint draws the compact "[‹ Prev] 1 of 4
              [Next ›]" pager: numbered pages need seven 32 px targets in a row,
              which is the full width of a 320 px screen. Both forms are in the
              DOM and CSS picks one, so the desktop is untouched. */}
          <Pagination
            page={data.page}
            pageCount={data.totalPages}
            onPageChange={setPage}
            responsive
          />
        </>
      )}
    </div>
  )
}

function KindBadge({ kind }: { kind: SerializedAccessEvent['kind'] }) {
  if (kind === DeviceEventKind.Granted) {
    return <Badge variant="success">In</Badge>
  }

  if (kind === DeviceEventKind.Denied) {
    return <Badge variant="neutral">Refused</Badge>
  }

  if (kind === DeviceEventKind.Alarm) {
    return <Badge variant="error">Alert</Badge>
  }

  return <Badge variant="neutral">Device</Badge>
}
